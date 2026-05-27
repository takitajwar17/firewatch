import type { Incident } from '../../../shared/api';
import { actionCompleted } from '../../../shared/reddit-actions';
import {
  watchedDomainMatches,
  watchedWordMatches,
} from '../firewatch-detection';
import {
  normalizeCommentId,
  normalizeUsername,
  now,
  usernameKey,
} from '../firewatch-utils';
import { compare } from './common';

export const watchedWordHits = (text: string, keywords: string[]) => {
  return watchedWordMatches(text, keywords).reduce(
    (total, match) => total + match.count,
    0
  );
};

export const watchedDomainHits = (text: string, domains: string[]) => {
  return watchedDomainMatches(text, domains).reduce(
    (total, match) => total + match.count,
    0
  );
};

export const inWindow = (timestamp: number, windowMinutes?: number) => {
  if (!windowMinutes) return true;
  return timestamp >= now() - windowMinutes * 60 * 1000;
};

export const removedCommentCountForUser = (
  incident: Incident,
  username: string,
  windowMinutes?: number
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return 0;
  const normalizedUserKey = usernameKey(normalizedUsername);
  const commentAuthors = new Map(
    incident.flaggedComments.map((comment) => [
      normalizeCommentId(comment.id),
      usernameKey(comment.author),
    ])
  );

  return incident.actions.filter((action) => {
    if (
      action.type !== 'comment_removed' &&
      action.type !== 'comment_spammed' &&
      action.type !== 'comment_thread_removed' &&
      action.type !== 'user_content_removed' &&
      action.type !== 'user_banned'
    ) {
      return false;
    }
    if (!inWindow(action.createdAt, windowMinutes)) return false;
    return (action.targetIds ?? []).some((targetId) => {
      if (targetId.startsWith('t3_')) return false;
      return (
        commentAuthors.get(normalizeCommentId(targetId)) ===
        normalizedUserKey
      );
    });
  }).length;
};

export const reportCountInWindow = (
  incident: Incident,
  windowMinutes?: number
) => {
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

  const ignoredCommentIds = new Set(
    Array.from(latestCommentReportActionById.entries())
      .filter(([, state]) => state === 'ignored')
      .map(([commentId]) => commentId)
  );
  const latestPostReportAction = [...incident.actions]
    .sort((left, right) => right.createdAt - left.createdAt)
    .find(
      (action) =>
        actionCompleted(action) &&
        (action.type === 'post_reports_ignored' ||
          action.type === 'post_reports_unignored')
    );
  const postReportsIgnored =
    latestPostReportAction?.type === 'post_reports_ignored' ||
    (latestPostReportAction
      ? false
      : incident.postState?.ignoringReports === true);

  return incident.recentSignals.filter((signal) => {
    if (!inWindow(signal.createdAt, windowMinutes)) return false;
    if (signal.type === 'post_report') return !postReportsIgnored;
    if (signal.type !== 'comment_report' || !signal.commentId) return false;
    return !ignoredCommentIds.has(normalizeCommentId(signal.commentId));
  }).length;
};

export const compareConditionValue = ({
  actual,
  label,
  operator,
  expected,
}: {
  actual: number;
  expected: number;
  label: string;
  operator: '>=' | '>' | '=';
}) =>
  compare(actual, operator, expected)
    ? `${label} ${operator} ${expected} (${actual})`
    : undefined;
