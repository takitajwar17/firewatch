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
  RiskReason,
} from '../../shared/api';
import {
  MAX_FLAGGED_COMMENTS,
  MAX_INVOLVED_USERS,
  MAX_RECENT_SIGNALS,
  MAX_REPEATED_PHRASES,
  MAX_TREND_POINTS,
  STOP_WORDS,
  TREND_BUCKET_MS,
  VELOCITY_BASELINE_COMMENTS,
} from './firewatch-constants';
import {
  detectionTokens,
  watchedDomainMatches,
  watchedWordMatches,
} from './firewatch-detection';
import {
  clamp,
  deriveIncidentStatus,
  isAppUsername,
  normalizeCommentId,
  normalizeSignal,
  normalizeUsername,
  now,
} from './firewatch-utils';

type PostSnapshot = {
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

const minTimestamp = (...timestamps: (number | undefined)[]) => {
  const validTimestamps = timestamps.filter(isValidTimestamp);
  if (validTimestamps.length === 0) return undefined;
  return Math.min(...validTimestamps);
};

const maxTimestamp = (...timestamps: (number | undefined)[]) => {
  const validTimestamps = timestamps.filter(isValidTimestamp);
  if (validTimestamps.length === 0) return undefined;
  return Math.max(...validTimestamps);
};

const getLevel = (score: number, config: FirewatchConfig): IncidentLevel => {
  if (score >= config.wildfireThreshold) return 'wildfire';
  if (score >= config.fireThreshold) return 'fire';
  if (score >= config.heatThreshold) return 'heat';
  return 'watch';
};

const countKeywordHits = (text: string, keywords: string[]) => {
  return watchedWordMatches(text, keywords).reduce(
    (total, match) => total + match.count,
    0
  );
};

const countSuspiciousDomainHits = (text: string, domains: string[]) => {
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

const extractRepeatedPhrases = (
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
    .filter(([, value]) => value.count >= 2)
    .map(([phrase, value]) => ({
      phrase,
      count: value.count,
      authors: Array.from(value.authors).slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count || b.authors.length - a.authors.length)
    .slice(0, MAX_REPEATED_PHRASES);
};

export const makeEmptyStats = (): IncidentStats => ({
  signalCount: 0,
  commentSignals: 0,
  reportSignals: 0,
  manualEscalations: 0,
  keywordHits: 0,
  suspiciousLinkHits: 0,
  branchPileOns: 0,
  repeatedPhraseHits: 0,
  removals: 0,
  flaggedCount: 0,
  uniqueParticipants: 0,
  commentsLastHour: 0,
});

export const makeEmptyImpact = (): IncidentImpactSnapshot => ({
  reportsGrouped: 0,
  commentsReviewed: 0,
  commentsAwaitingReview: 0,
  usersInReview: 0,
  usersHandled: 0,
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
        'The post is locked, but comments still need a mod decision before it can be handled.',
      level,
      steps: [
        'Review the remaining unremoved comments.',
        'Approve acceptable comments or remove comments that break the rules.',
        'Mark handled after no comments remain in review.',
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
          ? 'One comment still needs a mod decision before this post can be handled.'
          : `${unresolvedCount} comments still need a mod decision before this post can be handled.`,
      level,
      steps: [
        'Open Comments.',
        'Approve acceptable comments or remove comments that break the rules.',
        'Mark handled after comment review is clear.',
      ],
    };
  }

  if (status === 'handled' || status === 'resolved') {
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
        'Mark handled to generate the final note.',
      ],
    };
  }

  return {
    label: 'Watch post',
    detail: `Review score is ${score}/100. Watch reports, comment volume, and repeated user wording.`,
    level,
    steps: [
      'Leave the post open.',
      'Watch new reports and user comments.',
      'Claim this post if more reports come in.',
    ],
  };
};

const scoreComment = (
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

const buildParticipants = (
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

    const current = participants.get(author) ?? {
      signals: 0,
      lastSeenAt: 0,
      branches: new Set<string>(),
    };
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

const buildTrend = (
  signals: Incident['recentSignals'],
  config: FirewatchConfig
): IncidentTrendPoint[] => {
  const buckets = new Map<
    number,
    {
      commentSignals: number;
      reportSignals: number;
      keywordHits: number;
    }
  >();

  for (const signal of signals) {
    const timestamp =
      Math.floor(signal.createdAt / TREND_BUCKET_MS) * TREND_BUCKET_MS;
    const current = buckets.get(timestamp) ?? {
      commentSignals: 0,
      reportSignals: 0,
      keywordHits: 0,
    };

    if (signal.type === 'comment_create') current.commentSignals += 1;
    if (signal.type === 'comment_report' || signal.type === 'post_report') {
      current.reportSignals += 1;
    }
    current.keywordHits += countKeywordHits(signal.body ?? '', config.keywords);
    buckets.set(timestamp, current);
  }

  return Array.from(buckets.entries())
    .sort(([timestampA], [timestampB]) => timestampA - timestampB)
    .slice(-MAX_TREND_POINTS)
    .map(([timestamp, value]) => ({
      timestamp,
      ...value,
      score: clamp(
        value.commentSignals * 3 +
          value.reportSignals * 15 +
          value.keywordHits * 8,
        0,
        100
      ),
    }));
};

const mergeTrend = (
  previous: IncidentTrendPoint[],
  current: IncidentTrendPoint[]
) => {
  const byTimestamp = new Map<number, IncidentTrendPoint>();

  for (const point of previous) byTimestamp.set(point.timestamp, point);
  for (const point of current) byTimestamp.set(point.timestamp, point);

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
      action.type === type ? total + (action.targetIds?.length ?? 1) : total,
    0
  );

const COMMENT_REMOVAL_ACTION_TYPES = new Set<IncidentActionType>([
  'cleanup',
  'comment_removed',
  'comment_spammed',
  'comment_thread_removed',
  'user_banned',
  'user_content_removed',
]);

const REMOVAL_ACTION_TYPES = new Set<IncidentActionType>([
  'cleanup',
  'comment_removed',
  'comment_spammed',
  'comment_thread_removed',
  'post_removed',
  'post_spammed',
  'user_banned',
  'user_content_removed',
]);

const normalizeActionCommentTarget = (targetId: string) => {
  if (!targetId.startsWith('t1_')) return undefined;
  return normalizeCommentId(targetId);
};

const actionCommentTargets = (action: Incident['actions'][number]) =>
  (action.targetIds ?? [])
    .map(normalizeActionCommentTarget)
    .filter((targetId): targetId is ReturnType<typeof normalizeCommentId> =>
      Boolean(targetId)
    );

const countRemovalTargets = (action: Incident['actions'][number]) =>
  REMOVAL_ACTION_TYPES.has(action.type)
    ? (action.targetIds?.filter(
        (targetId) => targetId.startsWith('t1_') || targetId.startsWith('t3_')
      ).length ?? (action.type === 'user_banned' ? 0 : 1))
    : 0;

const buildImpactSnapshot = ({
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
    (comment) => comment.removed || comment.reviewed
  );
  const usersInReview = new Set(
    activeFlaggedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  const usersHandled = new Set(
    reviewedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  for (const username of usersInReview) {
    usersHandled.delete(username);
  }
  const moderationActions = incident.actions.filter(
    (action) => action.type !== 'demo_seeded'
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
    usersHandled: usersHandled.size,
    actionsTaken: moderationActions.length,
    removals,
    approvals:
      countActionTargets(incident.actions, 'comment_approved') +
      countActionTargets(incident.actions, 'post_approved') +
      countActionTargets(incident.actions, 'user_approved'),
    bans: incident.actions.filter((action) => action.type === 'user_banned')
      .length,
    handoffSaved:
      Boolean(incident.escalationSummary) ||
      incident.actions.some((action) => action.type === 'escalated'),
    finalNoteSaved:
      Boolean(incident.summary) ||
      Boolean(incident.resolvedAt) ||
      incident.actions.some((action) => action.type === 'resolved'),
    timeOpenMinutes: Math.max(
      0,
      Math.round(
        (resolvedAt - (incident.openedAt ?? incident.createdAt)) / 60000
      )
    ),
    peakAttention: incident.peakScore ?? 0,
  };
};

export const calculateIncident = (
  incident: Incident,
  config: FirewatchConfig,
  postSnapshot: PostSnapshot
): Incident => {
  const oneHourAgo = now() - 60 * 60 * 1000;
  const normalizedSignals = incident.recentSignals.map(normalizeSignal);
  const recentSignals = normalizedSignals.filter(
    (signal) => signal.createdAt >= oneHourAgo
  );
  const removedCommentIds = new Set<string>(
    [
      ...incident.flaggedComments
        .filter((comment) => comment.removed)
        .map((comment) => comment.id),
      ...incident.actions.flatMap((action) =>
        COMMENT_REMOVAL_ACTION_TYPES.has(action.type)
          ? actionCommentTargets(action)
          : []
      ),
      ...normalizedSignals
        .filter(
          (signal) =>
            signal.commentId &&
            ((signal.type === 'mod_action' &&
              (signal.metadata?.action === 'removecomment' ||
                signal.metadata?.action === 'spamcomment')) ||
              signal.type === 'automod_filter')
        )
        .map((signal) => signal.commentId ?? ''),
    ]
      .filter((commentId): commentId is string => Boolean(commentId))
      .map(normalizeCommentId)
  );
  const reviewedCommentIds = new Set<string>(
    [
      ...incident.flaggedComments
        .filter((comment) => comment.reviewed)
        .map((comment) => comment.id),
      ...incident.actions.flatMap((action) =>
        action.type === 'comment_approved' ? (action.targetIds ?? []) : []
      ),
    ]
      .filter(Boolean)
      .map(normalizeCommentId)
  );
  const userSignals = recentSignals.filter(
    (signal) => signal.source === 'user'
  );
  const activeUserSignals = userSignals.filter(
    (signal) =>
      !signal.commentId ||
      (!removedCommentIds.has(signal.commentId) &&
        !reviewedCommentIds.has(signal.commentId))
  );
  const scoreSignals = recentSignals.filter(
    (signal) =>
      (signal.source === 'user' || signal.source === 'report') &&
      (!signal.commentId ||
        (!removedCommentIds.has(signal.commentId) &&
          !reviewedCommentIds.has(signal.commentId)))
  );
  const visibleSignals = recentSignals.filter(
    (signal) => signal.source !== 'firewatch_notice'
  );
  const recentComments = activeUserSignals.filter(
    (signal) => signal.type === 'comment_create'
  );
  const reports = scoreSignals.filter(
    (signal) =>
      signal.type === 'comment_report' || signal.type === 'post_report'
  );
  const commentReports = scoreSignals.filter(
    (signal) => signal.type === 'comment_report'
  );
  const postReportSignals = scoreSignals.filter(
    (signal) => signal.type === 'post_report'
  );
  const postReportCount = Math.max(
    postSnapshot.numberOfReports,
    postReportSignals.length
  );
  const totalReportCount = commentReports.length + postReportCount;
  const manualEscalations = recentSignals.filter(
    (signal) => signal.type === 'manual_escalation'
  );
  const externalRemovalActions = recentSignals.filter(
    (signal) =>
      (signal.type === 'mod_action' &&
        (signal.metadata?.action === 'removecomment' ||
          signal.metadata?.action === 'spamcomment' ||
          signal.metadata?.action === 'removelink' ||
          signal.metadata?.action === 'spamlink')) ||
      signal.type === 'automod_filter'
  );
  const recordedRemovalTargets = new Set(
    incident.actions
      .filter((action) => REMOVAL_ACTION_TYPES.has(action.type))
      .flatMap((action) => action.targetIds ?? [])
      .map((targetId) =>
        targetId.startsWith('t1_')
          ? normalizeCommentId(targetId)
          : targetId.startsWith('t3_')
            ? targetId
            : undefined
      )
      .filter((targetId): targetId is string => Boolean(targetId))
  );
  const unrecordedExternalRemovalActions = externalRemovalActions.filter(
    (signal) => {
      const targetId = signal.commentId
        ? normalizeCommentId(signal.commentId)
        : signal.postId;
      return !recordedRemovalTargets.has(targetId);
    }
  );
  const repeatedPhrases = extractRepeatedPhrases(activeUserSignals);
  const repeatedPhraseHits = repeatedPhrases.reduce(
    (total, phrase) => total + phrase.count,
    0
  );
  const keywordHits = scoreSignals.reduce(
    (total, signal) =>
      total + countKeywordHits(signal.body ?? '', config.keywords),
    0
  );
  const suspiciousHits = scoreSignals.reduce(
    (total, signal) =>
      total +
      countSuspiciousDomainHits(signal.body ?? '', config.suspiciousDomains),
    0
  );
  const parentAuthors = activeUserSignals.reduce<Record<string, Set<string>>>(
    (counts, signal) => {
      const author = normalizeUsername(signal.author);
      if (signal.parentId && author) {
        const authors = counts[signal.parentId] ?? new Set<string>();
        authors.add(author);
        counts[signal.parentId] = authors;
      }
      return counts;
    },
    {}
  );
  const branchPileOnCount = Object.values(parentAuthors).filter(
    (authors) => authors.size >= 3
  ).length;
  const removalsLastHour = incident.actions.reduce((total, action) => {
    if (action.createdAt < oneHourAgo) return total;
    return total + countRemovalTargets(action);
  }, 0);
  const reasons: RiskReason[] = [];
  const velocityOverflow = Math.max(
    0,
    recentComments.length - VELOCITY_BASELINE_COMMENTS
  );
  const velocityPoints = clamp(
    velocityOverflow * config.signalWeights.commentVelocity,
    0,
    30
  );
  const reportPoints = clamp(
    totalReportCount * config.signalWeights.reports,
    0,
    35
  );
  const keywordPoints = clamp(
    keywordHits * config.signalWeights.watchedWords,
    0,
    25
  );
  const suspiciousPoints = clamp(
    suspiciousHits * config.signalWeights.watchedDomains,
    0,
    20
  );
  const pileOnPoints = clamp(
    branchPileOnCount * config.signalWeights.replyPileOns,
    0,
    20
  );
  const phrasePoints = clamp(
    repeatedPhraseHits * config.signalWeights.repeatedWording,
    0,
    20
  );
  const removalSignalCount =
    removalsLastHour + unrecordedExternalRemovalActions.length;
  const removalPoints = clamp(
    removalSignalCount * config.signalWeights.recentRemovals,
    0,
    20
  );
  const manualPoints =
    manualEscalations.length > 0 ? config.signalWeights.manualSend : 0;

  if (velocityPoints > 0) {
    reasons.push({
      key: 'velocity',
      label: 'New comments',
      detail: `${recentComments.length} new comments in the last hour`,
      points: velocityPoints,
      evidence: recentComments
        .slice(0, 3)
        .map((signal) => normalizeUsername(signal.author))
        .filter((author): author is string => Boolean(author)),
    });
  }

  if (reportPoints > 0) {
    reasons.push({
      key: 'reports',
      label: 'Reports',
      detail: `${commentReports.length} comment reports plus ${postReportCount} post reports`,
      points: reportPoints,
      evidence: reports.slice(0, 3).map((signal) => signal.reason ?? 'Report'),
    });
  }

  if (keywordPoints > 0) {
    const matchedWords = new Set(
      scoreSignals.flatMap((signal) =>
        watchedWordMatches(signal.body ?? '', config.keywords).map(
          (match) => match.term
        )
      )
    );
    reasons.push({
      key: 'keywords',
      label: 'Watched words',
      detail: `${keywordHits} watched word match${keywordHits > 1 ? 'es' : ''}`,
      points: keywordPoints,
      evidence: Array.from(matchedWords).slice(0, 5),
    });
  }

  if (suspiciousPoints > 0) {
    const matchedDomains = new Set(
      scoreSignals.flatMap((signal) =>
        watchedDomainMatches(
          signal.body ?? '',
          config.suspiciousDomains
        ).map((match) => match.term)
      )
    );
    reasons.push({
      key: 'links',
      label: 'Watched domains',
      detail: `${suspiciousHits} watched domain match${suspiciousHits > 1 ? 'es' : ''}`,
      points: suspiciousPoints,
      evidence: Array.from(matchedDomains).slice(0, 5),
    });
  }

  if (pileOnPoints > 0) {
    reasons.push({
      key: 'pile-on',
      label: 'Reply pile-on',
      detail: `${branchPileOnCount} clustered reply branch${
        branchPileOnCount > 1 ? 'es' : ''
      }`,
      points: pileOnPoints,
      evidence: Object.entries(parentAuthors)
        .filter(([, authors]) => authors.size >= 3)
        .slice(0, 3)
        .map(([, authors]) => `${authors.size} users in one branch`),
    });
  }

  if (phrasePoints > 0) {
    reasons.push({
      key: 'phrases',
      label: 'Repeated wording',
      detail: `${repeatedPhrases.length} repeated phrase${
        repeatedPhrases.length === 1 ? '' : 's'
      }`,
      points: phrasePoints,
      evidence: repeatedPhrases.map((phrase) => phrase.phrase),
    });
  }

  if (removalPoints > 0) {
    reasons.push({
      key: 'removals',
      label: 'Recent removals',
      detail: `${removalSignalCount} removals recorded in the last hour`,
      points: removalPoints,
    });
  }

  if (manualPoints > 0) {
    reasons.push({
      key: 'manual',
      label: 'Sent by mod',
      detail: 'A mod sent this post to Firewatch',
      points: manualPoints,
      evidence: manualEscalations.map(
        (signal) => signal.reason ?? 'Sent by mod'
      ),
    });
  }

  const score = clamp(
    velocityPoints +
      reportPoints +
      keywordPoints +
      suspiciousPoints +
      pileOnPoints +
      phrasePoints +
      removalPoints +
      manualPoints,
    0,
    100
  );
  const flaggedById = new Map<string, FlaggedComment>();

  for (const signal of normalizedSignals) {
    if (signal.commentId && removedCommentIds.has(signal.commentId)) continue;
    if (signal.commentId && reviewedCommentIds.has(signal.commentId)) continue;
    const flagged = scoreComment(signal, config);
    if (!flagged) continue;

    const existing = flaggedById.get(flagged.id);
    if (!existing || existing.score < flagged.score) {
      flaggedById.set(flagged.id, flagged);
    }
  }

  const activeFlaggedComments = Array.from(flaggedById.values())
    .map((comment) => ({
      ...comment,
      author: normalizeUsername(comment.author) ?? 'unknown user',
      approved: false,
      ignoringReports: false,
      locked: false,
      numReports: comment.numReports ?? 0,
      removed: false,
      reviewed: false,
      spam: false,
    }))
    .sort((a, b) => b.score - a.score);
  const activeIds = new Set(
    activeFlaggedComments.map((comment) => normalizeCommentId(comment.id))
  );
  const previousOpenComments = incident.flaggedComments
    .filter((comment) => {
      const commentId = normalizeCommentId(comment.id);
      return (
        !comment.removed &&
        !comment.reviewed &&
        !removedCommentIds.has(commentId) &&
        !reviewedCommentIds.has(commentId) &&
        !activeIds.has(commentId)
      );
    })
    .map((comment) => ({
      ...comment,
      author: normalizeUsername(comment.author) ?? 'unknown user',
      removed: false,
      reviewed: false,
    }));
  const alreadyActionedComments = incident.flaggedComments
    .filter(
      (comment) =>
        comment.removed ||
        comment.reviewed ||
        removedCommentIds.has(normalizeCommentId(comment.id)) ||
        reviewedCommentIds.has(normalizeCommentId(comment.id))
    )
    .map((comment) => ({
      ...comment,
      author: normalizeUsername(comment.author) ?? 'unknown user',
      approved:
        Boolean(comment.approved) ||
        reviewedCommentIds.has(normalizeCommentId(comment.id)),
      removed:
        comment.removed ||
        Boolean(comment.spam) ||
        removedCommentIds.has(normalizeCommentId(comment.id)),
      reviewed:
        Boolean(comment.reviewed) ||
        Boolean(comment.approved) ||
        reviewedCommentIds.has(normalizeCommentId(comment.id)),
      spam: Boolean(comment.spam),
    }));
  const openFlaggedComments = [
    ...activeFlaggedComments,
    ...previousOpenComments,
  ].sort((a, b) => b.score - a.score);
  const openIds = new Set(openFlaggedComments.map((comment) => comment.id));
  const actionedCommentLimit = Math.max(
    0,
    MAX_FLAGGED_COMMENTS - openFlaggedComments.length
  );
  const flaggedComments = [
    ...openFlaggedComments,
    ...alreadyActionedComments
      .filter((comment) => !openIds.has(comment.id))
      .slice(0, actionedCommentLimit),
  ];
  const level = getLevel(score, config);
  const peakScore = Math.max(incident.peakScore ?? 0, score);
  const peakLevel = getLevel(peakScore, config);
  const sortedReasons = reasons.sort((a, b) => b.points - a.points);
  const nextPeakReasons =
    score >= (incident.peakScore ?? 0) && sortedReasons.length > 0
      ? sortedReasons
      : (incident.peakReasons ?? sortedReasons);
  const nextPeakRepeatedPhrases =
    score >= (incident.peakScore ?? 0) && repeatedPhrases.length > 0
      ? repeatedPhrases
      : (incident.peakRepeatedPhrases ?? repeatedPhrases);
  const status = deriveIncidentStatus(
    incident,
    openFlaggedComments.length,
    postSnapshot.postState?.locked
  );
  const involvedUsers = buildParticipants(
    activeUserSignals,
    openFlaggedComments
  );
  const fallbackCreatedAt =
    minTimestamp(
      incident.createdAt,
      ...normalizedSignals.map((signal) => signal.createdAt)
    ) ?? incident.createdAt;
  const createdAt = postSnapshot.createdAt ?? fallbackCreatedAt;
  const openedAt =
    incident.openedAt ??
    minTimestamp(...normalizedSignals.map((signal) => signal.createdAt)) ??
    createdAt;
  const updatedAt =
    maxTimestamp(
      ...normalizedSignals.map((signal) => signal.createdAt),
      ...incident.actions.map((action) => action.createdAt),
      ...incident.flaggedComments.map((comment) => comment.createdAt),
      incident.claim?.claimedAt,
      incident.resolvedAt,
      createdAt
    ) ?? createdAt;
  const usersInReview = new Set(
    openFlaggedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  const stats: IncidentStats = {
    ...makeEmptyStats(),
    signalCount: visibleSignals.length,
    commentSignals: recentComments.length,
    reportSignals: Math.max(totalReportCount, incident.stats.reportSignals),
    manualEscalations: manualEscalations.length,
    keywordHits,
    suspiciousLinkHits: suspiciousHits,
    branchPileOns: branchPileOnCount,
    repeatedPhraseHits,
    removals:
      unrecordedExternalRemovalActions.length +
      incident.actions.reduce((total, action) => {
        return total + countRemovalTargets(action);
      }, 0),
    flaggedCount: openFlaggedComments.length,
    uniqueParticipants: usersInReview.size,
    commentsLastHour: recentComments.length,
  };
  const impact = buildImpactSnapshot({
    activeFlaggedComments: openFlaggedComments,
    flaggedComments,
    incident,
    reportsGrouped: totalReportCount,
  });
  const currentTrend = buildTrend(scoreSignals, config);

  return {
    ...incident,
    title: postSnapshot.title,
    permalink: postSnapshot.permalink,
    subredditName: postSnapshot.subredditName,
    postAuthor: postSnapshot.authorName ?? incident.postAuthor,
    postScore: postSnapshot.score,
    postCommentCount: postSnapshot.numberOfComments,
    createdAt,
    openedAt,
    score,
    level,
    peakScore,
    peakLevel,
    peakReasons: nextPeakReasons,
    peakRepeatedPhrases: nextPeakRepeatedPhrases,
    status,
    postState: postSnapshot.postState,
    reasons: sortedReasons,
    flaggedComments,
    involvedUsers,
    repeatedPhrases,
    stats,
    impact: {
      ...impact,
      peakAttention: peakScore,
    },
    trend: mergeTrend(incident.trend ?? [], currentTrend),
    recentSignals: normalizedSignals.slice(0, MAX_RECENT_SIGNALS),
    responseSuggestion: getResponseSuggestion(
      score,
      level,
      status,
      openFlaggedComments.length
    ),
    updatedAt,
  };
};
