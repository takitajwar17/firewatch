import type { Incident } from './api';

const openCommentCount = (incident: Incident) =>
  incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;

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
