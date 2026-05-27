import type {
  FirewatchConfig,
  FlaggedComment,
  Incident,
  IncidentStats,
  IncidentTrendPoint,
  RiskReason,
} from '../../shared/api';
import { isCommentOpenForReview } from '../../shared/incidents';
import { actionCompleted } from '../../shared/reddit-actions';
import {
  MAX_FLAGGED_COMMENTS,
  MAX_RECENT_SIGNALS,
  VELOCITY_BASELINE_COMMENTS,
} from './firewatch-constants';
import { watchedDomainMatches, watchedWordMatches } from './firewatch-detection';
import { detectSafetyReview } from './firewatch-safety';
import {
  clamp,
  deriveIncidentStatus,
  normalizeCommentId,
  normalizeSignal,
  normalizeUsername,
  now,
} from './firewatch-utils';
import {
  COMMENT_REMOVAL_ACTION_TYPES,
  REMOVAL_ACTION_TYPES,
  actionCommentTargets,
  buildImpactSnapshot,
  buildParticipants,
  countKeywordHits,
  countRemovalTargets,
  countSuspiciousDomainHits,
  extractRepeatedPhrases,
  getLevel,
  getResponseSuggestion,
  makeEmptyStats,
  maxTimestamp,
  mergeTrend,
  minTimestamp,
  scoreComment,
  type PostSnapshot,
} from './firewatch-scoring/helpers';

export {
  getResponseSuggestion,
  makeEmptyImpact,
  makeEmptyStats,
} from './firewatch-scoring/helpers';

type ScoredSignal = ReturnType<typeof normalizeSignal>;

const contentKeyForSignal = (signal: ScoredSignal) => {
  if (!signal.body) return undefined;
  if (signal.commentId) return `comment:${normalizeCommentId(signal.commentId)}`;
  if (
    signal.type === 'post_create' ||
    signal.type === 'post_update' ||
    signal.type === 'post_report'
  ) {
    return `post:${signal.postId}`;
  }

  return signal.id;
};

const chooseContentSignal = (
  current: ScoredSignal | undefined,
  next: ScoredSignal
) => {
  if (!current) return next;
  if (current.source === 'report' && next.source === 'user') return next;
  if (
    current.source === next.source &&
    (next.body?.length ?? 0) > (current.body?.length ?? 0)
  ) {
    return next;
  }

  return current;
};

