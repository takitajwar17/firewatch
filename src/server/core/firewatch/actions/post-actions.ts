import { reddit } from '@devvit/web/server';
import type { NativePostAction, PostFlairState } from '../../../../shared/api';
import {
  nativePostActionType,
  parseCrowdControlLevel,
  postActionControl,
  postActionDetail,
} from '../../../../shared/reddit-actions';
import { normalizePostId } from '../../firewatch-utils';
import { appendAction, getIncidentOrThrow } from '../incidents';
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
  const flairBefore = postFlairState(post.flair);
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
    case 'clear-flair':
      if (!flairBefore) {
        throw new Error('Post has no flair to remove');
      }
      await reddit.removePostFlair(incident.subredditName, normalizedPostId);
      break;
  }

  const flairAfter =
    values.action === 'set-flair' && (flairText || flairTemplateId)
      ? {
          text: flairText ?? flairBefore?.text ?? '',
          templateId: flairTemplateId,
        }
      : undefined;

  return appendAction(normalizedPostId, {
    type: nativePostActionType(values.action),
    actor,
    detail: postActionDetail({
      action: values.action,
      crowdControlLevel,
      flairText,
      reason,
    }),
    postFlairAfter: flairAfter,
    postFlairBefore:
      values.action === 'set-flair' || values.action === 'clear-flair'
        ? flairBefore
        : undefined,
    targetIds: [normalizedPostId],
  });
};
