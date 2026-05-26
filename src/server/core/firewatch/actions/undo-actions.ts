import { reddit } from '@devvit/web/server';
import type {
  Incident,
  IncidentAction,
  IncidentActionType,
  PostFlairState,
} from '../../../../shared/api';
import { actionCompleted, undoActionLabel } from '../../../../shared/reddit-actions';
import { normalizeCommentId, normalizePostId } from '../../firewatch-utils';
import {
  failedTargetSummary,
  readRedditComment,
  readRedditPost,
  runTargetedRedditActions,
  successfulTargetIds,
  throwIfNoTargetSucceeded,
} from '../reddit-runtime';
import {
  completeIncidentAction,
  failIncidentAction,
  getIncidentOrThrow,
  refreshIncident,
  saveAndRefreshIncident,
  startIncidentAction,
} from '../incidents';
import { actorName, getConfig, saveIncident } from '../store';
import { approveCommentIfReal, isDemoComment } from './comment-helpers';

const countLabel = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? '' : 's'}`;

const targetIdsFrom = (
  action: IncidentAction,
  normalize: (value: string) => string
) => {
  const rawIds = action.targetIds?.filter(Boolean) ?? [];
  if (rawIds.length === 0) throw new Error('Action has no targets to undo');

  return Array.from(new Set(rawIds.map(normalize)));
};

const markComments = (
  incident: Incident,
  commentIds: string[],
  patch: Partial<Incident['flaggedComments'][number]>
) => {
  const targetIds = new Set(commentIds.map(normalizeCommentId));

  return {
    ...incident,
    flaggedComments: incident.flaggedComments.map((comment) =>
      targetIds.has(normalizeCommentId(comment.id))
        ? { ...comment, ...patch }
        : comment
    ),
  };
};

const completeCommentUndo = async ({
  actionId,
  incident,
  patch,
  successDetail,
  targetIds,
}: {
  actionId: string;
  incident: Incident;
  patch: Partial<Incident['flaggedComments'][number]>;
  successDetail: string;
  targetIds: string[];
}) => {
  const withAction = await completeIncidentAction(incident.postId, actionId, {
    detail: successDetail,
    status: 'succeeded',
    targetIds,
  }, `Undo action recorded but failed to refresh incident ${incident.postId}`);
  return saveAndRefreshIncident(
    markComments(withAction, targetIds, patch),
    `Undo action recorded but failed to refresh incident ${incident.postId}`
  );
};

const runCommentUndo = async ({
  incident,
  patch,
  pendingDetail,
  run,
  successDetail,
  targetIds,
  type,
}: {
  incident: Incident;
  patch: Partial<Incident['flaggedComments'][number]>;
  pendingDetail: string;
  run: () => ReturnType<typeof runTargetedRedditActions>;
  successDetail: (count: number, failureSummary?: string | undefined) => string;
  targetIds: string[];
  type: IncidentActionType;
}) => {
  const { actionId } = await startIncidentAction(incident.postId, {
    type,
    actor: await actorName(),
    detail: pendingDetail,
    targetIds,
  });
  const actionResults = await run();
  try {
    throwIfNoTargetSucceeded(actionResults, 'No comment undo target was updated');
  } catch (error) {
    await failIncidentAction(
      incident.postId,
      actionId,
      error,
      `Undo action failed to record failure state for ${incident.postId}`,
      { detail: pendingDetail, targetIds }
    );
    throw error;
  }
  const actedTargetIds = successfulTargetIds(actionResults);
  return completeCommentUndo({
    actionId,
    incident,
    patch,
    successDetail: successDetail(
      actedTargetIds.length,
      failedTargetSummary(actionResults)
    ),
    targetIds: actedTargetIds,
  });
};

const applyCommentToggle = async ({
  action,
  incident,
  targetIds,
}: {
  action: IncidentAction;
  incident: Incident;
  targetIds: string[];
}) => {
  const config = await getConfig(incident.subredditName);

  if (
    (action.type === 'comment_removed' ||
      action.type === 'comment_spammed' ||
      action.type === 'comment_thread_removed') &&
    config.actionControls.approveComments
  ) {
    return runCommentUndo({
      incident,
      pendingDetail: `Undo removal: approve ${countLabel(targetIds.length, 'comment')}`,
      patch: { removed: false, reviewed: true, spam: false },
      run: () =>
        runTargetedRedditActions(targetIds, (targetId) =>
          approveCommentIfReal(incident, targetId)
        ),
      successDetail: (count, failureSummary) =>
        [
          `Undid removal: approved ${countLabel(count, 'comment')}`,
          failureSummary,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · '),
      targetIds,
      type: 'comment_approved',
    });
  }

  if (
    action.type === 'comment_removed' ||
    action.type === 'comment_spammed' ||
    action.type === 'comment_thread_removed'
  ) {
    throw new Error('Comment approvals are disabled in Settings');
  }

  if (
    (action.type === 'comment_locked' || action.type === 'comment_unlocked') &&
    !config.actionControls.lockComments
  ) {
    throw new Error('Comment locking is disabled in Settings');
  }

  if (
    (action.type === 'comment_reports_ignored' ||
      action.type === 'comment_reports_unignored') &&
    !config.actionControls.ignoreCommentReports
  ) {
    throw new Error('Comment report controls are disabled in Settings');
  }

  const run = () =>
    runTargetedRedditActions(targetIds, async (targetId) => {
      if (isDemoComment(incident, targetId)) return;

      const comment = await readRedditComment(targetId);
      if (action.type === 'comment_locked') await comment.unlock();
      if (action.type === 'comment_unlocked') await comment.lock();
      if (action.type === 'comment_reports_ignored') {
        await comment.unignoreReports();
      }
      if (action.type === 'comment_reports_unignored') {
        await comment.ignoreReports();
      }
    });

  if (action.type === 'comment_locked') {
    return runCommentUndo({
      incident,
      patch: { locked: false },
      pendingDetail: `Undo lock: unlock ${countLabel(targetIds.length, 'comment')}`,
      run,
      successDetail: (count, failureSummary) =>
        [
          `Undid lock: unlocked ${countLabel(count, 'comment')}`,
          failureSummary,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · '),
      targetIds,
      type: 'comment_unlocked',
    });
  }
  if (action.type === 'comment_unlocked') {
    return runCommentUndo({
      incident,
      patch: { locked: true },
      pendingDetail: `Undo unlock: lock ${countLabel(targetIds.length, 'comment')}`,
      run,
      successDetail: (count, failureSummary) =>
        [
          `Undid unlock: locked ${countLabel(count, 'comment')}`,
          failureSummary,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · '),
      targetIds,
      type: 'comment_locked',
    });
  }
  if (action.type === 'comment_reports_ignored') {
    return runCommentUndo({
      incident,
      patch: { ignoringReports: false },
      pendingDetail: `Undo ignore reports on ${countLabel(targetIds.length, 'comment')}`,
      run,
      successDetail: (count, failureSummary) =>
        [
          `Undid ignore reports on ${countLabel(count, 'comment')}`,
          failureSummary,
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · '),
      targetIds,
      type: 'comment_reports_unignored',
    });
  }

  return runCommentUndo({
    incident,
    patch: { ignoringReports: true },
    pendingDetail: `Undo unignore reports on ${countLabel(targetIds.length, 'comment')}`,
    run,
    successDetail: (count, failureSummary) =>
      [
        `Undid unignore reports on ${countLabel(count, 'comment')}`,
        failureSummary,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
    targetIds,
    type: 'comment_reports_ignored',
  });
};

const runPostUndo = async ({
  action,
  incident,
  pendingDetail,
  postFlairAfter,
  postFlairBefore,
  successDetail,
  type,
}: {
  action: () => Promise<void>;
  incident: Incident;
  pendingDetail: string;
  postFlairAfter?: PostFlairState | undefined;
  postFlairBefore?: PostFlairState | undefined;
  successDetail: string;
  type: IncidentActionType;
}) => {
  const { actionId } = await startIncidentAction(incident.postId, {
    type,
    actor: await actorName(),
    detail: pendingDetail,
    postFlairAfter,
    postFlairBefore,
    targetIds: [incident.postId],
  });
  try {
    await action();
  } catch (error) {
    await failIncidentAction(
      incident.postId,
      actionId,
      error,
      `Post undo failed to record failure state for ${incident.postId}`,
      { detail: pendingDetail, postFlairBefore, targetIds: [incident.postId] }
    );
    throw error;
  }
  return completeIncidentAction(
    incident.postId,
    actionId,
    {
      detail: successDetail,
      postFlairAfter,
      postFlairBefore,
      status: 'succeeded',
      targetIds: [incident.postId],
    },
    `Post undo action recorded but failed to refresh incident ${incident.postId}`
  );
};

const restorePostFlair = async (
  incident: Incident,
  flair: PostFlairState | undefined
) => {
  const postId = normalizePostId(incident.postId);
  if (!flair) {
    await reddit.removePostFlair(incident.subredditName, postId);
    return;
  }

  await reddit.setPostFlair({
    flairTemplateId: flair.templateId,
    postId,
    subredditName: incident.subredditName,
    text: flair.text,
  });
};

const applyPostToggle = async ({
  action,
  incident,
}: {
  action: IncidentAction;
  incident: Incident;
}) => {
  const config = await getConfig(incident.subredditName);

  if (
    (action.type === 'post_removed' || action.type === 'post_spammed') &&
    !config.actionControls.approvePosts
  ) {
    throw new Error('Post approvals are disabled in Settings');
  }
  if (action.type === 'locked' && !config.actionControls.unlockPost) {
    throw new Error('Post unlocking is disabled in Settings');
  }
  if (action.type === 'post_unlocked' && !config.actionControls.lockPost) {
    throw new Error('Post locking is disabled in Settings');
  }
  if (
    (action.type === 'post_marked_nsfw' ||
      action.type === 'post_nsfw' ||
      action.type === 'post_unmarked_nsfw') &&
    !config.actionControls.markPostNsfw
  ) {
    throw new Error('NSFW actions are disabled in Settings');
  }
  if (
    (action.type === 'post_marked_spoiler' ||
      action.type === 'post_spoiler' ||
      action.type === 'post_unmarked_spoiler') &&
    !config.actionControls.markPostSpoiler
  ) {
    throw new Error('Spoiler actions are disabled in Settings');
  }
  if (
    (action.type === 'post_reports_ignored' ||
      action.type === 'post_reports_unignored') &&
    !config.actionControls.ignoreReports
  ) {
    throw new Error('Post report controls are disabled in Settings');
  }
  if (
    (action.type === 'post_flaired' ||
      action.type === 'post_flair_removed') &&
    !config.actionControls.setPostFlair
  ) {
    throw new Error('Post flair changes are disabled in Settings');
  }

  if (action.type === 'post_removed' || action.type === 'post_spammed') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.approve();
      },
      incident,
      pendingDetail: 'Undo removal: approve post',
      successDetail: 'Undid removal: approved post',
      type: 'post_approved',
    });
  }
  if (action.type === 'locked') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.unlock();
      },
      incident,
      pendingDetail: 'Undo lock: unlock post',
      successDetail: 'Undid lock: unlocked post',
      type: 'post_unlocked',
    });
  }
  if (action.type === 'post_unlocked') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.lock();
      },
      incident,
      pendingDetail: 'Undo unlock: lock post',
      successDetail: 'Undid unlock: locked post',
      type: 'locked',
    });
  }
  if (action.type === 'post_marked_nsfw' || action.type === 'post_nsfw') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.unmarkAsNsfw();
      },
      incident,
      pendingDetail: 'Undo NSFW tag',
      successDetail: 'Undid NSFW tag',
      type: 'post_unmarked_nsfw',
    });
  }
  if (action.type === 'post_unmarked_nsfw') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.markAsNsfw();
      },
      incident,
      pendingDetail: 'Undo NSFW removal',
      successDetail: 'Undid NSFW removal',
      type: 'post_marked_nsfw',
    });
  }
  if (action.type === 'post_marked_spoiler' || action.type === 'post_spoiler') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.unmarkAsSpoiler();
      },
      incident,
      pendingDetail: 'Undo spoiler tag',
      successDetail: 'Undid spoiler tag',
      type: 'post_unmarked_spoiler',
    });
  }
  if (action.type === 'post_unmarked_spoiler') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.markAsSpoiler();
      },
      incident,
      pendingDetail: 'Undo spoiler removal',
      successDetail: 'Undid spoiler removal',
      type: 'post_marked_spoiler',
    });
  }
  if (action.type === 'post_reports_ignored') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.unignoreReports();
      },
      incident,
      pendingDetail: 'Undo ignore reports on post',
      successDetail: 'Undid ignore reports on post',
      type: 'post_reports_unignored',
    });
  }
  if (action.type === 'post_reports_unignored') {
    return runPostUndo({
      action: async () => {
        const post = await readRedditPost(incident.postId);
        await post.ignoreReports();
      },
      incident,
      pendingDetail: 'Undo unignore reports on post',
      successDetail: 'Undid unignore reports on post',
      type: 'post_reports_ignored',
    });
  }
  if (action.type === 'post_flaired') {
    const detail = action.postFlairBefore
      ? `Restored previous flair "${action.postFlairBefore.text}"`
      : 'Removed post flair';
    return runPostUndo({
      action: () => restorePostFlair(incident, action.postFlairBefore),
      incident,
      postFlairAfter: action.postFlairBefore,
      postFlairBefore: incident.postState?.flair,
      pendingDetail: 'Undo post flair change',
      successDetail: detail,
      type: action.postFlairBefore ? 'post_flaired' : 'post_flair_removed',
    });
  }
  if (action.type === 'post_flair_removed') {
    if (!action.postFlairBefore) {
      throw new Error('This flair removal has no previous flair to restore');
    }

    return runPostUndo({
      action: () => restorePostFlair(incident, action.postFlairBefore),
      incident,
      postFlairAfter: action.postFlairBefore,
      postFlairBefore: incident.postState?.flair,
      pendingDetail: 'Undo post flair removal',
      successDetail: `Restored flair "${action.postFlairBefore.text}"`,
      type: 'post_flaired',
    });
  }

  throw new Error('This action cannot be undone from Firewatch');
};

export const undoIncidentAction = async (postId: string, actionId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const sourceIncident = await refreshIncident(
    await getIncidentOrThrow(normalizedPostId)
  );
  await saveIncident(sourceIncident);

  const action = sourceIncident.actions.find((item) => item.id === actionId);
  if (!action) throw new Error('Action was not found');
  if (!actionCompleted(action)) {
    throw new Error('Only completed actions can be undone from Firewatch');
  }
  if (!undoActionLabel(action.type)) {
    throw new Error('This action cannot be undone from Firewatch');
  }

  if (action.type.startsWith('comment_')) {
    return applyCommentToggle({
      action,
      incident: sourceIncident,
      targetIds: targetIdsFrom(action, normalizeCommentId),
    });
  }

  return applyPostToggle({
    action,
    incident: sourceIncident,
  });
};
