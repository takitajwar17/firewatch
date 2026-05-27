import type {
  FirewatchConfig,
  FlaggedComment,
  Incident,
  IncidentPostState,
  IncidentImpactSnapshot,
  IncidentActionType,
  IncidentLevel,
  IncidentParticipant,
  IncidentStats,
  IncidentTrendPoint,
  RepeatedPhrase,
  ResponseSuggestion,
} from '../../../shared/api';
import { firewatchRatingSummary } from '../../../shared/firewatch-rating.js';
import { isCommentOpenForReview } from '../../../shared/incidents';
import { actionCompleted } from '../../../shared/reddit-actions';
import {
  MAX_INVOLVED_USERS,
  MAX_REPEATED_PHRASES,
  MAX_TREND_POINTS,
  STOP_WORDS,
} from '../firewatch-constants';
import {
  detectionTokens,
  watchedDomainMatches,
  watchedWordMatches,
} from '../firewatch-detection';
import { detectSafetyMatchesInText } from '../firewatch-safety';
import {
  isAppUsername,
  normalizeCommentId,
  normalizeUsername,
  now,
} from '../firewatch-utils';

export type PostSnapshot = {
  authorName?: string;
  score: number;
  numberOfComments: number;
  title: string;
  permalink?: string;
  subredditName: string;
  numberOfReports: number;
  createdAt?: number;
  postState?: IncidentPostState;
};

const isValidTimestamp = (timestamp: number | undefined): timestamp is number =>
  typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0;

export const minTimestamp = (...timestamps: (number | undefined)[]) => {
  const validTimestamps = timestamps.filter(isValidTimestamp);
  if (validTimestamps.length === 0) return undefined;
  return Math.min(...validTimestamps);
};

export const maxTimestamp = (...timestamps: (number | undefined)[]) => {
  const validTimestamps = timestamps.filter(isValidTimestamp);
  if (validTimestamps.length === 0) return undefined;
  return Math.max(...validTimestamps);
};

export const getLevel = (score: number, config: FirewatchConfig): IncidentLevel => {
  if (score >= config.wildfireThreshold) return 'wildfire';
  if (score >= config.fireThreshold) return 'fire';
  if (score >= config.heatThreshold) return 'heat';
  return 'watch';
};

export const countKeywordHits = (text: string, keywords: string[]) => {
  return watchedWordMatches(text, keywords).reduce(
    (total, match) => total + match.count,
    0
  );
};

export const countSuspiciousDomainHits = (text: string, domains: string[]) => {
  return watchedDomainMatches(text, domains).reduce(
    (total, match) => total + match.count,
    0
  );
};

const tokenize = (text: string) =>
  detectionTokens(text)
    .filter(
      (word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)
    );

export const extractRepeatedPhrases = (
  signals: Incident['recentSignals']
): RepeatedPhrase[] => {
  const phrases = new Map<
    string,
    {
      count: number;
      authors: Set<string>;
    }
  >();

  for (const signal of signals) {
    if (!signal.body) continue;

    const tokens = tokenize(signal.body);
    if (tokens.length < 2) continue;

    const seenInSignal = new Set<string>();
    const sizes = tokens.length >= 3 ? [3, 2] : [2];

    for (const size of sizes) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const phrase = tokens.slice(index, index + size).join(' ');
        if (seenInSignal.has(phrase)) continue;
        seenInSignal.add(phrase);

        const current = phrases.get(phrase) ?? {
          count: 0,
          authors: new Set<string>(),
        };
        current.count += 1;
        if (signal.author) current.authors.add(signal.author);
        phrases.set(phrase, current);
      }
    }
  }

  return Array.from(phrases.entries())
    .filter(([, value]) => value.count >= 2 && value.authors.size >= 2)
    .map(([phrase, value]) => ({
      phrase,
      count: value.count,
      authors: Array.from(value.authors).slice(0, 5),
    }))
    .sort((a, b) => b.authors.length - a.authors.length || b.count - a.count)
    .slice(0, MAX_REPEATED_PHRASES);
};

