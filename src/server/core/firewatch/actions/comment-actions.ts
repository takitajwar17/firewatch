import type {
  BulkCommentReviewInput,
  Incident,
  NativeCommentAction,
} from '../../../../shared/api';
import {
  commentActionControl,
  commentActionDetail,
  nativeCommentActionType,
} from '../../../../shared/reddit-actions';
import { isCommentOpenForReview } from '../../../../shared/incidents';
import { recordRuleMatches } from '../../firewatch-rules/matching';
import { normalizeCommentId, normalizePostId } from '../../firewatch-utils';
import {
  failedTargetSummary,
  readRedditComment,
  runTargetedRedditActions,
  successfulTargetIds,
  throwIfNoTargetSucceeded,
} from '../reddit-runtime';
import { runRuleAutomationActions } from '../automation';
import {
  completeIncidentAction,
  failIncidentAction,
  getIncidentOrThrow,
  refreshIncident,
  saveAndRefreshIncident,
  startIncidentAction,
} from '../incidents';
import { actorName, getConfig, saveIncident } from '../store';
import {
  approveCommentIfReal,
  collectThreadCommentIds,
  isDemoComment,
  markFlaggedCommentsRemoved,
  patchFlaggedComments,
  removeCommentIfReal,
} from './comment-helpers';

export const approveFlaggedComment = async (
  postId: string,
  commentId: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const sourceIncident = await refreshIncident(
    await getIncidentOrThrow(normalizedPostId)
  );
  await saveIncident(sourceIncident);
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.approveComments) {
    throw new Error('Comment approvals are disabled in Settings');
  }

  const actor = await actorName();
  const detail = `Approved comment ${normalizedCommentId}`;
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: 'comment_approved',
    actor,
    detail,
    targetIds: [normalizedCommentId],
  });
  let approvedOnReddit: boolean;
  try {
    approvedOnReddit = await approveCommentIfReal(
      sourceIncident,
      normalizedCommentId
    );
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Approved comment ${normalizedCommentId} failed to record failure state`,
      { detail, targetIds: [normalizedCommentId] }
    );
    throw error;
  }
  const incident = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      detail: approvedOnReddit
        ? detail
        : `Marked comment ${normalizedCommentId} approved`,
      status: 'succeeded',
    },
    `Approved comment ${normalizedCommentId} but failed to refresh incident ${normalizedPostId}`
  );
  const nextIncident: Incident = {
    ...patchFlaggedComments(incident, [normalizedCommentId], {
      approved: true,
      removed: false,
      reviewed: true,
      spam: false,
    }),
  };
  const refreshedIncident = await saveAndRefreshIncident(
    nextIncident,
    `Approved comment ${normalizedCommentId} but failed to refresh incident ${normalizedPostId}`
  );
  return refreshedIncident;
};

export const removeFlaggedComment = async (
  postId: string,
  commentId: string,
  reason?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const sourceIncident = await refreshIncident(
    await getIncidentOrThrow(normalizedPostId)
  );
  await saveIncident(sourceIncident);
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.removeComments) {
    throw new Error('Comment removals are disabled in Settings');
  }

  const actor = await actorName();
  const detail = `Removed comment ${normalizedCommentId}${reason ? `: ${reason}` : ''}`;
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: 'comment_removed',
    actor,
    detail,
    targetIds: [normalizedCommentId],
  });
  let removedOnReddit: boolean;
  try {
    removedOnReddit = await removeCommentIfReal(
      sourceIncident,
      normalizedCommentId,
      reason
    );
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Removed comment ${normalizedCommentId} failed to record failure state`,
      { detail, targetIds: [normalizedCommentId] }
    );
    throw error;
  }
  const incident = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      detail: removedOnReddit
        ? detail
        : `Marked comment ${normalizedCommentId} removed`,
      status: 'succeeded',
    },
    `Removed comment ${normalizedCommentId} but failed to refresh incident ${normalizedPostId}`
  );
  const nextIncident: Incident = {
    ...patchFlaggedComments(incident, [normalizedCommentId], {
      approved: false,
      removed: true,
      reviewed: false,
      spam: false,
    }),
  };
  const refreshedIncident = await saveAndRefreshIncident(
    nextIncident,
    `Removed comment ${normalizedCommentId} but failed to refresh incident ${normalizedPostId}`
  );
  const ruleLogs = await recordRuleMatches({
    config,
    incident: refreshedIncident,
    triggerType: 'comment_removed',
  });
  return runRuleAutomationActions(refreshedIncident, ruleLogs);
};

