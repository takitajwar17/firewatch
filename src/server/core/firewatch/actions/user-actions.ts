import { reddit } from '@devvit/web/server';
import type { Incident, NativeUserAction } from '../../../../shared/api';
import {
  nativeUserActionType,
  userActionControl,
  userActionDetail,
} from '../../../../shared/reddit-actions';
import {
  normalizeCommentId,
  normalizePostId,
  normalizeUsername,
} from '../../firewatch-utils';
import {
  appendAction,
  getIncidentOrThrow,
  refreshIncident,
} from '../incidents';
import { actorName, getConfig, getIncident, saveIncident } from '../store';
import {
  isDemoComment,
  removeCommentIfReal,
  trimRemovalNote,
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
      !comment.removed &&
      !comment.reviewed &&
      normalizeUsername(comment.author)?.toLowerCase() ===
        normalizedUsername.toLowerCase()
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
  const removedContentIds = await removeRecentUserContent(
    sourceIncident,
    normalizedUsername,
    actionReason
  );
  const demoOnly = targetComments.every((comment) =>
    isDemoComment(sourceIncident, comment.id)
  );

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

  const actor = await actorName();
  const removalDetail = demoOnly
    ? `Marked ${removedContentIds.length} comment${
        removedContentIds.length === 1 ? '' : 's'
      } removed`
    : `Removed ${removedContentIds.length} recent subreddit item${
        removedContentIds.length === 1 ? '' : 's'
      }`;
  const incident = await appendAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: demoOnly
      ? `${removalDetail}; recorded ban for u/${normalizedUsername}`
      : `${removalDetail}; banned u/${normalizedUsername}`,
    targetIds: removedContentIds,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      removedContentIds.includes(flaggedComment.id)
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
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

  return appendAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: demoUser
      ? `Recorded ${durationLabel} ban for u/${normalizedUsername}: ${actionReason}`
      : `Banned u/${normalizedUsername} (${durationLabel}): ${actionReason}`,
    targetIds: contextId?.startsWith('t1_')
      ? [normalizeCommentId(contextId)]
      : undefined,
  });
};

const trackedCommentIdsByUser = (incident: Incident, username: string) =>
  incident.flaggedComments
    .filter(
      (comment) =>
        !comment.removed &&
        !comment.reviewed &&
        normalizeUsername(comment.author)?.toLowerCase() ===
          username.toLowerCase()
    )
    .map((comment) => comment.id);

export const isDemoUser = (incident: Incident, username: string) =>
  Boolean(incident.demo) &&
  incident.recentSignals.some(
    (signal) =>
      signal.isDemo &&
      normalizeUsername(signal.author)?.toLowerCase() === username.toLowerCase()
  );

const removeRecentUserContent = async (
  incident: Incident,
  username: string,
  reason?: string
) => {
  const trackedIds = trackedCommentIdsByUser(incident, username);
  const removedIds = new Set<string>();

  await Promise.all(
    trackedIds.map(async (commentId) => {
      await removeCommentIfReal(incident, commentId, reason);
      removedIds.add(commentId);
    })
  );

  const demoOnly =
    Boolean(incident.demo) &&
    trackedIds.length > 0 &&
    trackedIds.every((commentId) => isDemoComment(incident, commentId));

  if (demoOnly) return Array.from(removedIds);

  const recentItems = await reddit
    .getCommentsAndPostsByUser({
      username,
      sort: 'new',
      timeframe: 'all',
      limit: 1000,
      pageSize: 100,
    })
    .all();
  const subredditItems = recentItems.filter(
    (item) => item.subredditName === incident.subredditName
  );

  for (const item of subredditItems) {
    if (removedIds.has(item.id)) continue;
    if (item.isApproved()) continue;
    if (item.isRemoved()) {
      removedIds.add(item.id);
      continue;
    }
    await item.remove(false);
    const modNote = trimRemovalNote(reason);
    if (modNote) {
      await item.addRemovalNote({
        reasonId: '',
        modNote,
      });
    }
    removedIds.add(item.id);
  }

  return Array.from(removedIds);
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

  const withAction = await appendAction(normalizedPostId, {
    type: nativeUserActionType(values.action),
    actor,
    detail: userActionDetail({
      action: values.action,
      count: targetIds.length,
      note,
      username: normalizedUsername,
    }),
    targetIds,
  });

  if (values.action !== 'remove-recent-content') return withAction;

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