export const makeEmptyStats = (): IncidentStats => ({
  signalCount: 0,
  commentSignals: 0,
  reportSignals: 0,
  currentReportSignals: 0,
  currentCommentReports: 0,
  currentPostReports: 0,
  manualEscalations: 0,
  keywordHits: 0,
  suspiciousLinkHits: 0,
  branchPileOns: 0,
  repeatedPhraseHits: 0,
  removals: 0,
  flaggedCount: 0,
  uniqueParticipants: 0,
  commentsLastHour: 0,
  flaggedCommentsOmitted: 0,
  flaggedCommentsStored: 0,
  signalsOmitted: 0,
  signalsStored: 0,
});

export const makeEmptyImpact = (): IncidentImpactSnapshot => ({
  reportsGrouped: 0,
  commentsReviewed: 0,
  commentsAwaitingReview: 0,
  usersInReview: 0,
  usersResolved: 0,
  actionsTaken: 0,
  removals: 0,
  approvals: 0,
  bans: 0,
  handoffSaved: false,
  finalNoteSaved: false,
  timeOpenMinutes: 0,
  peakAttention: 0,
});

export const getResponseSuggestion = (
  score: number,
  level: IncidentLevel,
  status: Incident['status'],
  unresolvedCount = 0
): ResponseSuggestion => {
  if (status === 'locked' && unresolvedCount > 0) {
    return {
      label: 'Review remaining comments',
      detail:
        'The post is locked, but comments still need a mod decision before it can be resolved.',
      level,
      steps: [
        'Review the remaining unremoved comments.',
        'Approve acceptable comments or remove comments that break the rules.',
        'Mark resolved after no comments remain in review.',
      ],
    };
  }

  if (status === 'review') {
    return {
      label:
        unresolvedCount === 1
          ? 'Review 1 comment'
          : `Review ${unresolvedCount} comments`,
      detail:
        unresolvedCount === 1
          ? 'One comment still needs a mod decision before this post can be resolved.'
          : `${unresolvedCount} comments still need a mod decision before this post can be resolved.`,
      level,
      steps: [
        'Open Comments.',
        'Approve acceptable comments or remove comments that break the rules.',
        'Mark resolved after comment review is clear.',
      ],
    };
  }

  if (status === 'resolved') {
    return {
      label: 'No further action',
      detail:
        'This post has a saved final note and no comments left in review.',
      level,
      steps: [
        'Review the final mod note.',
        'Open the post if you need to check Reddit state.',
        'No further action is needed unless new reports or comments come in.',
      ],
    };
  }

  if (status === 'locked') {
    return {
      label: 'Save final note',
      detail:
        'The post is locked and comment review is clear. Save the final mod note to close it out.',
      level,
      steps: [
        'Save a handoff note if another mod may need context.',
        'Review the mod log for actions taken.',
        'Mark resolved to generate the final note.',
      ],
    };
  }

  return {
    label: 'Watch post',
    detail: `Firewatch rating is ${firewatchRatingSummary(score)}. Watch reports, comment volume, and repeated user wording.`,
    level,
    steps: [
      'Leave the post open.',
      'Watch new reports and user comments.',
      'Claim this post if more reports come in.',
    ],
  };
};

export const scoreComment = (
  signal: Incident['recentSignals'][number],
  config: FirewatchConfig
): FlaggedComment | undefined => {
  if (signal.source === 'firewatch_notice' || signal.source === 'mod_action') {
    return undefined;
  }
  if (!signal.commentId || !signal.body) return undefined;

  const reasons: string[] = [];
  let score = 0;
  const keywordHits = countKeywordHits(signal.body, config.keywords);
  const suspiciousHits = countSuspiciousDomainHits(
    signal.body,
    config.suspiciousDomains
  );
  const safetyMatches = detectSafetyMatchesInText(signal.body);

  if (keywordHits > 0) {
    score += keywordHits * config.signalWeights.watchedWords;
    reasons.push(
      `${keywordHits} watched word match${keywordHits > 1 ? 'es' : ''}`
    );
  }

  if (suspiciousHits > 0) {
    score += suspiciousHits * config.signalWeights.watchedDomains;
    reasons.push(
      `${suspiciousHits} watched domain match${suspiciousHits > 1 ? 'es' : ''}`
    );
  }

  if (signal.type === 'comment_report') {
    score += config.signalWeights.reports;
    reasons.push(signal.reason ? `reported: ${signal.reason}` : 'reported');
  }

  if (signal.type === 'automod_filter') {
    score += 18;
    reasons.push(
      signal.reason ? `AutoModerator: ${signal.reason}` : 'AutoModerator filter'
    );
  }

  const firstSafetyMatch = safetyMatches[0];
  if (firstSafetyMatch) {
    score += 18;
    reasons.push(`Safety review: ${firstSafetyMatch.label}`);
  }

  if (score === 0) return undefined;

  return {
    id: signal.commentId,
    author: normalizeUsername(signal.author) ?? 'unknown user',
    body: signal.body.slice(0, 500),
    permalink: signal.permalink,
    createdAt: signal.createdAt,
    score,
    reasons,
  };
};

