import type { Incident } from '../../../shared/api';
import {
  getReportIgnoreState,
  isReportSignalIgnored,
} from '../../../shared/incidents';
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
  const reportIgnoreState = getReportIgnoreState(incident);

  return incident.recentSignals.filter((signal) => {
    if (!inWindow(signal.createdAt, windowMinutes)) return false;
    if (signal.type !== 'comment_report' && signal.type !== 'post_report') {
      return false;
    }
    return !isReportSignalIgnored(signal, reportIgnoreState);
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
