import { reddit } from '@devvit/web/server';
import type {
  Incident,
  IncidentPostState,
  NativePostAction,
  PostFlairState,
} from '../../../../shared/api';
import {
  nativePostActionType,
  parseCrowdControlLevel,
  postActionControl,
  postActionDetail,
} from '../../../../shared/reddit-actions';
import { normalizePostId } from '../../firewatch-utils';
import {
  completeIncidentAction,
  failIncidentAction,
  getIncidentOrThrow,
  saveAndRefreshIncident,
  startIncidentAction,
} from '../incidents';
import { readRedditPost } from '../reddit-runtime';
import { actorName, getConfig } from '../store';
import { trimRemovalNote } from './comment-helpers';

const postFlairState = (
  flair: {
    backgroundColor?: string | undefined;
    templateId?: string | undefined;
    text?: string | undefined;
    textColor?: string | undefined;
  } | undefined
): PostFlairState | undefined => {
  if (!flair) return undefined;

  const text = flair.text?.trim();
  if (!text) return undefined;

  return {
    text,
    templateId: flair.templateId,
    backgroundColor: flair.backgroundColor,
    textColor: flair.textColor,
  };
};

const postStateFromPost = (post: {
  approved: boolean;
  flair?: {
    backgroundColor?: string | undefined;
    templateId?: string | undefined;
    text?: string | undefined;
    textColor?: string | undefined;
  } | undefined;
  ignoringReports: boolean;
  locked: boolean;
  nsfw: boolean;
  removed: boolean;
  spam: boolean;
  spoiler: boolean;
}): IncidentPostState => {
  const flair = postFlairState(post.flair);
  const base = {
    approved: post.approved,
    ignoringReports: post.ignoringReports,
    locked: post.locked,
    nsfw: post.nsfw,
    removed: post.removed,
    spam: post.spam,
    spoiler: post.spoiler,
  };

  return flair ? { ...base, flair } : base;
};

const fallbackPostStateAfterAction = ({
  action,
  flairAfter,
  state,
}: {
  action: NativePostAction;
  flairAfter: PostFlairState | undefined;
  state: IncidentPostState | undefined;
}): IncidentPostState | undefined => {
  if (!state) return undefined;
  const base = { ...state };

  if (action === 'approve') {
    return { ...base, approved: true, removed: false, spam: false };
  }
  if (action === 'remove') {
    return { ...base, approved: false, removed: true, spam: false };
  }
  if (action === 'spam') {
    return { ...base, approved: false, removed: true, spam: true };
  }
  if (action === 'unlock') return { ...base, locked: false };
  if (action === 'mark-nsfw') return { ...base, nsfw: true };
  if (action === 'unmark-nsfw') return { ...base, nsfw: false };
  if (action === 'mark-spoiler') return { ...base, spoiler: true };
  if (action === 'unmark-spoiler') return { ...base, spoiler: false };
  if (action === 'ignore-reports') return { ...base, ignoringReports: true };
  if (action === 'unignore-reports') return { ...base, ignoringReports: false };
  if (action === 'set-flair' && flairAfter) return { ...base, flair: flairAfter };
  if (action === 'clear-flair') {
    return {
      approved: base.approved,
      ignoringReports: base.ignoringReports,
      locked: base.locked,
      nsfw: base.nsfw,
      removed: base.removed,
      spam: base.spam,
      spoiler: base.spoiler,
    };
  }

  return state;
};

const withPostState = (
  incident: Incident,
  postState: IncidentPostState | undefined
) => (postState ? { ...incident, postState } : incident);

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
  const post = await readRedditPost(normalizedPostId);
  const flairBefore = postFlairState(post.flair);
  const reason = values.reason?.trim();
  const removalNote = trimRemovalNote(reason);
  const flairTemplateId = values.flairTemplateId?.trim() || undefined;
  const flairText = values.flairText?.trim().slice(0, 64) || undefined;
  const crowdControlLevel = parseCrowdControlLevel(values.crowdControlLevel);

  if (values.action === 'set-flair' && !flairTemplateId && !flairText) {
    throw new Error('Select a post flair or enter flair text first');
  }
  if (values.action === 'clear-flair' && !flairBefore) {
    throw new Error('Post has no flair to remove');
  }

  const detail = postActionDetail({
    action: values.action,
    crowdControlLevel,
    flairText,
    reason,
  });
  let flairAfter: PostFlairState | undefined =
    values.action === 'set-flair' && flairText
      ? {
          text: flairText,
          templateId: flairTemplateId,
        }
      : undefined;
  let postStateAfter: IncidentPostState | undefined;

  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: nativePostActionType(values.action),
    actor,
    detail,
    postFlairAfter: flairAfter,
    postFlairBefore:
      values.action === 'set-flair' || values.action === 'clear-flair'
        ? flairBefore
        : undefined,
    targetIds: [normalizedPostId],
  });

  try {
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
        await reddit.setPostFlair({
          flairTemplateId,
          postId: normalizedPostId,
          subredditName: incident.subredditName,
          text: flairText,
        });
        break;
      case 'clear-flair':
        await reddit.removePostFlair(incident.subredditName, normalizedPostId);
        break;
    }
    try {
      const postAfter = await readRedditPost(normalizedPostId);
      postStateAfter = postStateFromPost(postAfter);
      if (values.action === 'set-flair' || values.action === 'clear-flair') {
        flairAfter = postFlairState(postAfter.flair);
      }
    } catch {
      postStateAfter = fallbackPostStateAfterAction({
        action: values.action,
        flairAfter,
        state: incident.postState,
      });
    }
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Post action ${values.action} failed to record failure state for ${normalizedPostId}`,
      {
        detail,
        postFlairBefore:
          values.action === 'set-flair' || values.action === 'clear-flair'
            ? flairBefore
            : undefined,
        targetIds: [normalizedPostId],
      }
    );
    throw error;
  }

  const withAction = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      postFlairAfter: flairAfter,
      status: 'succeeded',
    },
    `Post action ${values.action} succeeded but failed to refresh incident ${normalizedPostId}`
  );

  const patchedIncident = withPostState(withAction, postStateAfter);
  if (patchedIncident === withAction) return withAction;

  return saveAndRefreshIncident(
    patchedIncident,
    `Post action ${values.action} updated local post state but failed to refresh incident ${normalizedPostId}`
  );
};
