import { reddit } from '@devvit/web/server';
import type {
  Incident,
  IncidentAction,
  IncidentActionType,
  PostFlairState,
} from '../../../../shared/api';
import { undoActionLabel } from '../../../../shared/reddit-actions';
import { normalizeCommentId, normalizePostId } from '../../firewatch-utils';
import {
  appendAction,
  getIncidentOrThrow,
  refreshIncident,
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

const saveCommentUndo = async ({
  detail,
  incident,
  patch,
  targetIds,
  type,
}: {
  detail: string;
  incident: Incident;
  patch: Partial<Incident['flaggedComments'][number]>;
  targetIds: string[];
  type: IncidentActionType;
}) => {
  const withAction = await appendAction(incident.postId, {
    type,
    actor: await actorName(),
    detail,
    targetIds,
  });
  const refreshedIncident = await refreshIncident(
    markComments(withAction, targetIds, patch)
  );

  await saveIncident(refreshedIncident);
  return refreshedIncident;
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
    await Promise.all(
      targetIds.map((targetId) => approveCommentIfReal(incident, targetId))
    );
    return saveCommentUndo({
      detail: `Undid removal: approved ${countLabel(targetIds.length, 'comment')}`,
      incident,
      patch: { removed: false, reviewed: true, spam: false },
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

  await Promise.all(
    targetIds.map(async (targetId) => {
      if (isDemoComment(incident, targetId)) return;

      const comment = await reddit.getCommentById(normalizeCommentId(targetId));
      if (action.type === 'comment_locked') await comment.unlock();
      if (action.type === 'comment_unlocked') await comment.lock();
      if (action.type === 'comment_reports_ignored') {
        await comment.unignoreReports();
      }
      if (action.type === 'comment_reports_unignored') {
        await comment.ignoreReports();
      }
    })
  );

  if (action.type === 'comment_locked') {
    return saveCommentUndo({
      detail: `Undid lock: unlocked ${countLabel(targetIds.length, 'comment')}`,
      incident,
      patch: { locked: false },
      targetIds,
      type: 'comment_unlocked',
    });
  }
  if (action.type === 'comment_unlocked') {
    return saveCommentUndo({
      detail: `Undid unlock: locked ${countLabel(targetIds.length, 'comment')}`,
      incident,
      patch: { locked: true },
      targetIds,
      type: 'comment_locked',
    });
  }
  if (action.type === 'comment_reports_ignored') {
    return saveCommentUndo({
      detail: `Undid ignore reports on ${countLabel(targetIds.length, 'comment')}`,
      incident,
      patch: { ignoringReports: false },
      targetIds,
      type: 'comment_reports_unignored',
    });
  }

  return saveCommentUndo({
    detail: `Undid unignore reports on ${countLabel(targetIds.length, 'comment')}`,
    incident,
    patch: { ignoringReports: true },
    targetIds,
    type: 'comment_reports_ignored',
  });
};

const appendPostUndo = async ({
  detail,
  incident,
  postFlairAfter,
  postFlairBefore,
  type,
}: {
  detail: string;
  incident: Incident;
  postFlairAfter?: PostFlairState | undefined;
  postFlairBefore?: PostFlairState | undefined;
  type: IncidentActionType;
}) =>
  appendAction(incident.postId, {
    type,
    actor: await actorName(),
    detail,
    postFlairAfter,
    postFlairBefore,
    targetIds: [incident.postId],
  });

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
  const post = await reddit.getPostById(normalizePostId(incident.postId));

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
    await post.approve();
    return appendPostUndo({
      detail: 'Undid removal: approved post',
      incident,
      type: 'post_approved',
    });
  }
  if (action.type === 'locked') {
    await post.unlock();
    return appendPostUndo({
      detail: 'Undid lock: unlocked post',
      incident,
      type: 'post_unlocked',
    });
  }
  if (action.type === 'post_unlocked') {
    await post.lock();
    return appendPostUndo({
      detail: 'Undid unlock: locked post',
      incident,
      type: 'locked',
    });
  }
  if (action.type === 'post_marked_nsfw' || action.type === 'post_nsfw') {
    await post.unmarkAsNsfw();
    return appendPostUndo({
      detail: 'Undid NSFW tag',
      incident,
      type: 'post_unmarked_nsfw',
    });
  }
  if (action.type === 'post_unmarked_nsfw') {
    await post.markAsNsfw();
    return appendPostUndo({
      detail: 'Undid NSFW removal',
      incident,
      type: 'post_marked_nsfw',
    });
  }
  if (action.type === 'post_marked_spoiler' || action.type === 'post_spoiler') {
    await post.unmarkAsSpoiler();
    return appendPostUndo({
      detail: 'Undid spoiler tag',
      incident,
      type: 'post_unmarked_spoiler',
    });
  }
  if (action.type === 'post_unmarked_spoiler') {
    await post.markAsSpoiler();
    return appendPostUndo({
      detail: 'Undid spoiler removal',
      incident,
      type: 'post_marked_spoiler',
    });
  }
  if (action.type === 'post_reports_ignored') {
    await post.unignoreReports();
    return appendPostUndo({
      detail: 'Undid ignore reports on post',
      incident,
      type: 'post_reports_unignored',
    });
  }
  if (action.type === 'post_reports_unignored') {
    await post.ignoreReports();
    return appendPostUndo({
      detail: 'Undid unignore reports on post',
      incident,
      type: 'post_reports_ignored',
    });
  }
  if (action.type === 'post_flaired') {
    await restorePostFlair(incident, action.postFlairBefore);
    return appendPostUndo({
      detail: action.postFlairBefore
        ? `Restored previous flair "${action.postFlairBefore.text}"`
        : 'Removed post flair',
      incident,
      postFlairAfter: action.postFlairBefore,
      postFlairBefore: incident.postState?.flair,
      type: action.postFlairBefore ? 'post_flaired' : 'post_flair_removed',
    });
  }
  if (action.type === 'post_flair_removed') {
    if (!action.postFlairBefore) {
      throw new Error('This flair removal has no previous flair to restore');
    }

    await restorePostFlair(incident, action.postFlairBefore);
    return appendPostUndo({
      detail: `Restored flair "${action.postFlairBefore.text}"`,
      incident,
      postFlairAfter: action.postFlairBefore,
      postFlairBefore: incident.postState?.flair,
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
