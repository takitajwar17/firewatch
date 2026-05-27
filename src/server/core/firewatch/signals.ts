import { context, redis } from '@devvit/web/server';
import type {
  Incident,
  IncidentSignal,
  SignalSource,
} from '../../../shared/api';
import { ruleTriggerTypeForSignal } from '../../../shared/automation-rules';
import { sortIncidentsByPriority } from '../../../shared/incidents';
import { MAX_RECENT_SIGNALS } from '../firewatch-constants';
import { normalizeDetectionText } from '../firewatch-detection';
import {
  attachRuleContext,
  recordRuleMatches,
} from '../firewatch-rules/matching';
import {
  calculateIncident,
  getResponseSuggestion,
  makeEmptyImpact,
  makeEmptyStats,
} from '../firewatch-scoring';
import type { PostSnapshot } from '../firewatch-scoring/helpers';
import { runRuleAutomationActions } from './automation';
import { appendAction, getPostSnapshot, refreshIncident } from './incidents';
import { logFirewatchError } from './logging';
import {
  getConfig,
  getIncident,
  getIncidentRegistry,
  getIndex,
  removeFromIncidentRegistry,
  saveIncident,
  saveIndex,
  shouldShowInQueue,
} from './store';
import {
  boardPostKey,
  claimKey,
  incidentKey,
  inferSignalSource,
  makeId,
  normalizeCommentId,
  normalizeParentId,
  normalizePostId,
  normalizeStatus,
  normalizeUsername,
  now,
} from '../firewatch-utils';
import { externalModActionDetail, externalModActionType } from '../mod-actions';

/**
 * Server-side shape accepted by trigger, menu, demo, and action flows before
 * Firewatch normalizes IDs, dedupes recent signals, and recalculates incident
 * state.
 */
export type SignalInput = Omit<IncidentSignal, 'id' | 'createdAt' | 'source'> & {
  createdAt?: number;
  postSnapshot?: PostSnapshot;
  source?: SignalSource;
};

const DEDUPED_SIGNAL_TYPES = new Set<IncidentSignal['type']>([
  'post_create',
  'post_update',
  'comment_create',
  'comment_report',
  'post_report',
  'mod_action',
  'automod_filter',
]);

const COMMENT_TARGET_ACTION_TYPES = new Set<Incident['actions'][number]['type']>(
  [
    'comment_approved',
    'comment_locked',
    'comment_removed',
    'comment_reports_ignored',
    'comment_reports_unignored',
    'comment_shown',
    'comment_spammed',
    'comment_thread_removed',
    'comment_unlocked',
    'user_content_removed',
  ]
);

const actionTargetsComment = (
  action: Incident['actions'][number],
  normalizedCommentId: string
) =>
  COMMENT_TARGET_ACTION_TYPES.has(action.type) &&
  (action.targetIds ?? []).some(
    (targetId) => normalizeCommentId(targetId) === normalizedCommentId
  );

const filterDeletedCommentTarget = (
  action: Incident['actions'][number],
  normalizedCommentId: string
) => {
  if (!COMMENT_TARGET_ACTION_TYPES.has(action.type)) return action.targetIds;
  return action.targetIds?.filter(
    (targetId) => normalizeCommentId(targetId) !== normalizedCommentId
  );
};

const signalMetadataSignature = (signal: IncidentSignal) => {
  if (!signal.metadata) return '';

  return Object.entries(signal.metadata)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(',');
};

const signalDedupeKey = (signal: IncidentSignal) => {
  if (!DEDUPED_SIGNAL_TYPES.has(signal.type)) return undefined;

  return [
    signal.type,
    signal.postId,
    signal.commentId ?? '',
    signal.parentId ?? '',
    normalizeDetectionText(signal.author ?? ''),
    normalizeDetectionText(signal.reason ?? ''),
    normalizeDetectionText(signal.body ?? '').slice(0, 500),
    signalMetadataSignature(signal),
  ].join('|');
};

export const mergeRecentSignal = (
  signal: IncidentSignal,
  recentSignals: Incident['recentSignals']
) => {
  return mergeRecentSignalWithMeta(signal, recentSignals).signals;
};

const capRecentSignals = (signals: Incident['recentSignals']) => ({
  droppedCount: Math.max(0, signals.length - MAX_RECENT_SIGNALS),
  signals: signals.slice(0, MAX_RECENT_SIGNALS),
});

