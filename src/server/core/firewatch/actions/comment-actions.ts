import { reddit } from '@devvit/web/server';
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
import { recordRuleMatches } from '../../firewatch-rules/matching';
import { normalizeCommentId, normalizePostId } from '../../firewatch-utils';
import { runRuleAutomationActions } from '../automation';
import {
  appendAction,
  getIncidentOrThrow,
  refreshIncident,
} from '../incidents';
import { actorName, getConfig, getIncident, saveIncident } from '../store';
import {
  approveCommentIfReal,
  collectThreadCommentIds,
  isDemoComment,
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
  const approvedOnReddit = await approveCommentIfReal(
    sourceIncident,
    normalizedCommentId
  );
  const incident = await appendAction(normalizedPostId, {
    type: 'comment_approved',
    actor,
    detail: approvedOnReddit
      ? `Approved comment ${normalizedCommentId}`
      : `Marked comment ${normalizedCommentId} approved`,
    targetIds: [normalizedCommentId],
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      flaggedComment.id === normalizedCommentId
        ? { ...flaggedComment, reviewed: true }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

export const removeFlaggedComment = async (
  postId: string,
  commentId: string,
  reason?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.removeComments) {
    throw new Error('Comment removals are disabled in Settings');
  }

  const actor = await actorName();
  const removedOnReddit = await removeCommentIfReal(
    sourceIncident,
    normalizedCommentId,
    reason
  );
  const incident = await appendAction(normalizedPostId, {
    type: 'comment_removed',
    actor,
    detail: removedOnReddit
      ? `Removed comment ${normalizedCommentId}${reason ? `: ${reason}` : ''}`
      : `Marked comment ${normalizedCommentId} removed`,
    targetIds: [normalizedCommentId],
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      flaggedComment.id === normalizedCommentId
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
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
        !comment.removed &&
        !comment.reviewed
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
  if (input.action === 'approve') {
    await Promise.all(
      targetIds.map((targetId) =>
        approveCommentIfReal(sourceIncident, targetId)
      )
    );
  } else {
    await Promise.all(
      targetIds.map((targetId) =>
        removeCommentIfReal(sourceIncident, targetId, reason)
      )
    );
  }

  const demoOnly = targetIds.every((targetId) =>
    isDemoComment(sourceIncident, targetId)
  );
  const incident = await appendAction(normalizedPostId, {
    type: input.action === 'approve' ? 'comment_approved' : 'comment_removed',
    actor,
    detail: bulkCommentDetail({
      action: input.action,
      count: targetIds.length,
      demoOnly,
      reason,
    }),
    targetIds,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      targetIds.includes(normalizeCommentId(flaggedComment.id))
        ? {
            ...flaggedComment,
            removed: input.action === 'remove',
            reviewed: input.action === 'approve',
          }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);

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
    await Promise.all(
      targetIds.map((targetId) =>
        removeCommentIfReal(incident, targetId, reason)
      )
    );
  } else if (values.action === 'spam') {
    await removeCommentIfReal(incident, normalizedCommentId, reason, true);
  } else if (!isDemoComment(incident, normalizedCommentId)) {
    const comment = await reddit.getCommentById(normalizedCommentId);
    if (values.action === 'lock') await comment.lock();
    if (values.action === 'unlock') await comment.unlock();
    if (values.action === 'ignore-reports') await comment.ignoreReports();
    if (values.action === 'unignore-reports') await comment.unignoreReports();
    if (values.action === 'show-comment') await comment.showComment();
  }

  const withAction = await appendAction(normalizedPostId, {
    type: nativeCommentActionType(values.action),
    actor,
    detail: commentActionDetail({
      action: values.action,
      count: targetIds.length,
      reason,
    }),
    targetIds,
  });

  if (values.action !== 'remove-thread' && values.action !== 'spam') {
    return withAction;
  }

  const nextIncident: Incident = {
    ...withAction,
    flaggedComments: withAction.flaggedComments.map((flaggedComment) =>
      targetIds.includes(flaggedComment.id)
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};
