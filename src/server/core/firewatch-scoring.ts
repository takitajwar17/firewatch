import type {
  FirewatchConfig,
  FlaggedComment,
  Incident,
  IncidentImpactSnapshot,
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
  clamp,
  deriveIncidentStatus,
  isAppUsername,
  normalizeCommentId,
  normalizeSignal,
  normalizeUsername,
  now,
} from './firewatch-utils';

type PostSnapshot = {
  title: string;
  permalink?: string;
  subredditName: string;
  numberOfReports: number;
};

const getLevel = (score: number, config: FirewatchConfig): IncidentLevel => {
  if (score >= config.wildfireThreshold) return 'wildfire';
  if (score >= config.fireThreshold) return 'fire';
  if (score >= config.heatThreshold) return 'heat';
  return 'watch';
};

const countKeywordHits = (text: string, keywords: string[]) => {
  const lowered = text.toLowerCase();
  return keywords.filter((keyword) => lowered.includes(keyword)).length;
};

const countSuspiciousDomainHits = (text: string, domains: string[]) => {
  const lowered = text.toLowerCase();
  return domains.filter((domain) => lowered.includes(domain)).length;
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
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
        'Open the Comments tab.',
        'Approve acceptable comments or remove comments that break the rules.',
        'Mark handled after the review queue is clear.',
      ],
    };
  }

  if (status === 'handled' || status === 'resolved') {
    return {
      label: 'No further action',
      detail: 'This post has a saved final note and no comments left in review.',
      level,
      steps: [
        'Review the final mod note.',
        'Open the post if you need to check Reddit state.',
        'No further action is needed unless the thread heats up again.',
      ],
    };
  }

  if (status === 'locked') {
    return {
      label: 'Save final note',
      detail:
        'The post is locked and the comment review queue is clear. Save the final mod note to close it out.',
      level,
      steps: [
        'Save a handoff note if another mod may need context.',
        'Review the mod log for actions taken.',
        'Mark handled to generate the final note.',
      ],
    };
  }

  return {
    label: 'Monitor',
    detail: `Current attention is ${score}/100. Keep an eye on reports, comment volume, and repeated user wording.`,
    level,
    steps: [
      'Leave the post open.',
      'Watch new reports and user comments.',
      'Take this post if more reports come in.',
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

const countActionTargets = (
  actions: Incident['actions'],
  type: Incident['actions'][number]['type']
) =>
  actions.reduce(
    (total, action) =>
      action.type === type ? total + (action.targetIds?.length ?? 1) : total,
    0
  );

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
  const moderationActions = incident.actions.filter(
    (action) => action.type !== 'demo_seeded'
  );
  const removals =
    countActionTargets(incident.actions, 'post_removed') +
    countActionTargets(incident.actions, 'post_spammed') +
    countActionTargets(incident.actions, 'comment_removed') +
    countActionTargets(incident.actions, 'comment_spammed') +
    countActionTargets(incident.actions, 'comment_thread_removed') +
    countActionTargets(incident.actions, 'cleanup') +
    countActionTargets(incident.actions, 'user_content_removed') +
    countActionTargets(incident.actions, 'user_banned');
  const resolvedAt = incident.resolvedAt ?? now();

  return {
    reportsGrouped,
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
      Math.round((resolvedAt - incident.createdAt) / 60000)
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
        action.type === 'cleanup' || action.type === 'user_banned'
          ? (action.targetIds ?? [])
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
      .filter(Boolean)
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
  const userSignals = recentSignals.filter((signal) => signal.source === 'user');
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
    (signal) => signal.type === 'comment_report' || signal.type === 'post_report'
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
  const repeatedPhrases = extractRepeatedPhrases(activeUserSignals);
  const repeatedPhraseHits = repeatedPhrases.reduce(
    (total, phrase) => total + phrase.count,
    0
  );
  const keywordHits = scoreSignals.reduce(
    (total, signal) => total + countKeywordHits(signal.body ?? '', config.keywords),
    0
  );
  const suspiciousHits = scoreSignals.reduce(
    (total, signal) =>
      total + countSuspiciousDomainHits(signal.body ?? '', config.suspiciousDomains),
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
    if (action.type === 'comment_removed') return total + 1;
    if (action.type === 'cleanup' || action.type === 'user_banned') {
      return total + (action.targetIds?.length ?? 1);
    }
    return total;
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
  const reportPoints = clamp(totalReportCount * config.signalWeights.reports, 0, 35);
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
  const removalSignalCount = removalsLastHour + externalRemovalActions.length;
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
      evidence: reports
        .slice(0, 3)
        .map((signal) => signal.reason ?? 'Report'),
    });
  }

  if (keywordPoints > 0) {
    reasons.push({
      key: 'keywords',
      label: 'Watched words',
      detail: `${keywordHits} watched word match${keywordHits > 1 ? 'es' : ''}`,
      points: keywordPoints,
      evidence: config.keywords
        .filter((keyword) =>
          scoreSignals.some((signal) =>
            (signal.body ?? '').toLowerCase().includes(keyword)
          )
        )
        .slice(0, 5),
    });
  }

  if (suspiciousPoints > 0) {
    reasons.push({
      key: 'links',
      label: 'Watched domains',
      detail: `${suspiciousHits} watched domain match${suspiciousHits > 1 ? 'es' : ''}`,
      points: suspiciousPoints,
      evidence: config.suspiciousDomains
        .filter((domain) =>
          scoreSignals.some((signal) =>
            (signal.body ?? '').toLowerCase().includes(domain)
          )
        )
        .slice(0, 5),
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
      removed: false,
      reviewed: false,
    }))
    .sort((a, b) => b.score - a.score);
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
      removed:
        comment.removed || removedCommentIds.has(normalizeCommentId(comment.id)),
      reviewed:
        Boolean(comment.reviewed) ||
        reviewedCommentIds.has(normalizeCommentId(comment.id)),
    }));
  const actionedIds = new Set(activeFlaggedComments.map((comment) => comment.id));
  const flaggedComments = [
    ...activeFlaggedComments,
    ...alreadyActionedComments.filter((comment) => !actionedIds.has(comment.id)),
  ].slice(0, MAX_FLAGGED_COMMENTS);
  const level = getLevel(score, config);
  const peakScore = Math.max(incident.peakScore ?? 0, score);
  const peakLevel = getLevel(peakScore, config);
  const status = deriveIncidentStatus(incident, activeFlaggedComments.length);
  const involvedUsers = buildParticipants(userSignals, activeFlaggedComments);
  const usersInReview = new Set(
    activeFlaggedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  const stats: IncidentStats = {
    ...makeEmptyStats(),
    signalCount: visibleSignals.length,
    commentSignals: recentComments.length,
    reportSignals: totalReportCount,
    manualEscalations: manualEscalations.length,
    keywordHits,
    suspiciousLinkHits: suspiciousHits,
    branchPileOns: branchPileOnCount,
    repeatedPhraseHits,
    removals:
      externalRemovalActions.length +
      incident.actions.reduce((total, action) => {
        if (action.type === 'comment_removed') return total + 1;
        if (action.type === 'cleanup' || action.type === 'user_banned') {
          return total + (action.targetIds?.length ?? 1);
        }
        return total;
      }, 0),
    flaggedCount: activeFlaggedComments.length,
    uniqueParticipants: usersInReview.size,
    commentsLastHour: recentComments.length,
  };
  const impact = buildImpactSnapshot({
    activeFlaggedComments,
    flaggedComments,
    incident,
    reportsGrouped: totalReportCount,
  });

  return {
    ...incident,
    title: postSnapshot.title,
    permalink: postSnapshot.permalink,
    subredditName: postSnapshot.subredditName,
    score,
    level,
    peakScore,
    peakLevel,
    status,
    reasons: reasons.sort((a, b) => b.points - a.points),
    flaggedComments,
    involvedUsers,
    repeatedPhrases,
    stats,
    impact: {
      ...impact,
      peakAttention: peakScore,
    },
    trend: buildTrend(scoreSignals, config),
    recentSignals: normalizedSignals.slice(0, MAX_RECENT_SIGNALS),
    responseSuggestion: getResponseSuggestion(
      score,
      level,
      status,
      activeFlaggedComments.length
    ),
    updatedAt: now(),
  };
};