const mergeRecentSignalWithMeta = (
  signal: IncidentSignal,
  recentSignals: Incident['recentSignals']
) => {
  const dedupeKey = signalDedupeKey(signal);
  if (!dedupeKey) {
    return capRecentSignals([signal, ...recentSignals]);
  }

  const duplicateIndex = recentSignals.findIndex(
    (recentSignal) => signalDedupeKey(recentSignal) === dedupeKey
  );
  if (duplicateIndex === -1) {
    return capRecentSignals([signal, ...recentSignals]);
  }

  const duplicate = recentSignals[duplicateIndex];
  if (!duplicate) {
    return capRecentSignals([signal, ...recentSignals]);
  }

  const mergedSignal: IncidentSignal = {
    ...duplicate,
    ...signal,
    id: duplicate.id,
    createdAt: Math.max(duplicate.createdAt, signal.createdAt),
  };

  return capRecentSignals([
    mergedSignal,
    ...recentSignals.filter((_, index) => index !== duplicateIndex),
  ]);
};

export const recordIncidentSignal = async (input: SignalInput) => {
  const { postSnapshot: providedPostSnapshot, ...signalInput } = input;
  const postId = normalizePostId(input.postId);
  const commentId = input.commentId
    ? normalizeCommentId(input.commentId)
    : undefined;
  const parentId = normalizeParentId(input.parentId, postId);
  const existing = await getIncident(postId);
  const postSnapshot =
    providedPostSnapshot ?? (await getPostSnapshot(postId));
  const signal: IncidentSignal = {
    ...signalInput,
    postId,
    commentId,
    parentId,
    author: normalizeUsername(input.author),
    source: inferSignalSource(input),
    id: makeId('sig'),
    createdAt: input.createdAt ?? now(),
  };
  const baseIncident: Incident = existing ?? {
    postId,
    subredditName: postSnapshot.subredditName,
    title: postSnapshot.title,
    permalink: postSnapshot.permalink,
    score: 0,
    postAuthor: postSnapshot.authorName,
    postScore: postSnapshot.score,
    postCommentCount: postSnapshot.numberOfComments,
    level: 'watch',
    peakScore: 0,
    peakLevel: 'watch',
    status: 'open',
    createdAt: postSnapshot.createdAt ?? signal.createdAt,
    openedAt: signal.createdAt,
    updatedAt: signal.createdAt,
    reasons: [],
    flaggedComments: [],
    recentSignals: [],
    involvedUsers: [],
    repeatedPhrases: [],
    stats: makeEmptyStats(),
    impact: makeEmptyImpact(),
    trend: [],
    responseSuggestion: getResponseSuggestion(0, 'watch', 'open'),
    actions: [],
  };
  const shouldReopen =
    signal.type === 'manual_escalation' ||
    signal.type === 'automod_filter' ||
    signal.source === 'user' ||
    signal.source === 'report';
  const nextStatus =
    shouldReopen && normalizeStatus(baseIncident.status) === 'resolved'
      ? 'open'
      : normalizeStatus(baseIncident.status);
  const config = await getConfig(postSnapshot.subredditName);
  const mergedSignalResult = mergeRecentSignalWithMeta(
    signal,
    baseIncident.recentSignals
  );
  const calculatedIncident = calculateIncident(
    {
      ...baseIncident,
      stats: {
        ...baseIncident.stats,
        signalsOmitted:
          (baseIncident.stats.signalsOmitted ?? 0) +
          mergedSignalResult.droppedCount,
      },
      status: nextStatus,
      resolvedAt: shouldReopen ? undefined : baseIncident.resolvedAt,
      summary: shouldReopen ? undefined : baseIncident.summary,
      recentSignals: mergedSignalResult.signals,
    },
    config,
    postSnapshot
  );
  const nextIncident = await attachRuleContext(calculatedIncident, config);

  await saveIncident(nextIncident);
  return {
    config,
    incident: nextIncident,
    triggerType: ruleTriggerTypeForSignal(signal),
  };
};



// Incident ingest and lookup API
const DASHBOARD_READ_REFRESH_INTERVAL_MS = 15 * 1000;

const refreshIncidentForRead = async (incident: Incident) => {
  if (now() - incident.updatedAt < DASHBOARD_READ_REFRESH_INTERVAL_MS) {
    return incident;
  }

  try {
    const refreshed = await refreshIncident(incident);
    await saveIncident(refreshed);
    return refreshed;
  } catch (error) {
    logFirewatchError('incident.refresh_for_read_failed', {
      postId: incident.postId,
      subredditName: incident.subredditName,
      error,
    });
    return incident;
  }
};

export const deleteStoredPostContent = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  const subredditName = incident?.subredditName ?? context.subredditName;
  const index = await getIndex(subredditName);
  await redis.del(incidentKey(normalizedPostId), claimKey(normalizedPostId));
  await saveIndex(
    index.filter((id) => id !== normalizedPostId),
    subredditName
  );
  await removeFromIncidentRegistry(subredditName, normalizedPostId);

  if (subredditName) {
    const boardPostId = await redis.get(boardPostKey(subredditName));
    if (boardPostId === normalizedPostId) {
      await redis.del(boardPostKey(subredditName));
    }
  }
};