const uniqueContentSignals = (signals: ScoredSignal[]) => {
  const byKey = new Map<string, ScoredSignal>();

  for (const signal of signals) {
    const key = contentKeyForSignal(signal);
    if (!key) continue;

    byKey.set(key, chooseContentSignal(byKey.get(key), signal));
  }

  return Array.from(byKey.values());
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
        .filter((comment) => comment.removed || comment.spam)
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
        .filter((comment) => comment.reviewed || comment.approved)
        .map((comment) => comment.id),
      ...incident.actions.flatMap((action) =>
        action.type === 'comment_approved' && actionCompleted(action)
          ? (action.targetIds ?? [])
          : []
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
  const ignoredReportCommentIds = new Set(
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
      : postSnapshot.postState?.ignoringReports === true);
  const isIgnoredReportSignal = (signal: ScoredSignal) => {
    if (signal.type === 'post_report') return postReportsIgnored;
    if (signal.type !== 'comment_report' || !signal.commentId) return false;
    return ignoredReportCommentIds.has(normalizeCommentId(signal.commentId));
  };
  const contentSignals = uniqueContentSignals(scoreSignals);
  const visibleSignals = recentSignals.filter(
    (signal) => signal.source !== 'firewatch_notice'
  );
  const recentComments = activeUserSignals.filter(
    (signal) => signal.type === 'comment_create'
  );
  const currentReportSignals = scoreSignals.filter(
    (signal) =>
      (signal.type === 'comment_report' || signal.type === 'post_report') &&
      !isIgnoredReportSignal(signal)
  );
  const reports = currentReportSignals.filter(
    (signal) =>
      signal.type === 'comment_report' || signal.type === 'post_report'
  );
  const commentReports = currentReportSignals.filter(
    (signal) => signal.type === 'comment_report'
  );
  const postReportSignals = currentReportSignals.filter(
    (signal) => signal.type === 'post_report'
  );
  const postReportCount = postReportsIgnored
    ? 0
    : Math.max(postSnapshot.numberOfReports, postReportSignals.length);
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
      .filter(
        (action) =>
          REMOVAL_ACTION_TYPES.has(action.type) && actionCompleted(action)
      )
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
  const keywordHits = contentSignals.reduce(
    (total, signal) =>
      total + countKeywordHits(signal.body ?? '', config.keywords),
    0
  );
  const suspiciousHits = contentSignals.reduce(
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
  const safetyReview = detectSafetyReview(contentSignals);
  const safetyPoints = safetyReview ? 35 : 0;

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
      contentSignals.flatMap((signal) =>
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
      contentSignals.flatMap((signal) =>
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

  if (safetyReview) {
    reasons.push({
      key: 'safety',
      label: 'Safety review',
      detail: safetyReview.summary,
      points: safetyPoints,
      evidence: safetyReview.matches
        .slice(0, 3)
        .map((match) =>
          match.author
            ? `${match.label}: ${match.matchedText} (${normalizeUsername(match.author)})`
            : `${match.label}: ${match.matchedText}`
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
      manualPoints +
      safetyPoints,
    0,
    100
  );
  const flaggedById = new Map<string, FlaggedComment>();

  for (const signal of normalizedSignals) {
    if (signal.commentId && removedCommentIds.has(signal.commentId)) continue;
    if (signal.commentId && reviewedCommentIds.has(signal.commentId)) continue;
    if (isIgnoredReportSignal(signal)) continue;
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
        isCommentOpenForReview(comment) &&
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
        !isCommentOpenForReview(comment) ||
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
  const openIds = new Set(
    openFlaggedComments.map((comment) => normalizeCommentId(comment.id))
  );
  const nonOpenActionedComments = alreadyActionedComments.filter(
    (comment) => !openIds.has(normalizeCommentId(comment.id))
  );
  const impactFlaggedComments = [
    ...openFlaggedComments,
    ...nonOpenActionedComments,
  ];
  const actionedCommentLimit = Math.max(
    0,
    MAX_FLAGGED_COMMENTS - openFlaggedComments.length
  );
  const flaggedComments = [
    ...openFlaggedComments,
    ...nonOpenActionedComments.slice(0, actionedCommentLimit),
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
    currentReportSignals: totalReportCount,
    currentCommentReports: commentReports.length,
    currentPostReports: postReportCount,
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
    flaggedCommentsOmitted: Math.max(
      0,
      impactFlaggedComments.length - flaggedComments.length
    ),
    flaggedCommentsStored: flaggedComments.length,
    signalsOmitted: incident.stats.signalsOmitted ?? 0,
    signalsStored: Math.min(normalizedSignals.length, MAX_RECENT_SIGNALS),
  };
  const impact = buildImpactSnapshot({
    activeFlaggedComments: openFlaggedComments,
    flaggedComments: impactFlaggedComments,
    incident,
    reportsGrouped: totalReportCount,
  });
  const currentTrend: IncidentTrendPoint[] = [
    {
      timestamp: Math.floor(updatedAt / (10 * 60 * 1000)) * (10 * 60 * 1000),
      score,
      commentSignals: recentComments.length,
      reportSignals: totalReportCount,
      keywordHits,
    },
  ];
  const lastSignalAt = maxTimestamp(
    ...normalizedSignals.map((signal) => signal.createdAt)
  );

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
    ...(lastSignalAt ? { lastSignalAt } : {}),
    score,
    level,
    peakScore,
    peakLevel,
    peakReasons: nextPeakReasons,
    peakRepeatedPhrases: nextPeakRepeatedPhrases,
    safetyReview,
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
