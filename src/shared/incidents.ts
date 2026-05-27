import type { FlaggedComment, Incident } from './api';

export type RedditCommentId = `t1_${string}`;
export type RedditPostId = `t3_${string}`;

export const normalizePostId = (postId: string): RedditPostId =>
  postId.startsWith('t3_') ? `t3_${postId.slice(3)}` : `t3_${postId}`;

export const normalizeCommentId = (commentId: string): RedditCommentId =>
  commentId.startsWith('t1_')
    ? `t1_${commentId.slice(3)}`
    : `t1_${commentId}`;

export const normalizeOptionalPostId = (postId: string | undefined) =>
  postId ? normalizePostId(postId) : undefined;

export const normalizeOptionalCommentId = (commentId: string | undefined) =>
  commentId ? normalizeCommentId(commentId) : undefined;

export const normalizeParentId = (
  parentId: string | undefined,
  postId?: string
) => {
  if (!parentId) return undefined;
  if (parentId.startsWith('t1_')) return normalizeCommentId(parentId);
  if (parentId.startsWith('t3_')) return normalizePostId(parentId);
  if (postId && normalizePostId(parentId) === normalizePostId(postId)) {
    return normalizePostId(parentId);
  }
  return normalizeCommentId(parentId);
};

export const sameCommentId = (
  left: string | undefined,
  right: string | undefined
) => {
  if (!left || !right) return false;
  return normalizeCommentId(left) === normalizeCommentId(right);
};

export const samePostId = (
  left: string | undefined,
  right: string | undefined
) => {
  if (!left || !right) return false;
  return normalizePostId(left) === normalizePostId(right);
};

export const isCommentOpenForReview = (comment: FlaggedComment) =>
  !comment.removed && !comment.reviewed && !comment.approved && !comment.spam;

export const openCommentsForReview = (incident: Incident) =>
  incident.flaggedComments.filter(isCommentOpenForReview);

export const openCommentCount = (incident: Incident) =>
  openCommentsForReview(incident).length;

export const currentReportCount = (incident: Incident) =>
  incident.stats.currentReportSignals ?? incident.stats.reportSignals;

const reviewWorkScore = (incident: Incident) =>
  openCommentCount(incident) * 100 +
  (incident.safetyReview ? 160 : 0) +
  currentReportCount(incident) * 12 +
  incident.stats.suspiciousLinkHits * 8 +
  incident.stats.keywordHits * 4 +
  incident.score;

export const sortIncidentsByPriority = (incidents: Incident[]) =>
  [...incidents].sort(
    (a, b) =>
      reviewWorkScore(b) - reviewWorkScore(a) ||
      b.score - a.score ||
      b.updatedAt - a.updatedAt
  );
