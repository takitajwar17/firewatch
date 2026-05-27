import { reddit } from '@devvit/web/server';
import type { Incident, NativeUserAction } from '../../../../shared/api';
import {
  nativeUserActionType,
  userActionControl,
  userActionDetail,
} from '../../../../shared/reddit-actions';
import { isCommentOpenForReview } from '../../../../shared/incidents';
import {
  normalizePostId,
  normalizeUsername,
  usernameKey,
} from '../../firewatch-utils';
import {
  runTargetedRedditActions,
  successfulTargetIds,
  throwIfNoTargetSucceeded,
} from '../reddit-runtime';
import {
  completeIncidentAction,
  failIncidentAction,
  getIncidentOrThrow,
  saveAndRefreshIncident,
  startIncidentAction,
} from '../incidents';
import { actorName, getConfig, getIncident } from '../store';
import {
  isDemoComment,
  markFlaggedCommentsRemoved,
  removeCommentIfReal,
} from './comment-helpers';

export const banUserAndRemoveComments = async (
  postId: string,
  username: string,
  reason?: string,
  durationDays?: number
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot ban an unknown user');

  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.banUsers) {
    throw new Error('User bans are disabled in Settings');
  }
  if (!config.actionControls.removeComments) {
    throw new Error('Comment removals are required before banning users');
  }

  const targetComments = sourceIncident.flaggedComments.filter(
    (comment) =>
      isCommentOpenForReview(comment) &&
      usernameKey(comment.author) === usernameKey(normalizedUsername)
  );
  if (targetComments.length === 0) {
    throw new Error(`No unreviewed comments from u/${normalizedUsername}`);
  }

  const targetIds = targetComments.map((comment) => comment.id);
  const contextCommentId = targetIds[0];
  if (!contextCommentId) {
    throw new Error(`No unreviewed comments from u/${normalizedUsername}`);
  }
  const actionReason =
    reason?.trim() ||
    `Banned u/${normalizedUsername} from r/${sourceIncident.subredditName}`;
  const demoOnly = targetComments.every((comment) =>
    isDemoComment(sourceIncident, comment.id)
  );

  const actor = await actorName();
  const removalPendingDetail = `Remove ${targetIds.length} open comment${
    targetIds.length === 1 ? '' : 's'
  } from u/${normalizedUsername} before ban`;
  const { actionId: removalActionId } = await startIncidentAction(normalizedPostId, {
    type: 'user_content_removed',
    actor,
    detail: removalPendingDetail,
    targetIds,
  });
  let removedContentIds: string[];
  try {
    removedContentIds = await removeRecentUserContent(
      sourceIncident,
      normalizedUsername,
      actionReason
    );
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      removalActionId,
      error,
      `User content removal failed to record failure state for ${normalizedPostId}`,
      {
        detail: removalPendingDetail,
        targetIds,
      }
    );
    throw error;
  }
  const removalDetail = demoOnly
    ? `Marked ${removedContentIds.length} comment${
        removedContentIds.length === 1 ? '' : 's'
      } removed`
    : `Removed ${removedContentIds.length} open comment${
        removedContentIds.length === 1 ? '' : 's'
      }`;
  const incidentWithRemovalAction = await completeIncidentAction(
    normalizedPostId,
    removalActionId,
    {
      detail: `${removalDetail} before ban review`,
      status: 'succeeded',
      targetIds: removedContentIds,
    },
    `Removed comments for u/${normalizedUsername} but failed to refresh incident ${normalizedPostId}`
  );
  const incidentWithRemovedComments = markFlaggedCommentsRemoved(
    incidentWithRemovalAction,
    removedContentIds
  );
  const refreshedRemovalIncident = await saveAndRefreshIncident(
    incidentWithRemovedComments,
    `Removed comments for u/${normalizedUsername} but failed to refresh incident ${normalizedPostId}`
  );

  const durationLabel =
    durationDays && durationDays > 0 ? `${durationDays}-day` : 'permanent';
  const banDetail = demoOnly
    ? `Recorded ${durationLabel} ban for u/${normalizedUsername}: ${actionReason}`
    : `Banned u/${normalizedUsername} (${durationLabel}): ${actionReason}`;
  const { actionId: banActionId } = await startIncidentAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: banDetail,
    targetIds: [normalizedUsername],
  });
  try {
    if (!demoOnly) {
      await reddit.banUser({
        context: contextCommentId,
        duration: durationDays ?? 0,
        note: actionReason,
        reason: 'Firewatch moderation',
        subredditName: sourceIncident.subredditName,
        username: normalizedUsername,
      });
    }
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      banActionId,
      error,
      `User ban failed to record failure state for ${normalizedPostId}`,
      { detail: banDetail, targetIds: [normalizedUsername] }
    );
    throw error;
  }

  return completeIncidentAction(
    refreshedRemovalIncident.postId,
    banActionId,
    { status: 'succeeded' },
    `Banned u/${normalizedUsername} but failed to refresh incident ${normalizedPostId}`
  );
};

