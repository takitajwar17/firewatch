import type { FlaggedComment, Incident } from './api';

export const isCommentOpenForReview = (comment: FlaggedComment) =>
  !comment.removed && !comment.reviewed;

export const openCommentsForReview = (incident: Incident) =>
  incident.flaggedComments.filter(isCommentOpenForReview);

export const openCommentCount = (incident: Incident) =>
  openCommentsForReview(incident).length;

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
