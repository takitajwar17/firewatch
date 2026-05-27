import type {
  FlaggedComment,
  Incident,
  IncidentPostState,
  IncidentSignal,
} from './api';
import { actionCompleted } from './reddit-actions.js';

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

export type ReportIgnoreState = {
  ignoredCommentIds: Set<string>;
  postReportsIgnored: boolean;
};

export const getReportIgnoreState = (
  incident: Incident,
  postState: IncidentPostState | undefined = incident.postState
): ReportIgnoreState => {
  const latestCommentReportActionById = new Map<
    string,
    'ignored' | 'unignored'
  >();

  for (const action of [...incident.actions].sort(
    (left, right) => right.createdAt - left.createdAt
  )) {
    if (
      action.type !== 'comment_reports_ignored' &&
      action.type !== 'comment_reports_unignored'
    ) {
      continue;
    }
    if (!actionCompleted(action)) continue;

    for (const targetId of action.targetIds ?? []) {
      const normalizedTargetId = normalizeCommentId(targetId);
      if (latestCommentReportActionById.has(normalizedTargetId)) continue;
      latestCommentReportActionById.set(
        normalizedTargetId,
        action.type === 'comment_reports_ignored' ? 'ignored' : 'unignored'
      );
    }
  }

  const latestPostReportAction = [...incident.actions]
    .sort((left, right) => right.createdAt - left.createdAt)
    .find(
      (action) =>
        actionCompleted(action) &&
        (action.type === 'post_reports_ignored' ||
          action.type === 'post_reports_unignored')
    );

  return {
    ignoredCommentIds: new Set(
      Array.from(latestCommentReportActionById.entries())
        .filter(([, state]) => state === 'ignored')
        .map(([commentId]) => commentId)
    ),
    postReportsIgnored:
      latestPostReportAction?.type === 'post_reports_ignored' ||
      (latestPostReportAction ? false : postState?.ignoringReports === true),
  };
};

export const isReportSignalIgnored = (
  signal: IncidentSignal,
  reportIgnoreState: ReportIgnoreState
) => {
  if (signal.type === 'post_report') {
    return reportIgnoreState.postReportsIgnored;
  }
  if (signal.type !== 'comment_report' || !signal.commentId) return false;
  return reportIgnoreState.ignoredCommentIds.has(
    normalizeCommentId(signal.commentId)
  );
};

const reviewWorkScore = (incident: Incident) =>
  openCommentCount(incident) * 100 +
  (incident.safetyReview ? 160 : 0) +
  incident.stats.reportSignals * 12 +
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