const commentCountLabel = (count: number) =>
  `${count} comment${count === 1 ? '' : 's'}`;

const normalizedBulkReviewInput = (
  values: Partial<BulkCommentReviewInput>
) => {
  const action = values.action;
  if (action !== 'approve' && action !== 'remove') {
    throw new Error('Choose approve or remove for bulk comment review');
  }

  const commentIds = Array.isArray(values.commentIds)
    ? values.commentIds
        .filter(
          (commentId) =>
            typeof commentId === 'string' && commentId.trim().length > 0
        )
        .map(normalizeCommentId)
    : [];
  const uniqueCommentIds = Array.from(new Set(commentIds)).slice(0, 50);

  if (uniqueCommentIds.length === 0) {
    throw new Error('Select at least one comment');
  }

  return {
    action,
    commentIds: uniqueCommentIds,
    reason: values.reason,
  };
};

const bulkCommentDetail = ({
  action,
  count,
  demoOnly,
  reason,
}: {
  action: BulkCommentReviewInput['action'];
  count: number;
  demoOnly: boolean;
  reason?: string | undefined;
}) => {
  const comments = commentCountLabel(count);

  if (action === 'approve') {
    return demoOnly ? `Marked ${comments} approved` : `Approved ${comments}`;
  }

  return demoOnly
    ? `Marked ${comments} removed`
    : `Removed ${comments}${reason ? `: ${reason}` : ''}`;
};