export const deleteStoredCommentContent = async (
  postId: string,
  commentId: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) return;

  const sanitizedSignals = incident.recentSignals.filter(
    (signal) =>
      !signal.commentId ||
      normalizeCommentId(signal.commentId) !== normalizedCommentId
  );
  const sanitizedActions = incident.actions.map((action) => {
    if (
      !actionTargetsComment(action, normalizedCommentId) &&
      !action.detail.includes(normalizedCommentId)
    ) {
      return action;
    }

    return {
      ...action,
      detail: 'Action referenced a comment that was later deleted on Reddit',
      targetIds: filterDeletedCommentTarget(action, normalizedCommentId),
      summary: undefined,
    };
  });
  const sanitizedIncident: Incident = {
    ...incident,
    actions: sanitizedActions,
    escalationSummary: undefined,
    flaggedComments: incident.flaggedComments.filter(
      (comment) => normalizeCommentId(comment.id) !== normalizedCommentId
    ),
    involvedUsers: [],
    reasons: [],
    recentSignals: sanitizedSignals,
    repeatedPhrases: [],
    summary: undefined,
    updatedAt: now(),
  };

  try {
    const refreshed = await refreshIncident(sanitizedIncident);
    await saveIncident(refreshed);
  } catch (error) {
    logFirewatchError('incident.refresh_after_comment_delete_failed', {
      postId: normalizedPostId,
      commentId: normalizedCommentId,
      subredditName: incident.subredditName,
      error,
    });
    const config = await getConfig(incident.subredditName);
    const recalculated = calculateIncident(sanitizedIncident, config, {
      authorName: incident.postAuthor,
      createdAt: incident.createdAt,
      numberOfComments: incident.postCommentCount ?? 0,
      numberOfReports: 0,
      permalink: incident.permalink,
      postState: incident.postState,
      score: incident.postScore ?? 0,
      subredditName: incident.subredditName,
      title: incident.title,
    });
    await saveIncident(recalculated);
  }
};



/**
 * Records a new moderation signal, recalculates the incident, attaches rule
 * matches, and runs any automation mode that is allowed for the matched rules.
 */
export const upsertIncidentSignal = async (input: SignalInput) => {
  const { config, incident, triggerType } = await recordIncidentSignal(input);
  const ruleLogs = await recordRuleMatches({
    config,
    incident,
    triggerType,
  });
  return runRuleAutomationActions(incident, ruleLogs);
};

/**
 * Loads queue-visible incidents, refreshes Reddit state for active records,
 * repairs the Redis queue index, and returns recent resolved incidents for
 * review history.
 */
export const getIncidents = async () => {
  const index = await getIndex();
  const registry = await getIncidentRegistry();
  const candidatePostIds = Array.from(new Set([...index, ...registry]));
  const incidents = (
    await Promise.all(
      candidatePostIds.map(async (postId) => {
        const incident = await getIncident(postId);
        if (!incident) return undefined;

        return shouldShowInQueue(incident)
          ? refreshIncidentForRead(incident)
          : incident;
      })
    )
  ).filter((incident): incident is Incident => Boolean(incident));
  const visibleIncidents = incidents.filter(shouldShowInQueue);
  await saveIndex(visibleIncidents.map((incident) => incident.postId));

  const visiblePostIds = new Set(
    visibleIncidents.map((incident) => incident.postId)
  );
  const resolvedIncidents = (
    await Promise.all(
      registry
        .filter((postId) => !visiblePostIds.has(postId))
        .slice(0, 100)
        .map(async (postId) => {
          const incident = await getIncident(postId);
          if (!incident) return undefined;

          return incident;
        })
    )
  )
    .filter((incident): incident is Incident => Boolean(incident))
    .filter(
      (incident) => normalizeStatus(incident.status) === 'resolved'
    )
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 25);

  return [
    ...sortIncidentsByPriority(visibleIncidents),
    ...resolvedIncidents,
  ].slice(0, 50);
};

export const getIncidentById = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) return undefined;

  return refreshIncidentForRead(incident);
};

export const recordExternalModAction = async ({
  action,
  moderatorName,
  postId,
  targetCommentId,
  targetPostId,
}: {
  action: string;
  moderatorName?: string;
  postId: string;
  targetCommentId?: string;
  targetPostId?: string;
}) => {
  const targetKind = targetCommentId ? 'comment' : 'post';
  const type = externalModActionType({ action, targetKind });
  if (!type) return undefined;

  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) return undefined;

  const targetIds =
    targetKind === 'comment'
      ? [normalizeCommentId(targetCommentId ?? '')]
      : [normalizePostId(targetPostId ?? normalizedPostId)];

  return appendAction(normalizedPostId, {
    type,
    actor: moderatorName ?? 'mod',
    detail: externalModActionDetail({ action, moderatorName, targetKind }),
    targetIds,
  });
};