export const banPreparedRuleUser = async ({
  contextId,
  durationDays,
  postId,
  reason,
  username,
}: {
  contextId?: string;
  durationDays?: number;
  postId: string;
  reason: string;
  username: string;
}) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot ban an unknown user');

  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.banUsers) {
    throw new Error('User bans are disabled in Settings');
  }

  const actor = await actorName();
  const actionReason =
    reason.trim() ||
    `Banned u/${normalizedUsername} from r/${incident.subredditName}`;
  const durationLabel =
    durationDays && durationDays > 0 ? `${durationDays}-day` : 'permanent';
  const demoUser = isDemoUser(incident, normalizedUsername);

  const detail = demoUser
    ? `Recorded ${durationLabel} ban for u/${normalizedUsername}: ${actionReason}`
    : `Banned u/${normalizedUsername} (${durationLabel}): ${actionReason}`;
  const targetIds = [normalizedUsername];
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail,
    targetIds,
  });
  try {
    if (!demoUser) {
      await reddit.banUser({
        context: contextId ?? normalizedPostId,
        duration: durationDays ?? 0,
        note: actionReason,
        reason: 'Firewatch automation',
        subredditName: incident.subredditName,
        username: normalizedUsername,
      });
    }
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Prepared user ban failed to record failure state for ${normalizedPostId}`,
      { detail, targetIds }
    );
    throw error;
  }

  return completeIncidentAction(
    normalizedPostId,
    actionId,
    { status: 'succeeded' },
    `Prepared user ban succeeded but failed to refresh incident ${normalizedPostId}`
  );
};

const trackedCommentIdsByUser = (incident: Incident, username: string) =>
  incident.flaggedComments
    .filter(
      (comment) =>
        isCommentOpenForReview(comment) &&
        usernameKey(comment.author) === usernameKey(username)
    )
    .map((comment) => comment.id);

export const isDemoUser = (incident: Incident, username: string) =>
  Boolean(incident.demo) &&
  incident.recentSignals.some(
    (signal) =>
      signal.isDemo &&
      usernameKey(signal.author) === usernameKey(username)
  );

const removeRecentUserContent = async (
  incident: Incident,
  username: string,
  reason?: string
) => {
  const trackedIds = trackedCommentIdsByUser(incident, username);
  if (trackedIds.length === 0) return [];

  const actionResults = await runTargetedRedditActions(trackedIds, (commentId) =>
    removeCommentIfReal(incident, commentId, reason)
  );
  throwIfNoTargetSucceeded(
    actionResults,
    `No open comments from u/${username} could be removed`
  );
  const removedIds = successfulTargetIds(actionResults);

  return removedIds;
};

export const applyNativeUserAction = async (
  postId: string,
  username: string,
  values: {
    action: NativeUserAction;
    note?: string;
    reason?: string;
  }
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot act on an unknown user');

  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  const control = userActionControl(values.action);
  if (!config.actionControls[control]) {
    throw new Error('This Reddit user action is disabled in Settings');
  }

  const actor = await actorName();
  const note =
    values.note?.trim() ||
    values.reason?.trim() ||
    'Firewatch moderator action';
  let targetIds = [normalizedUsername];
  const demoUser = isDemoUser(incident, normalizedUsername);
  if (values.action === 'remove-recent-content') {
    targetIds = trackedCommentIdsByUser(incident, normalizedUsername);
    if (targetIds.length === 0) {
      throw new Error(`No open comments from u/${normalizedUsername}`);
    }
  }

  const detail = userActionDetail({
    action: values.action,
    count: targetIds.length,
    note,
    username: normalizedUsername,
  });
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: nativeUserActionType(values.action),
    actor,
    detail,
    targetIds,
  });
  try {
    if (values.action === 'approve' && !demoUser) {
      await reddit.approveUser(normalizedUsername, incident.subredditName);
    }
    if (values.action === 'mute' && !demoUser) {
      await reddit.muteUser({
        note,
        subredditName: incident.subredditName,
        username: normalizedUsername,
      });
    }
    if (values.action === 'add-mod-note' && !demoUser) {
      await reddit.addModNote({
        label: 'SPAM_WATCH',
        note: note.slice(0, 250),
        redditId: normalizedPostId,
        subreddit: incident.subredditName,
        user: normalizedUsername,
      });
    }
    if (values.action === 'remove-recent-content') {
      targetIds = await removeRecentUserContent(
        incident,
        normalizedUsername,
        values.reason
      );
    }
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `User action ${values.action} failed to record failure state for ${normalizedPostId}`,
      { detail, targetIds }
    );
    throw error;
  }
  const withAction = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      detail: userActionDetail({
        action: values.action,
        count: targetIds.length,
        note,
        username: normalizedUsername,
      }),
      status: 'succeeded',
      targetIds,
    },
    `User action ${values.action} succeeded but failed to refresh incident ${normalizedPostId}`
  );

  if (values.action !== 'remove-recent-content') return withAction;

  return saveAndRefreshIncident(
    markFlaggedCommentsRemoved(withAction, targetIds),
    `Removed open comments for u/${normalizedUsername} but failed to refresh incident ${normalizedPostId}`
  );
};