export const bulkReviewComments = async (
  postId: string,
  values: Partial<BulkCommentReviewInput>
) => {
  const normalizedPostId = normalizePostId(postId);
  const input = normalizedBulkReviewInput(values);
  const sourceIncident = await refreshIncident(
    await getIncidentOrThrow(normalizedPostId)
  );
  await saveIncident(sourceIncident);
  const config = await getConfig(sourceIncident.subredditName);
  const selectedCommentIds = new Set(input.commentIds);
  const targetIds = sourceIncident.flaggedComments
    .filter(
      (comment) =>
        selectedCommentIds.has(normalizeCommentId(comment.id)) &&
        isCommentOpenForReview(comment)
    )
    .map((comment) => normalizeCommentId(comment.id));

  if (targetIds.length === 0) {
    throw new Error('No open comments selected');
  }

  if (input.action === 'approve' && !config.actionControls.approveComments) {
    throw new Error('Comment approvals are disabled in Settings');
  }
  if (input.action === 'remove' && !config.actionControls.removeComments) {
    throw new Error('Comment removals are disabled in Settings');
  }

  const actor = await actorName();
  const reason = input.reason?.trim();
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: input.action === 'approve' ? 'comment_approved' : 'comment_removed',
    actor,
    detail: `${
      input.action === 'approve' ? 'Review approve' : 'Review remove'
    } ${commentCountLabel(targetIds.length)}`,
    targetIds,
  });
  const actionResults =
    input.action === 'approve'
      ? await runTargetedRedditActions(targetIds, (targetId) =>
          approveCommentIfReal(sourceIncident, targetId)
        )
      : await runTargetedRedditActions(targetIds, (targetId) =>
          removeCommentIfReal(sourceIncident, targetId, reason)
        );
  try {
    throwIfNoTargetSucceeded(actionResults, 'No selected comments were updated');
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Bulk comment review failed to record failure state for ${normalizedPostId}`,
      { targetIds }
    );
    throw error;
  }
  const actedTargetIds = successfulTargetIds(actionResults);
  const failureSummary = failedTargetSummary(actionResults);

  const demoOnly = actedTargetIds.every((targetId) =>
    isDemoComment(sourceIncident, targetId)
  );
  const incident = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      detail: [
        bulkCommentDetail({
          action: input.action,
          count: actedTargetIds.length,
          demoOnly,
          reason,
        }),
        failureSummary,
      ]
        .filter((part): part is string => Boolean(part))
        .join('; '),
      status: 'succeeded',
      targetIds: actedTargetIds,
    },
    `Bulk comment review completed but failed to refresh incident ${normalizedPostId}`
  );
  const nextIncident: Incident = {
    ...patchFlaggedComments(
      incident,
      actedTargetIds,
      input.action === 'approve'
        ? {
            approved: true,
            removed: false,
            reviewed: true,
            spam: false,
          }
        : {
            approved: false,
            removed: true,
            reviewed: false,
            spam: false,
          }
    ),
  };
  const refreshedIncident = await saveAndRefreshIncident(
    nextIncident,
    `Bulk comment review completed but failed to refresh incident ${normalizedPostId}`
  );

  if (input.action === 'approve') return refreshedIncident;

  const ruleLogs = await recordRuleMatches({
    config,
    incident: refreshedIncident,
    triggerType: 'comment_removed',
  });
  return runRuleAutomationActions(refreshedIncident, ruleLogs);
};

export const applyNativeCommentAction = async (
  postId: string,
  commentId: string,
  values: {
    action: NativeCommentAction;
    reason?: string;
  }
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  const control = commentActionControl(values.action);
  if (!config.actionControls[control]) {
    throw new Error('This Reddit comment action is disabled in Settings');
  }
  if (
    values.action === 'remove-thread' &&
    !config.actionControls.removeComments
  ) {
    throw new Error('Comment removals are disabled in Settings');
  }

  const actor = await actorName();
  const reason = values.reason?.trim();
  let targetIds: string[] = [normalizedCommentId];
  if (values.action === 'remove-thread') {
    targetIds = await collectThreadCommentIds(incident, normalizedCommentId);
  }
  const detail = commentActionDetail({
    action: values.action,
    count: targetIds.length,
    reason,
  });
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: nativeCommentActionType(values.action),
    actor,
    detail,
    targetIds,
  });

  try {
    if (values.action === 'remove-thread') {
      const actionResults = await runTargetedRedditActions(
        targetIds,
        (targetId) => removeCommentIfReal(incident, targetId, reason)
      );
      throwIfNoTargetSucceeded(actionResults, 'No thread comments were removed');
      targetIds = successfulTargetIds(actionResults);
    } else if (values.action === 'spam') {
      await removeCommentIfReal(incident, normalizedCommentId, reason, true);
    } else if (!isDemoComment(incident, normalizedCommentId)) {
      const comment = await readRedditComment(normalizedCommentId);
      if (values.action === 'lock') await comment.lock();
      if (values.action === 'unlock') await comment.unlock();
      if (values.action === 'ignore-reports') await comment.ignoreReports();
      if (values.action === 'unignore-reports') await comment.unignoreReports();
      if (values.action === 'show-comment') await comment.showComment();
    }
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Comment action ${values.action} failed to record failure state for ${normalizedPostId}`,
      { detail, targetIds }
    );
    throw error;
  }

  const withAction = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      detail: commentActionDetail({
        action: values.action,
        count: targetIds.length,
        reason,
      }),
      status: 'succeeded',
      targetIds,
    },
    `Comment action ${values.action} completed but failed to refresh incident ${normalizedPostId}`
  );

  const patchedIncident =
    values.action === 'remove-thread'
      ? markFlaggedCommentsRemoved(withAction, targetIds)
      : values.action === 'spam'
        ? markFlaggedCommentsRemoved(withAction, targetIds, { spam: true })
        : values.action === 'lock'
          ? patchFlaggedComments(withAction, targetIds, { locked: true })
          : values.action === 'unlock'
            ? patchFlaggedComments(withAction, targetIds, { locked: false })
            : values.action === 'ignore-reports'
              ? patchFlaggedComments(withAction, targetIds, {
                  ignoringReports: true,
                })
              : values.action === 'unignore-reports'
                ? patchFlaggedComments(withAction, targetIds, {
                    ignoringReports: false,
                  })
                : values.action === 'show-comment'
                  ? patchFlaggedComments(withAction, targetIds, {
                      shown: true,
                    })
                : withAction;

  if (patchedIncident === withAction) return withAction;

  return saveAndRefreshIncident(
    patchedIncident,
    `Comment action ${values.action} completed but failed to refresh incident ${normalizedPostId}`
  );
};
