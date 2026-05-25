import { reddit } from '@devvit/web/server';
import type {
  Incident,
  NativeCommentAction,
  NativePostAction,
  NativeUserAction,
} from '../../../shared/api';
import {
  commentActionControl,
  commentActionDetail,
  nativeCommentActionType,
  nativePostActionType,
  nativeUserActionType,
  parseCrowdControlLevel,
  postActionControl,
  postActionDetail,
  userActionControl,
  userActionDetail,
} from '../../../shared/reddit-actions';
import { recordRuleMatches } from '../firewatch-rules';
import { runRuleAutomationActions } from './automation';
import {
  appendAction,
  getIncidentOrThrow,
  isDemoCommentSnapshot,
  refreshIncident,
} from './incidents';
import { actorName, getConfig, getIncident, saveIncident } from './store';
import {
  normalizeCommentId,
  normalizePostId,
  normalizeUsername,
} from '../firewatch-utils';


// Shared Reddit action helpers
export const isDemoComment = (incident: Incident, commentId: string) =>
  isDemoCommentSnapshot(incident, commentId);

export const trimRemovalNote = (reason: string | undefined) => {
  const trimmed = reason?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 100);
};

export const removeCommentIfReal = async (
  incident: Incident,
  commentId: string,
  reason?: string,
  isSpam = false
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await reddit.getCommentById(normalizedCommentId);
  await comment.remove(isSpam);
  const modNote = trimRemovalNote(reason);
  if (modNote) {
    await comment.addRemovalNote({
      reasonId: '',
      modNote,
    });
  }

  return true;
};

export const approveCommentIfReal = async (incident: Incident, commentId: string) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await reddit.getCommentById(normalizedCommentId);
  await comment.approve();
  return true;
};



// Post actions
export const applyNativePostAction = async (
  postId: string,
  values: {
    action: NativePostAction;
    crowdControlLevel?: string;
    flairTemplateId?: string;
    flairText?: string;
    reason?: string;
  }
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  const control = postActionControl(values.action);
  if (!config.actionControls[control]) {
    throw new Error('This Reddit post action is disabled in Settings');
  }

  const actor = await actorName();
  const post = await reddit.getPostById(normalizedPostId);
  const reason = values.reason?.trim();
  const removalNote = trimRemovalNote(reason);
  const flairTemplateId = values.flairTemplateId?.trim() || undefined;
  const flairText = values.flairText?.trim().slice(0, 64) || undefined;
  const crowdControlLevel = parseCrowdControlLevel(values.crowdControlLevel);

  switch (values.action) {
    case 'approve':
      await post.approve();
      break;
    case 'remove':
      await post.remove(false);
      if (removalNote) {
        await post.addRemovalNote({ reasonId: '', modNote: removalNote });
      }
      break;
    case 'spam':
      await post.remove(true);
      if (removalNote) {
        await post.addRemovalNote({ reasonId: '', modNote: removalNote });
      }
      break;
    case 'unlock':
      await post.unlock();
      break;
    case 'mark-nsfw':
      await post.markAsNsfw();
      break;
    case 'unmark-nsfw':
      await post.unmarkAsNsfw();
      break;
    case 'mark-spoiler':
      await post.markAsSpoiler();
      break;
    case 'unmark-spoiler':
      await post.unmarkAsSpoiler();
      break;
    case 'ignore-reports':
      await post.ignoreReports();
      break;
    case 'unignore-reports':
      await post.unignoreReports();
      break;
    case 'crowd-control':
      await post.updateCrowdControlLevel(crowdControlLevel);
      break;
    case 'set-flair':
      if (!flairTemplateId && !flairText) {
        throw new Error('Select a post flair or enter flair text first');
      }
      await reddit.setPostFlair({
        flairTemplateId,
        postId: normalizedPostId,
        subredditName: incident.subredditName,
        text: flairText,
      });
      break;
  }

  return appendAction(normalizedPostId, {
    type: nativePostActionType(values.action),
    actor,
    detail: postActionDetail({
      action: values.action,
      crowdControlLevel,
      flairText,
      reason,
    }),
    targetIds: [normalizedPostId],
  });
};



// Comment actions
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
      : `Marked demo comment ${normalizedCommentId} approved`,
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
      : `Marked demo comment ${normalizedCommentId} removed`,
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

const collectThreadCommentIds = async (
  incident: Incident,
  commentId: string
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) {
    return [normalizedCommentId];
  }

  const comments = await reddit
    .getComments({
      postId: normalizePostId(incident.postId),
      commentId: normalizedCommentId,
      depth: 10,
      limit: 100,
      pageSize: 100,
    })
    .all();

  return Array.from(
    new Set([normalizedCommentId, ...comments.map((comment) => comment.id)])
  );
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



// User actions
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
    ? `Marked ${removedContentIds.length} demo comment${
        removedContentIds.length === 1 ? '' : 's'
      } removed`
    : `Removed ${removedContentIds.length} recent subreddit item${
        removedContentIds.length === 1 ? '' : 's'
      }`;
  const incident = await appendAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: demoOnly
      ? `${removalDetail}; recorded demo ban for u/${normalizedUsername}`
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
      ? `Recorded demo ${durationLabel} ban for u/${normalizedUsername}: ${actionReason}`
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