export const buildParticipants = (
  signals: Incident['recentSignals'],
  flaggedComments: FlaggedComment[]
): IncidentParticipant[] => {
  const flaggedByAuthor = flaggedComments.reduce<Record<string, number>>(
    (counts, comment) => {
      const author = normalizeUsername(comment.author);
      if (!author) return counts;
      counts[author] = (counts[author] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const participants = new Map<
    string,
    {
      signals: number;
      lastSeenAt: number;
      branches: Set<string>;
    }
  >();

  for (const comment of flaggedComments) {
    const author = normalizeUsername(comment.author);
    if (!author) continue;

    const current = participants.get(author) ?? {
      signals: 0,
      lastSeenAt: 0,
      branches: new Set<string>(),
    };
    current.lastSeenAt = Math.max(current.lastSeenAt, comment.createdAt);
    participants.set(author, current);
  }

  for (const signal of signals) {
    const author = normalizeUsername(signal.author);
    if (!author || isAppUsername(author)) continue;

    const current = participants.get(author);
    if (!current) continue;

    current.signals += 1;
    current.lastSeenAt = Math.max(current.lastSeenAt, signal.createdAt);
    if (signal.parentId) current.branches.add(signal.parentId);
    participants.set(author, current);
  }

  return Array.from(participants.entries())
    .map(([username, value]) => ({
      username,
      signals: value.signals,
      flagged: flaggedByAuthor[username] ?? 0,
      lastSeenAt: value.lastSeenAt,
      branchCount: value.branches.size,
    }))
    .sort(
      (a, b) =>
        b.flagged - a.flagged ||
        b.signals - a.signals ||
        b.lastSeenAt - a.lastSeenAt
    )
    .slice(0, MAX_INVOLVED_USERS);
};

export const mergeTrend = (
  previous: IncidentTrendPoint[],
  current: IncidentTrendPoint[]
) => {
  const byTimestamp = new Map<number, IncidentTrendPoint>();

  for (const point of previous) byTimestamp.set(point.timestamp, point);
  for (const point of current) {
    const existing = byTimestamp.get(point.timestamp);
    byTimestamp.set(
      point.timestamp,
      existing
        ? {
            timestamp: point.timestamp,
            score: Math.max(existing.score, point.score),
            commentSignals: Math.max(
              existing.commentSignals,
              point.commentSignals
            ),
            reportSignals: Math.max(
              existing.reportSignals,
              point.reportSignals
            ),
            keywordHits: Math.max(existing.keywordHits, point.keywordHits),
          }
        : point
    );
  }

  return Array.from(byTimestamp.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_TREND_POINTS);
};

const countActionTargets = (
  actions: Incident['actions'],
  type: IncidentActionType
) =>
  actions.reduce(
    (total, action) =>
      action.type === type && actionCompleted(action)
        ? total + (action.targetIds?.length ?? 1)
        : total,
    0
  );

export const COMMENT_REMOVAL_ACTION_TYPES = new Set<IncidentActionType>([
  'cleanup',
  'comment_removed',
  'comment_spammed',
  'comment_thread_removed',
  'user_banned',
  'user_content_removed',
]);

export const REMOVAL_ACTION_TYPES = new Set<IncidentActionType>([
  'cleanup',
  'comment_removed',
  'comment_spammed',
  'comment_thread_removed',
  'post_removed',
  'post_spammed',
  'user_banned',
  'user_content_removed',
]);

export const MODERATION_ACTION_TYPES = new Set<IncidentActionType>([
  'cleanup',
  'comment_approved',
  'comment_locked',
  'comment_removed',
  'comment_reports_ignored',
  'comment_reports_unignored',
  'comment_shown',
  'comment_spammed',
  'comment_thread_removed',
  'comment_unlocked',
  'post_approved',
  'post_removed',
  'post_spammed',
  'post_unlocked',
  'post_marked_nsfw',
  'post_unmarked_nsfw',
  'post_marked_spoiler',
  'post_unmarked_spoiler',
  'post_crowd_control',
  'post_flaired',
  'post_flair_removed',
  'locked',
  'post_reports_ignored',
  'post_reports_unignored',
  'user_approved',
  'user_banned',
  'user_muted',
  'user_content_removed',
]);

const normalizeActionCommentTarget = (targetId: string) => {
  if (!targetId.startsWith('t1_')) return undefined;
  return normalizeCommentId(targetId);
};

export const actionCommentTargets = (action: Incident['actions'][number]) =>
  actionCompleted(action)
    ? (action.targetIds ?? [])
        .map(normalizeActionCommentTarget)
        .filter((targetId): targetId is ReturnType<typeof normalizeCommentId> =>
          Boolean(targetId)
        )
    : [];

export const countRemovalTargets = (action: Incident['actions'][number]) =>
  REMOVAL_ACTION_TYPES.has(action.type) && actionCompleted(action)
    ? (action.targetIds?.filter(
        (targetId) => targetId.startsWith('t1_') || targetId.startsWith('t3_')
      ).length ?? (action.type === 'user_banned' ? 0 : 1))
    : 0;

export const buildImpactSnapshot = ({
  activeFlaggedComments,
  flaggedComments,
  incident,
  reportsGrouped,
}: {
  activeFlaggedComments: FlaggedComment[];
  flaggedComments: FlaggedComment[];
  incident: Incident;
  reportsGrouped: number;
}): IncidentImpactSnapshot => {
  const reviewedComments = flaggedComments.filter(
    (comment) => !isCommentOpenForReview(comment)
  );
  const usersInReview = new Set(
    activeFlaggedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  const usersResolved = new Set(
    reviewedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  for (const username of usersInReview) {
    usersResolved.delete(username);
  }
  const moderationActions = incident.actions.filter(
    (action) => MODERATION_ACTION_TYPES.has(action.type) && actionCompleted(action)
  );
  const removals = incident.actions.reduce(
    (total, action) => total + countRemovalTargets(action),
    0
  );
  const resolvedAt = incident.resolvedAt ?? now();

  return {
    reportsGrouped: Math.max(
      reportsGrouped,
      incident.impact?.reportsGrouped ?? 0
    ),
    commentsReviewed: reviewedComments.length,
    commentsAwaitingReview: activeFlaggedComments.length,
    usersInReview: usersInReview.size,
    usersResolved: usersResolved.size,
    actionsTaken: moderationActions.length,
    removals,
    approvals:
      countActionTargets(incident.actions, 'comment_approved') +
      countActionTargets(incident.actions, 'post_approved') +
      countActionTargets(incident.actions, 'user_approved'),
    bans: incident.actions.filter(
      (action) => action.type === 'user_banned' && actionCompleted(action)
    ).length,
    handoffSaved:
      Boolean(incident.escalationSummary) ||
      incident.actions.some(
        (action) => action.type === 'escalated' && actionCompleted(action)
      ),
    finalNoteSaved:
      Boolean(incident.summary) ||
      Boolean(incident.resolvedAt) ||
      incident.actions.some(
        (action) => action.type === 'resolved' && actionCompleted(action)
      ),
    timeOpenMinutes: Math.max(
      0,
      Math.round(
        (resolvedAt - (incident.openedAt ?? incident.createdAt)) / 60000
      )
    ),
    peakAttention: incident.peakScore ?? 0,
  };
};
