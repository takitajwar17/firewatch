import { reddit } from '@devvit/web/server';
import type { Incident } from '../../../../shared/api';
import { normalizeCommentId, normalizePostId } from '../../firewatch-utils';
import { isDemoCommentSnapshot } from '../incidents';
import { readRedditComment } from '../reddit-runtime';

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

  const comment = await readRedditComment(normalizedCommentId);
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

export const approveCommentIfReal = async (
  incident: Incident,
  commentId: string
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await readRedditComment(normalizedCommentId);
  await comment.approve();
  return true;
};

export const collectThreadCommentIds = async (
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
