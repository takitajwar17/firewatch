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
  normalizePostId,
  normalizeStatus,
  normalizeUsername,
  now,
} from '../firewatch-utils';
import { externalModActionDetail, externalModActionType } from '../mod-actions';


// Signal input and recent-signal dedupe
export type SignalInput = Omit<IncidentSignal, 'id' | 'createdAt' | 'source'> & {
  createdAt?: number;
  postSnapshot?: PostSnapshot;
  source?: SignalSource;
};

const DEDUPED_SIGNAL_TYPES = new Set<IncidentSignal['type']>([
  'post_create',
  'post_update',
  'comment_create',
  'mod_action',
  'automod_filter',
]);

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
  const parentId =
    input.parentId && input.parentId.startsWith('t1_')
      ? normalizeCommentId(input.parentId)
      : input.parentId
        ? normalizePostId(input.parentId)
        : undefined;
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
  const index = await getIndex();
  await redis.del(incidentKey(normalizedPostId), claimKey(normalizedPostId));
  await saveIndex(index.filter((id) => id !== normalizedPostId));
  await removeFromIncidentRegistry(context.subredditName, normalizedPostId);

  if (context.subredditName) {
    const boardPostId = await redis.get(boardPostKey(context.subredditName));
    if (boardPostId === normalizedPostId) {
      await redis.del(boardPostKey(context.subredditName));
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
    (signal) => signal.commentId !== normalizedCommentId
  );
  const sanitizedActions = incident.actions.map((action) => {
    if (
      !action.targetIds?.includes(normalizedCommentId) &&
      !action.detail.includes(normalizedCommentId)
    ) {
      return action;
    }

    return {
      ...action,
      detail: 'Action referenced a comment that was later deleted on Reddit',
      targetIds: action.targetIds?.filter((id) => id !== normalizedCommentId),
      summary: undefined,
    };
  });
  const sanitizedIncident: Incident = {
    ...incident,
    actions: sanitizedActions,
    escalationSummary: undefined,
    flaggedComments: incident.flaggedComments.filter(
      (comment) => comment.id !== normalizedCommentId
    ),
    involvedUsers: [],
    reasons: [],
    recentSignals: sanitizedSignals,
    repeatedPhrases: [],
    summary: undefined,
    trend: [],
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
    await saveIncident(sanitizedIncident);
  }
};



export const upsertIncidentSignal = async (input: SignalInput) => {
  const { config, incident, triggerType } = await recordIncidentSignal(input);
  const ruleLogs = await recordRuleMatches({
    config,
    incident,
    triggerType,
  });
  return runRuleAutomationActions(incident, ruleLogs);
};

export const getIncidents = async () => {
  const index = await getIndex();
  const registry = await getIncidentRegistry();
  const candidatePostIds = Array.from(new Set([...index, ...registry]));
  const incidents = (
    await Promise.all(
      candidatePostIds.map(async (postId) => {
        const incident = await getIncident(postId);
        if (!incident) return undefined;

        return incident;
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
