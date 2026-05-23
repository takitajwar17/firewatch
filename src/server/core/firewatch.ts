import { context, redis, reddit } from '@devvit/web/server';
import type {
  FirewatchConfig,
  FirewatchDemoScenarioId,
  Incident,
  IncidentAction,
  IncidentSignal,
  NativeCommentAction,
  NativePostAction,
  NativeUserAction,
  RuleExecutionLog,
  SignalSource,
} from '../../shared/api';
import {
  commentActionControl,
  commentActionDetail,
  nativeCommentActionType,
  nativePostActionType,
  nativeUserActionType,
  parseCrowdControlLevel,
  postActionControl,
  postActionDetail,
  userActionControl,
  userActionDetail,
} from '../../shared/reddit-actions';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  getDemoScenario,
} from '../../shared/firewatch-presets';
import type {
  FirewatchConfigFormDefaults,
  FirewatchConfigUpdate,
} from '../../shared/firewatch-config';
import { sortIncidentsByPriority } from '../../shared/incidents';
import { ruleActionRunDisposition } from '../../shared/response-rules';
import {
  DEFAULT_CONFIG,
  INDEX_KEY,
  MAX_ACTIONS,
  MAX_RECENT_SIGNALS,
} from './firewatch-constants';
import {
  calculateIncident,
  makeEmptyImpact,
  getResponseSuggestion,
  makeEmptyStats,
} from './firewatch-scoring';
import {
  addUserStrike,
  attachRuleContext,
  clearUserStrikes,
  getRuleExecutionLogs,
  recordRuleExecutionLog,
  recordRuleMatches,
} from './firewatch-rules';
import { externalModActionDetail, externalModActionType } from './mod-actions';
import {
  boardPostKey,
  claimKey,
  configKey,
  deriveIncidentStatus,
  formatLevel,
  formatStatus,
  formatUserHandle,
  incidentKey,
  inferSignalSource,
  makeId,
  normalizeCommentId,
  normalizeConfig,
  normalizePostId,
  normalizeStatus,
  normalizeUsername,
  now,
  parseCsv,
  retentionExpiration,
  selectionExpiration,
  selectionKey,
} from './firewatch-utils';

type SignalInput = Omit<IncidentSignal, 'id' | 'createdAt' | 'source'> & {
  createdAt?: number;
  source?: SignalSource;
};

type IncidentClaim = NonNullable<Incident['claim']>;

const parseStoredClaim = (
  value: string,
  fallback: IncidentClaim
): IncidentClaim => {
  try {
    const parsed: Partial<IncidentClaim> = JSON.parse(value);
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.claimedAt === 'number'
    ) {
      return {
        username: parsed.username,
        claimedAt: parsed.claimedAt,
      };
    }
  } catch (error) {
    console.error('Failed to parse Firewatch claim', error);
  }

  return fallback;
};

const mergeConfigList = (
  storedList: string[] | undefined,
  defaultList: string[]
) =>
  Array.from(
    new Set(
      [...defaultList, ...(storedList ?? [])]
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );

export const getConfig = async (
  subredditName = context.subredditName
): Promise<FirewatchConfig> => {
  const stored = await redis.get(configKey(subredditName));
  if (!stored) return DEFAULT_CONFIG;

  try {
    const parsed: Partial<FirewatchConfig> = JSON.parse(stored);
    return normalizeConfig({
      keywords: mergeConfigList(parsed.keywords, DEFAULT_CONFIG.keywords),
      suspiciousDomains: mergeConfigList(
        parsed.suspiciousDomains,
        DEFAULT_CONFIG.suspiciousDomains
      ),
      heatThreshold: parsed.heatThreshold,
      fireThreshold: parsed.fireThreshold,
      wildfireThreshold: parsed.wildfireThreshold,
      reminderText: parsed.reminderText,
      actionControls: parsed.actionControls,
      signalWeights: parsed.signalWeights,
    });
  } catch (error) {
    console.error('Failed to parse Firewatch config', error);
    return DEFAULT_CONFIG;
  }
};

export const saveConfig = async (values: FirewatchConfigUpdate) => {
  const current = await getConfig();
  const nextConfig = normalizeConfig({
    keywords: parseCsv(values.keywords, current.keywords),
    suspiciousDomains: parseCsv(
      values.suspiciousDomains,
      current.suspiciousDomains
    ),
    heatThreshold: values.heatThreshold ?? current.heatThreshold,
    fireThreshold: values.fireThreshold ?? current.fireThreshold,
    wildfireThreshold: values.wildfireThreshold ?? current.wildfireThreshold,
    reminderText: values.reminderText ?? current.reminderText,
    actionControls: {
      ...current.actionControls,
      ...values.actionControls,
    },
    signalWeights: {
      ...current.signalWeights,
      ...values.signalWeights,
    },
  });

  await redis.set(configKey(context.subredditName), JSON.stringify(nextConfig));
  return nextConfig;
};

export const getConfigFormDefaults =
  async (): Promise<FirewatchConfigFormDefaults> => {
    const config = await getConfig();

    return {
      keywords: config.keywords.join(', '),
      suspiciousDomains: config.suspiciousDomains.join(', '),
      heatThreshold: config.heatThreshold,
      fireThreshold: config.fireThreshold,
      wildfireThreshold: config.wildfireThreshold,
      reminderText: config.reminderText,
      actionControls: config.actionControls,
      signalWeights: config.signalWeights,
    };
  };

const getIndex = async () => {
  const stored = await redis.get(INDEX_KEY);
  if (!stored) return [];

  try {
    const parsed: string[] = JSON.parse(stored);
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
};

const saveIndex = async (postIds: string[]) => {
  await redis.set(
    INDEX_KEY,
    JSON.stringify(Array.from(new Set(postIds.filter(Boolean))).slice(0, 100))
  );
};

const addToIndex = async (postId: string) => {
  const index = await getIndex();
  const nextIndex = [postId, ...index.filter((id) => id !== postId)].slice(
    0,
    100
  );
  await saveIndex(nextIndex);
};

const removeFromIndex = async (postId: string) => {
  const index = await getIndex();
  await saveIndex(index.filter((id) => id !== postId));
};

const getIncident = async (postId: string) => {
  const stored = await redis.get(incidentKey(postId));
  if (!stored) return undefined;

  try {
    const parsed: Incident = JSON.parse(stored);
    return parsed;
  } catch (error) {
    console.error(`Failed to parse incident ${postId}`, error);
    return undefined;
  }
};

const shouldShowInQueue = (incident: Incident) =>
  incident.score > 0 ||
  incident.actions.length > 0 ||
  deriveIncidentStatus(incident) !== 'open';

const saveIncident = async (incident: Incident) => {
  await redis.set(incidentKey(incident.postId), JSON.stringify(incident), {
    expiration: retentionExpiration(),
  });
  if (shouldShowInQueue(incident)) {
    await addToIndex(incident.postId);
  } else {
    await removeFromIndex(incident.postId);
  }
};

export const deleteStoredPostContent = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const index = await getIndex();
  await redis.del(incidentKey(normalizedPostId), claimKey(normalizedPostId));
  await saveIndex(index.filter((id) => id !== normalizedPostId));

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
    console.error(
      `Failed to refresh sanitized incident ${normalizedPostId}`,
      error
    );
    await saveIncident(sanitizedIncident);
  }
};

const getPostSnapshot = async (postId: string) => {
  const post = await reddit.getPostById(normalizePostId(postId));
  const createdAt = post.createdAt.getTime();

  return {
    title: post.title || 'Untitled post',
    permalink: post.permalink,
    subredditName: post.subredditName,
    numberOfReports: post.numberOfReports,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
  };
};

const refreshIncident = async (incident: Incident) => {
  const postSnapshot = await getPostSnapshot(incident.postId);
  const config = await getConfig(postSnapshot.subredditName);
  const calculated = calculateIncident(incident, config, postSnapshot);
  return attachRuleContext(calculated, config);
};

const signalRuleTrigger = (signal: IncidentSignal) => {
  if (signal.type === 'comment_create') return 'new_comment';
  if (signal.type === 'post_create') return 'new_post';
  if (signal.type === 'comment_report') return 'comment_report';
  if (signal.type === 'post_report') return 'post_report';
  if (signal.type === 'mod_action') {
    if (
      signal.metadata?.action === 'removecomment' ||
      signal.metadata?.action === 'spamcomment'
    ) {
      return 'comment_removed';
    }
    if (
      signal.metadata?.action === 'removelink' ||
      signal.metadata?.action === 'spamlink'
    ) {
      return 'post_removed';
    }
  }
  return 'incident_score_changed';
};

export const upsertIncidentSignal = async (input: SignalInput) => {
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
  const postSnapshot = await getPostSnapshot(postId);
  const existing = await getIncident(postId);
  const signal: IncidentSignal = {
    ...input,
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
    level: 'watch',
    peakScore: 0,
    peakLevel: 'watch',
    status: 'open',
    createdAt: postSnapshot.createdAt ?? signal.createdAt,
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
  const nextStatus =
    signal.type === 'manual_escalation' ||
    baseIncident.status === 'resolved' ||
    baseIncident.status === 'handled'
      ? 'open'
      : normalizeStatus(baseIncident.status);
  const config = await getConfig(postSnapshot.subredditName);
  const calculatedIncident = calculateIncident(
    {
      ...baseIncident,
      status: nextStatus,
      resolvedAt: undefined,
      recentSignals: [signal, ...baseIncident.recentSignals].slice(
        0,
        MAX_RECENT_SIGNALS
      ),
    },
    config,
    postSnapshot
  );
  const nextIncident = await attachRuleContext(calculatedIncident, config);

  await saveIncident(nextIncident);
  const ruleLogs = await recordRuleMatches({
    config,
    incident: nextIncident,
    triggerType: signalRuleTrigger(signal),
  });
  return runRuleAutomationActions(nextIncident, ruleLogs);
};

export const getIncidents = async () => {
  const index = await getIndex();
  const incidents = (
    await Promise.all(
      index.map(async (postId) => {
        const incident = await getIncident(postId);
        if (!incident) return undefined;

        try {
          const refreshed = await refreshIncident(incident);
          await saveIncident(refreshed);
          return refreshed;
        } catch (error) {
          console.error(`Failed to refresh incident ${postId}`, error);
          return incident;
        }
      })
    )
  ).filter((incident): incident is Incident => Boolean(incident));
  const visibleIncidents = incidents.filter(shouldShowInQueue);
  await saveIndex(visibleIncidents.map((incident) => incident.postId));

  return sortIncidentsByPriority(visibleIncidents).slice(0, 25);
};

export const getIncidentById = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) return undefined;

  try {
    const refreshed = await refreshIncident(incident);
    await saveIncident(refreshed);
    return refreshed;
  } catch (error) {
    console.error(`Failed to refresh incident ${normalizedPostId}`, error);
    return incident;
  }
};

const appendAction = async (
  postId: string,
  action: Omit<IncidentAction, 'id' | 'createdAt'>
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const nextIncident: Incident = {
    ...incident,
    updatedAt: now(),
    actions: [
      {
        ...action,
        id: makeId('act'),
        createdAt: now(),
      },
      ...incident.actions,
    ].slice(0, MAX_ACTIONS),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const getIncidentOrThrow = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  return incident;
};

const currentUsername = async () =>
  context.username ?? (await reddit.getCurrentUsername()) ?? undefined;

const actorName = async () => (await currentUsername()) ?? 'mod';

export const rememberSelectedIncident = async (postId: string) => {
  const username = await currentUsername();
  if (!username) return;

  await redis.set(
    selectionKey(context.subredditName, username),
    normalizePostId(postId),
    {
      expiration: selectionExpiration(),
    }
  );
};

export const getRememberedIncidentPostId = async (username?: string) => {
  const resolvedUsername = username ?? (await currentUsername());
  if (!resolvedUsername) return undefined;

  const postId = await redis.get(
    selectionKey(context.subredditName, resolvedUsername)
  );

  return postId ? normalizePostId(postId) : undefined;
};

export const claimIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const claimedAt = now();
  const existingClaim = incident.claim ?? {
    username: actor,
    claimedAt,
  };

  if (incident.claim) {
    await redis.set(
      claimKey(normalizedPostId),
      JSON.stringify(incident.claim),
      {
        expiration: retentionExpiration(),
        nx: true,
      }
    );
  }

  const claimValue = JSON.stringify(existingClaim);
  const createdClaim = incident.claim
    ? undefined
    : await redis.set(claimKey(normalizedPostId), claimValue, {
        expiration: retentionExpiration(),
        nx: true,
      });
  const storedClaim = createdClaim
    ? existingClaim
    : parseStoredClaim(
        (await redis.get(claimKey(normalizedPostId))) ?? claimValue,
        existingClaim
      );
  const claimed: Incident = {
    ...incident,
    claim: storedClaim,
    updatedAt: now(),
  };

  await saveIncident(claimed);
  return appendAction(normalizedPostId, {
    type: 'claimed',
    actor,
    detail:
      storedClaim.username !== actor
        ? `Already taken by u/${storedClaim.username}`
        : `Taken by u/${actor}`,
  });
};

export const coolDownIncident = async (
  postId: string,
  reminderText?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.stickyReminder) {
    throw new Error('Sticky reminders are disabled in Settings');
  }
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  const text = reminderText?.trim() || config.reminderText;
  const comment = await post.addComment({
    text,
  });
  await comment.distinguish(true);

  await upsertIncidentSignal({
    type: 'comment_create',
    source: 'firewatch_notice',
    postId: normalizedPostId,
    commentId: comment.id,
    author: context.appSlug,
    body: text,
    createdAt: now(),
    metadata: {
      firewatchNotice: true,
    },
  });

  return appendAction(normalizedPostId, {
    type: 'cool_down',
    actor,
    detail: `Added sticky mod reminder ${comment.id}`,
  });
};

export const lockIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.lockPost) {
    throw new Error('Post locking is disabled in Settings');
  }
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  await post.lock();

  return appendAction(normalizedPostId, {
    type: 'locked',
    actor,
    detail: 'Locked post',
  });
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

const isDemoComment = (incident: Incident, commentId: string) =>
  normalizeCommentId(commentId).startsWith('t1_fw_demo_') ||
  incident.recentSignals.some(
    (signal) =>
      signal.commentId === normalizeCommentId(commentId) && signal.isDemo
  );

const trimRemovalNote = (reason: string | undefined) => {
  const trimmed = reason?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 100);
};

const removeCommentIfReal = async (
  incident: Incident,
  commentId: string,
  reason?: string,
  isSpam = false
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await reddit.getCommentById(normalizedCommentId);
  await comment.remove(isSpam);
  const modNote = trimRemovalNote(reason);
  if (modNote) {
    await comment.addRemovalNote({
      reasonId: '',
      modNote,
    });
  }

  return true;
};

const approveCommentIfReal = async (incident: Incident, commentId: string) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await reddit.getCommentById(normalizedCommentId);
  await comment.approve();
  return true;
};

export const approveFlaggedComment = async (
  postId: string,
  commentId: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.approveComments) {
    throw new Error('Comment approvals are disabled in Settings');
  }

  const actor = await actorName();
  const approvedOnReddit = await approveCommentIfReal(
    sourceIncident,
    normalizedCommentId
  );
  const incident = await appendAction(normalizedPostId, {
    type: 'comment_approved',
    actor,
    detail: approvedOnReddit
      ? `Approved comment ${normalizedCommentId}`
      : `Marked demo comment ${normalizedCommentId} approved`,
    targetIds: [normalizedCommentId],
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      flaggedComment.id === normalizedCommentId
        ? { ...flaggedComment, reviewed: true }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

export const removeFlaggedComment = async (
  postId: string,
  commentId: string,
  reason?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.removeComments) {
    throw new Error('Comment removals are disabled in Settings');
  }

  const actor = await actorName();
  const removedOnReddit = await removeCommentIfReal(
    sourceIncident,
    normalizedCommentId,
    reason
  );
  const incident = await appendAction(normalizedPostId, {
    type: 'comment_removed',
    actor,
    detail: removedOnReddit
      ? `Removed comment ${normalizedCommentId}${reason ? `: ${reason}` : ''}`
      : `Marked demo comment ${normalizedCommentId} removed`,
    targetIds: [normalizedCommentId],
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      flaggedComment.id === normalizedCommentId
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  const ruleLogs = await recordRuleMatches({
    config,
    incident: refreshedIncident,
    triggerType: 'comment_removed',
  });
  return runRuleAutomationActions(refreshedIncident, ruleLogs);
};

export const banUserAndRemoveComments = async (
  postId: string,
  username: string,
  reason?: string,
  durationDays?: number
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot ban an unknown user');

  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.banUsers) {
    throw new Error('User bans are disabled in Settings');
  }
  if (!config.actionControls.removeComments) {
    throw new Error('Comment removals are required before banning users');
  }

  const targetComments = sourceIncident.flaggedComments.filter(
    (comment) =>
      !comment.removed &&
      !comment.reviewed &&
      normalizeUsername(comment.author)?.toLowerCase() ===
        normalizedUsername.toLowerCase()
  );
  if (targetComments.length === 0) {
    throw new Error(`No unreviewed comments from u/${normalizedUsername}`);
  }

  const targetIds = targetComments.map((comment) => comment.id);
  const contextCommentId = targetIds[0];
  if (!contextCommentId) {
    throw new Error(`No unreviewed comments from u/${normalizedUsername}`);
  }
  const actionReason =
    reason?.trim() ||
    `Banned u/${normalizedUsername} from r/${sourceIncident.subredditName}`;
  const removedContentIds = await removeRecentUserContent(
    sourceIncident,
    normalizedUsername,
    actionReason
  );
  const demoOnly = targetComments.every((comment) =>
    isDemoComment(sourceIncident, comment.id)
  );

  if (!demoOnly) {
    await reddit.banUser({
      context: contextCommentId,
      duration: durationDays ?? 0,
      note: actionReason,
      reason: 'Firewatch moderation',
      subredditName: sourceIncident.subredditName,
      username: normalizedUsername,
    });
  }

  const actor = await actorName();
  const removalDetail = demoOnly
    ? `Marked ${removedContentIds.length} demo comment${
        removedContentIds.length === 1 ? '' : 's'
      } removed`
    : `Removed ${removedContentIds.length} recent subreddit item${
        removedContentIds.length === 1 ? '' : 's'
      }`;
  const incident = await appendAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: demoOnly
      ? `${removalDetail}; recorded demo ban for u/${normalizedUsername}`
      : `${removalDetail}; banned u/${normalizedUsername}`,
    targetIds: removedContentIds,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      removedContentIds.includes(flaggedComment.id)
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const banPreparedRuleUser = async ({
  contextId,
  durationDays,
  postId,
  reason,
  username,
}: {
  contextId?: string;
  durationDays?: number;
  postId: string;
  reason: string;
  username: string;
}) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot ban an unknown user');

  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.banUsers) {
    throw new Error('User bans are disabled in Settings');
  }

  const actor = await actorName();
  const actionReason =
    reason.trim() ||
    `Banned u/${normalizedUsername} from r/${incident.subredditName}`;
  const durationLabel =
    durationDays && durationDays > 0 ? `${durationDays}-day` : 'permanent';
  const demoUser = isDemoUser(incident, normalizedUsername);

  if (!demoUser) {
    await reddit.banUser({
      context: contextId ?? normalizedPostId,
      duration: durationDays ?? 0,
      note: actionReason,
      reason: 'Firewatch automation',
      subredditName: incident.subredditName,
      username: normalizedUsername,
    });
  }

  return appendAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: demoUser
      ? `Recorded demo ${durationLabel} ban for u/${normalizedUsername}: ${actionReason}`
      : `Banned u/${normalizedUsername} (${durationLabel}): ${actionReason}`,
    targetIds: [normalizedUsername],
  });
};

export const applyNativePostAction = async (
  postId: string,
  values: {
    action: NativePostAction;
    crowdControlLevel?: string;
    flairText?: string;
    reason?: string;
  }
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  const control = postActionControl(values.action);
  if (!config.actionControls[control]) {
    throw new Error(
      'This Reddit post action is disabled in Settings'
    );
  }

  const actor = await actorName();
  const post = await reddit.getPostById(normalizedPostId);
  const reason = values.reason?.trim();
  const removalNote = trimRemovalNote(reason);
  const flairText = values.flairText?.trim().slice(0, 64);
  const crowdControlLevel = parseCrowdControlLevel(values.crowdControlLevel);

  switch (values.action) {
    case 'approve':
      await post.approve();
      break;
    case 'remove':
      await post.remove(false);
      if (removalNote) {
        await post.addRemovalNote({ reasonId: '', modNote: removalNote });
      }
      break;
    case 'spam':
      await post.remove(true);
      if (removalNote) {
        await post.addRemovalNote({ reasonId: '', modNote: removalNote });
      }
      break;
    case 'unlock':
      await post.unlock();
      break;
    case 'mark-nsfw':
      await post.markAsNsfw();
      break;
    case 'unmark-nsfw':
      await post.unmarkAsNsfw();
      break;
    case 'mark-spoiler':
      await post.markAsSpoiler();
      break;
    case 'unmark-spoiler':
      await post.unmarkAsSpoiler();
      break;
    case 'ignore-reports':
      await post.ignoreReports();
      break;
    case 'unignore-reports':
      await post.unignoreReports();
      break;
    case 'crowd-control':
      await post.updateCrowdControlLevel(crowdControlLevel);
      break;
    case 'set-flair':
      if (!flairText) throw new Error('Enter post flair text first');
      await reddit.setPostFlair({
        postId: normalizedPostId,
        subredditName: incident.subredditName,
        text: flairText,
      });
      break;
  }

  return appendAction(normalizedPostId, {
    type: nativePostActionType(values.action),
    actor,
    detail: postActionDetail({
      action: values.action,
      crowdControlLevel,
      flairText,
      reason,
    }),
    targetIds: [normalizedPostId],
  });
};

const collectThreadCommentIds = async (
  incident: Incident,
  commentId: string
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) {
    return [normalizedCommentId];
  }

  const comments = await reddit
    .getComments({
      postId: normalizePostId(incident.postId),
      commentId: normalizedCommentId,
      depth: 10,
      limit: 100,
      pageSize: 100,
    })
    .all();

  return Array.from(
    new Set([normalizedCommentId, ...comments.map((comment) => comment.id)])
  );
};

export const applyNativeCommentAction = async (
  postId: string,
  commentId: string,
  values: {
    action: NativeCommentAction;
    reason?: string;
  }
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  const control = commentActionControl(values.action);
  if (!config.actionControls[control]) {
    throw new Error(
      'This Reddit comment action is disabled in Settings'
    );
  }
  if (
    values.action === 'remove-thread' &&
    !config.actionControls.removeComments
  ) {
    throw new Error('Comment removals are disabled in Settings');
  }

  const actor = await actorName();
  const reason = values.reason?.trim();
  let targetIds: string[] = [normalizedCommentId];

  if (values.action === 'remove-thread') {
    targetIds = await collectThreadCommentIds(incident, normalizedCommentId);
    await Promise.all(
      targetIds.map((targetId) =>
        removeCommentIfReal(incident, targetId, reason)
      )
    );
  } else if (values.action === 'spam') {
    await removeCommentIfReal(incident, normalizedCommentId, reason, true);
  } else if (!isDemoComment(incident, normalizedCommentId)) {
    const comment = await reddit.getCommentById(normalizedCommentId);
    if (values.action === 'lock') await comment.lock();
    if (values.action === 'unlock') await comment.unlock();
    if (values.action === 'ignore-reports') await comment.ignoreReports();
    if (values.action === 'unignore-reports') await comment.unignoreReports();
    if (values.action === 'show-comment') await comment.showComment();
  }

  const withAction = await appendAction(normalizedPostId, {
    type: nativeCommentActionType(values.action),
    actor,
    detail: commentActionDetail({
      action: values.action,
      count: targetIds.length,
      reason,
    }),
    targetIds,
  });

  if (values.action !== 'remove-thread' && values.action !== 'spam') {
    return withAction;
  }

  const nextIncident: Incident = {
    ...withAction,
    flaggedComments: withAction.flaggedComments.map((flaggedComment) =>
      targetIds.includes(flaggedComment.id)
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const trackedCommentIdsByUser = (incident: Incident, username: string) =>
  incident.flaggedComments
    .filter(
      (comment) =>
        !comment.removed &&
        normalizeUsername(comment.author)?.toLowerCase() ===
          username.toLowerCase()
    )
    .map((comment) => comment.id);

const isDemoUser = (incident: Incident, username: string) =>
  Boolean(incident.demo) &&
  incident.recentSignals.some(
    (signal) =>
      signal.isDemo &&
      normalizeUsername(signal.author)?.toLowerCase() === username.toLowerCase()
  );

const removeRecentUserContent = async (
  incident: Incident,
  username: string,
  reason?: string
) => {
  const trackedIds = trackedCommentIdsByUser(incident, username);
  const removedIds = new Set<string>();

  await Promise.all(
    trackedIds.map(async (commentId) => {
      await removeCommentIfReal(incident, commentId, reason);
      removedIds.add(commentId);
    })
  );

  const demoOnly =
    Boolean(incident.demo) &&
    trackedIds.length > 0 &&
    trackedIds.every((commentId) => isDemoComment(incident, commentId));

  if (demoOnly) return Array.from(removedIds);

  const recentItems = await reddit
    .getCommentsAndPostsByUser({
      username,
      sort: 'new',
      timeframe: 'all',
      limit: 1000,
      pageSize: 100,
    })
    .all();
  const subredditItems = recentItems.filter(
    (item) => item.subredditName === incident.subredditName
  );

  for (const item of subredditItems) {
    if (removedIds.has(item.id)) continue;
    if (item.isRemoved()) {
      removedIds.add(item.id);
      continue;
    }
    await item.remove(false);
    const modNote = trimRemovalNote(reason);
    if (modNote) {
      await item.addRemovalNote({
        reasonId: '',
        modNote,
      });
    }
    removedIds.add(item.id);
  }

  return Array.from(removedIds);
};

export const applyNativeUserAction = async (
  postId: string,
  username: string,
  values: {
    action: NativeUserAction;
    note?: string;
    reason?: string;
  }
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot act on an unknown user');

  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  const control = userActionControl(values.action);
  if (!config.actionControls[control]) {
    throw new Error(
      'This Reddit user action is disabled in Settings'
    );
  }

  const actor = await actorName();
  const note =
    values.note?.trim() ||
    values.reason?.trim() ||
    'Firewatch moderator action';
  let targetIds = [normalizedUsername];
  const demoUser = isDemoUser(incident, normalizedUsername);

  if (values.action === 'approve' && !demoUser) {
    await reddit.approveUser(normalizedUsername, incident.subredditName);
  }
  if (values.action === 'mute' && !demoUser) {
    await reddit.muteUser({
      note,
      subredditName: incident.subredditName,
      username: normalizedUsername,
    });
  }
  if (values.action === 'add-mod-note' && !demoUser) {
    await reddit.addModNote({
      label: 'SPAM_WATCH',
      note: note.slice(0, 250),
      redditId: normalizedPostId,
      subreddit: incident.subredditName,
      user: normalizedUsername,
    });
  }
  if (values.action === 'remove-recent-content') {
    targetIds = await removeRecentUserContent(
      incident,
      normalizedUsername,
      values.reason
    );
  }

  const withAction = await appendAction(normalizedPostId, {
    type: nativeUserActionType(values.action),
    actor,
    detail: userActionDetail({
      action: values.action,
      count: targetIds.length,
      note,
      username: normalizedUsername,
    }),
    targetIds,
  });

  if (values.action !== 'remove-recent-content') return withAction;

  const nextIncident: Incident = {
    ...withAction,
    flaggedComments: withAction.flaggedComments.map((flaggedComment) =>
      targetIds.includes(flaggedComment.id)
        ? { ...flaggedComment, removed: true, reviewed: false }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

export const clearIncidentUserStrikes = async (
  postId: string,
  username: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot clear unknown user');

  const incident = await getIncidentOrThrow(normalizedPostId);
  await clearUserStrikes(incident.subredditName, normalizedUsername);

  const actor = await actorName();
  return appendAction(normalizedPostId, {
    type: 'rule_action_executed',
    actor,
    detail: `Cleared Firewatch strikes for u/${normalizedUsername}`,
    targetIds: [normalizedUsername],
  });
};

const ruleDraftSummary = (
  incident: Incident,
  match: NonNullable<Incident['matchedRules']>[number],
  template: string | undefined
) =>
  [
    template ?? `${match.ruleName} matched and prepared a draft handoff.`,
    `Incident: ${incident.title}`,
    `Target: ${match.username ? formatUserHandle(match.username) : match.targetId}`,
    'Why it matched:',
    ...match.why.map((reason) => `- ${reason}`),
    'Prepared actions:',
    ...match.preparedActions.map((action) => `- ${action.label}`),
  ].join('\n');

const preparedRuleDetail = (
  match: NonNullable<Incident['matchedRules']>[number],
  prepared: NonNullable<Incident['matchedRules']>[number]['preparedActions'][number]
) => {
  const action = prepared.action;
  if (action.type === 'sticky_reminder') {
    return `Prepared sticky reminder from ${match.ruleName}`;
  }
  if (action.type === 'prepare_temp_ban') {
    return `Prepared ${action.durationDays}-day ban for ${formatUserHandle(prepared.username)} from ${match.ruleName}: ${action.reason}`;
  }
  if (action.type === 'prepare_permanent_ban') {
    return `Prepared permanent ban for ${formatUserHandle(prepared.username)} from ${match.ruleName}: ${action.reason}`;
  }
  return `Prepared ${prepared.label} from ${match.ruleName}`;
};

const runAutoSafeRuleActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const autoRunLogs = logs.filter(
    (log) =>
      log.mode === 'auto_run_safe_actions' && log.executedActions.length > 0
  );
  if (autoRunLogs.length === 0) return incident;

  let currentIncident = incident;

  for (const log of autoRunLogs) {
    const match = currentIncident.matchedRules?.find(
      (rule) => rule.ruleId === log.ruleId && rule.targetId === log.targetId
    );
    if (!match) continue;

    for (const prepared of match.preparedActions) {
      if (prepared.risk !== 'safe') continue;

      const action = prepared.action;
      if (action.type === 'add_firewatch_strike') {
        if (!prepared.username) continue;
        await addUserStrike({
          createdBy: 'firewatch',
          reason: action.reason,
          relatedCommentId:
            prepared.targetType === 'comment' ? prepared.targetId : undefined,
          relatedPostId: normalizePostId(currentIncident.postId),
          source: 'rule_match',
          subredditName: currentIncident.subredditName,
          username: prepared.username,
          weight: action.weight ?? 1,
        });
        currentIncident = await appendAction(currentIncident.postId, {
          type: 'firewatch_strike_added',
          actor: 'firewatch',
          detail: `Auto-ran ${match.ruleName}: added Firewatch strike to ${formatUserHandle(prepared.username)}: ${action.reason}`,
          targetIds: [prepared.username],
        });
        continue;
      }

      if (action.type === 'generate_handoff') {
        const draft = ruleDraftSummary(currentIncident, match, action.template);
        const withAction = await appendAction(currentIncident.postId, {
          type: 'rule_action_executed',
          actor: 'firewatch',
          detail: `Auto-ran ${match.ruleName}: generated draft handoff`,
          summary: draft,
        });
        currentIncident = {
          ...withAction,
          escalationSummary: draft,
          updatedAt: now(),
        };
        await saveIncident(currentIncident);
        continue;
      }

      if (
        action.type === 'save_firewatch_log' ||
        action.type === 'queue_incident'
      ) {
        currentIncident = await appendAction(currentIncident.postId, {
          type: 'rule_action_executed',
          actor: 'firewatch',
          detail:
            action.type === 'queue_incident'
              ? `Auto-ran ${match.ruleName}: queued incident because ${action.reason}`
              : `Auto-ran ${match.ruleName}: ${action.message}`,
          targetIds: [match.targetId],
        });
      }
    }
  }

  const refreshedIncident = await refreshIncident(currentIncident);
  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

export const runPreparedRuleActions = async (
  postId: string,
  ruleId: string,
  actorOverride?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await refreshIncident(
    await getIncidentOrThrow(normalizedPostId)
  );
  const match = incident.matchedRules?.find((rule) => rule.ruleId === ruleId);
  if (!match) throw new Error('Response rule no longer matches this incident');

  const actor = actorOverride ?? (await actorName());
  const executedActions: string[] = [];
  const skippedActions: string[] = [];
  let currentIncident = incident;
  const existingLogs = await getRuleExecutionLogs(currentIncident.subredditName);
  const alreadyExecuted = new Set(
    existingLogs
      .filter(
        (log) => log.ruleId === match.ruleId && log.targetId === match.targetId
      )
      .flatMap((log) => log.executedActions)
  );

  for (const prepared of match.preparedActions) {
    const action = prepared.action;
    const disposition = ruleActionRunDisposition(action);

    if (alreadyExecuted.has(prepared.label)) {
      skippedActions.push(`${prepared.label}: already executed`);
      continue;
    }

    if (disposition === 'prepare') {
      currentIncident = await appendAction(normalizedPostId, {
        type: 'rule_prepared',
        actor,
        detail: preparedRuleDetail(match, prepared),
        summary: action.type === 'sticky_reminder' ? action.text : undefined,
        targetIds: [prepared.targetId ?? match.targetId],
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'sticky_reminder') {
      currentIncident = await coolDownIncident(normalizedPostId, action.text);
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'prepare_temp_ban') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      currentIncident = await banPreparedRuleUser({
        contextId: prepared.targetId,
        durationDays: action.durationDays,
        postId: normalizedPostId,
        reason: action.reason,
        username: prepared.username,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'prepare_permanent_ban') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      currentIncident = await banPreparedRuleUser({
        contextId: prepared.targetId,
        postId: normalizedPostId,
        reason: action.reason,
        username: prepared.username,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'remove_comment') {
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await removeFlaggedComment(
        normalizedPostId,
        prepared.targetId,
        action.reason
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'approve_comment') {
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await approveFlaggedComment(
        normalizedPostId,
        prepared.targetId
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'remove_post') {
      currentIncident = await applyNativePostAction(normalizedPostId, {
        action: 'remove',
        reason: action.reason,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'approve_post') {
      currentIncident = await applyNativePostAction(normalizedPostId, {
        action: 'approve',
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'mark_spam') {
      if (action.target === 'post') {
        currentIncident = await applyNativePostAction(normalizedPostId, {
          action: 'spam',
          reason: `Marked by automation: ${match.ruleName}`,
        });
        executedActions.push(prepared.label);
        continue;
      }
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await applyNativeCommentAction(
        normalizedPostId,
        prepared.targetId,
        {
          action: 'spam',
          reason: `Marked by automation: ${match.ruleName}`,
        }
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'lock_post') {
      currentIncident = await lockIncident(normalizedPostId);
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'set_post_flair') {
      currentIncident = await applyNativePostAction(normalizedPostId, {
        action: 'set-flair',
        flairText: action.flairText,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'ignore_reports') {
      if (action.target === 'post') {
        currentIncident = await applyNativePostAction(normalizedPostId, {
          action: 'ignore-reports',
        });
        executedActions.push(prepared.label);
        continue;
      }
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await applyNativeCommentAction(
        normalizedPostId,
        prepared.targetId,
        {
          action: 'ignore-reports',
        }
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'mute_user') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      const muteReason = action.durationDays
        ? `${action.reason} Requested duration: ${action.durationDays} day${
            action.durationDays === 1 ? '' : 's'
          }.`
        : action.reason;
      currentIncident = await applyNativeUserAction(
        normalizedPostId,
        prepared.username,
        {
          action: 'mute',
          note: muteReason,
          reason: muteReason,
        }
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'mark_handled') {
      currentIncident = await resolveIncident(normalizedPostId);
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'add_firewatch_strike') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      await addUserStrike({
        createdBy: actor,
        reason: action.reason,
        relatedCommentId:
          prepared.targetType === 'comment' ? prepared.targetId : undefined,
        relatedPostId: normalizedPostId,
        source: 'rule_match',
        subredditName: currentIncident.subredditName,
        username: prepared.username,
        weight: action.weight ?? 1,
      });
      currentIncident = await appendAction(normalizedPostId, {
        type: 'firewatch_strike_added',
        actor,
        detail: `Added Firewatch strike to ${formatUserHandle(prepared.username)}: ${action.reason}`,
        targetIds: [prepared.username],
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'add_native_mod_note') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      if (!isDemoUser(currentIncident, prepared.username)) {
        await reddit.addModNote({
          label: 'SPAM_WATCH',
          note: action.note.slice(0, 250),
          redditId: normalizedPostId,
          subreddit: currentIncident.subredditName,
          user: prepared.username,
        });
      }
      currentIncident = await appendAction(normalizedPostId, {
        type: 'mod_note_added',
        actor,
        detail: `Added native mod note for ${formatUserHandle(prepared.username)} from ${match.ruleName}`,
        targetIds: [prepared.username],
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'generate_handoff') {
      const draft = ruleDraftSummary(currentIncident, match, action.template);
      const withAction = await appendAction(normalizedPostId, {
        type: 'rule_action_executed',
        actor,
        detail: `Generated draft handoff from ${match.ruleName}`,
        summary: draft,
      });
      currentIncident = {
        ...withAction,
        escalationSummary: draft,
        updatedAt: now(),
      };
      await saveIncident(currentIncident);
      executedActions.push(prepared.label);
      continue;
    }

    if (
      action.type === 'save_firewatch_log' ||
      action.type === 'queue_incident'
    ) {
      currentIncident = await appendAction(normalizedPostId, {
        type: 'rule_action_executed',
        actor,
        detail:
          action.type === 'queue_incident'
            ? `Queued by automation: ${action.reason}`
            : action.message,
        targetIds: [match.targetId],
      });
      executedActions.push(prepared.label);
      continue;
    }

    skippedActions.push(`${prepared.label}: left prepared for native review`);
  }

  await recordRuleExecutionLog({
    ruleId: match.ruleId,
    ruleName: match.ruleName,
    triggerType: 'prepared_actions_run',
    targetType: match.targetType,
    targetId: match.targetId,
    matchedConditions: match.why,
    preparedActions: match.preparedActions.map((action) => action.label),
    executedActions,
    skippedActions,
    mode: match.mode,
    actor,
  });
  const config = await getConfig(currentIncident.subredditName);
  const refreshedIncident = await attachRuleContext(
    await refreshIncident(currentIncident),
    config
  );
  await saveIncident(refreshedIncident);

  return refreshedIncident;
};

const ruleAutomationErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown automation action failure';

const runAutoAllRuleActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const autoRunLogs = logs.filter(
    (log) => log.mode === 'auto_run_all_selected_actions'
  );
  if (autoRunLogs.length === 0) return incident;

  let currentIncident = incident;

  for (const log of autoRunLogs) {
    try {
      currentIncident = await runPreparedRuleActions(
        currentIncident.postId,
        log.ruleId,
        'firewatch'
      );
    } catch (error) {
      await recordRuleExecutionLog({
        ruleId: log.ruleId,
        ruleName: log.ruleName,
        triggerType: 'auto_run_all_failed',
        targetType: log.targetType,
        targetId: log.targetId,
        matchedConditions: log.matchedConditions,
        preparedActions: log.preparedActions,
        executedActions: [],
        skippedActions: [ruleAutomationErrorMessage(error)],
        mode: log.mode,
        actor: 'firewatch',
      });
    }
  }

  return currentIncident;
};

const runRuleAutomationActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const withAutoSafe = await runAutoSafeRuleActions(incident, logs);
  return runAutoAllRuleActions(withAutoSafe, logs);
};

const buildSummary = (incident: Incident) => {
  const handler =
    incident.claim?.username ??
    incident.actions.find((action) => action.type === 'claimed')?.actor;
  const topReasons = incident.reasons
    .slice(0, 3)
    .map((reason) => `${reason.label} (+${reason.points})`)
    .join(', ');
  const commonPhrases = incident.repeatedPhrases
    .slice(0, 3)
    .map((phrase) => `"${phrase.phrase}" x${phrase.count}`)
    .join(', ');
  const involvedUsers = incident.involvedUsers
    .slice(0, 5)
    .map((user) => formatUserHandle(user.username))
    .join(', ');
  const actionLines = incident.actions
    .slice(0, 5)
    .map((action) => `- ${action.detail}`)
    .join('\n');
  const matchedRules = (incident.matchedRules ?? [])
    .slice(0, 5)
    .map(
      (rule) =>
        `- ${rule.ruleName}: ${rule.why.join('; ')}; prepared ${rule.preparedActions
          .map((action) => action.label)
          .join(', ')}`
    )
    .join('\n');
  const resolutionTime =
    incident.resolvedAt && incident.createdAt
      ? `${Math.max(1, Math.round((incident.resolvedAt - incident.createdAt) / 60000))}m`
      : 'unresolved';

  return [
    `Final mod note for ${incident.title}`,
    `Started at: ${new Date(incident.createdAt).toISOString()}`,
    `Peak incident score: ${incident.peakScore}/100 (${formatLevel(incident.peakLevel)})`,
    `Final status: ${formatStatus(incident.status)}`,
    `Time open: ${resolutionTime}`,
    `Impact: ${incident.impact.reportsGrouped} reports grouped, ${incident.impact.commentsReviewed} comments reviewed, ${incident.impact.actionsTaken} mod actions recorded`,
    `Why this needed review: ${topReasons || 'No active review reasons'}`,
    `Comments reviewed: ${incident.impact.commentsReviewed}`,
    `Comments still waiting: ${incident.impact.commentsAwaitingReview}`,
    `Handled by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
    `Users in post: ${involvedUsers || 'none detected'}`,
    `Repeated wording: ${commonPhrases || 'none detected'}`,
    'Matched automations:',
    matchedRules || '- No active automations matched',
    'Recent actions:',
    actionLines || '- No mod actions yet',
  ].join('\n');
};

const buildEscalationSummary = (incident: Incident) => {
  const handler =
    incident.claim?.username ??
    incident.actions.find((action) => action.type === 'claimed')?.actor;
  const unresolved = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );
  const topReasons = incident.reasons
    .slice(0, 4)
    .map((reason) => `${reason.label}: ${reason.detail}`)
    .join('\n');
  const topComments = unresolved
    .slice(0, 5)
    .map(
      (comment) =>
        `- ${formatUserHandle(comment.author)} (${comment.score}): ${comment.body.slice(0, 180)}`
    )
    .join('\n');
  const matchedRules = (incident.matchedRules ?? [])
    .slice(0, 5)
    .map(
      (rule) =>
        `- ${rule.ruleName}: ${rule.why.join('; ')}; prepared ${rule.preparedActions
          .map((action) => action.label)
          .join(', ')}`
    )
    .join('\n');

  return [
    `Mod handoff note: ${incident.title}`,
    `Current attention: ${incident.score}/100 (${formatLevel(incident.level)}); peak incident score: ${incident.peakScore}/100; suggested action: ${incident.responseSuggestion.label}`,
    `Post: ${incident.permalink ?? incident.postId}`,
    `Handled by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
    `Impact so far: ${incident.impact.reportsGrouped} reports grouped, ${incident.impact.commentsReviewed} comments reviewed, ${incident.impact.commentsAwaitingReview} comments still waiting`,
    'Why this is here:',
    topReasons || '- No active reasons recorded',
    'Comments to review:',
    topComments || '- No unresolved comments',
    'Matched automations:',
    matchedRules || '- No active automations matched',
  ].join('\n');
};

export const escalateIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.handoffNotes) {
    throw new Error('Handoff notes are disabled in Settings');
  }

  const actor = await actorName();
  const currentIncident = await refreshIncident(incident);
  const escalationSummary = buildEscalationSummary(currentIncident);
  const withAction = await appendAction(normalizedPostId, {
    type: 'escalated',
    actor,
    detail: 'Saved handoff note for the mod team',
    summary: escalationSummary,
  });
  const nextIncident: Incident = {
    ...withAction,
    escalationSummary,
    updatedAt: now(),
  };

  await saveIncident(nextIncident);
  return nextIncident;
};

export const resolveIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.markHandled) {
    throw new Error('Mark handled is disabled in Settings');
  }
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;
  if (unresolvedCount > 0) {
    throw new Error('Review all comments before marking handled');
  }

  const actor = await actorName();
  const resolvedAt = now();
  const resolvedAction: IncidentAction = {
    id: makeId('act'),
    type: 'resolved',
    actor,
    createdAt: now(),
    detail: 'Marked post handled',
  };
  const resolved: Incident = {
    ...incident,
    status: 'handled',
    resolvedAt,
    updatedAt: resolvedAt,
    actions: [resolvedAction, ...incident.actions].slice(0, MAX_ACTIONS),
  };
  const refreshedResolved = await refreshIncident(resolved);
  const summary = buildSummary(refreshedResolved);
  const refreshedIncident = await refreshIncident({
    ...refreshedResolved,
    summary,
  });

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const pick = <T>(items: T[], index: number, fallback: T) =>
  items.length > 0 ? items[index % items.length] : fallback;

const demoKeyword = (config: FirewatchConfig) =>
  config.keywords.find(
    (keyword) => !['kill', 'slur', 'hate'].includes(keyword.toLowerCase())
  ) ?? 'brigade';

type DemoCommentSeed = {
  author: string;
  body: string;
  reportReason?: string;
  branch?: 'cluster' | 'post';
};

const buildDemoComments = ({
  config,
  scenarioId,
}: {
  config: FirewatchConfig;
  scenarioId: FirewatchDemoScenarioId;
}): DemoCommentSeed[] => {
  const keyword = demoKeyword(config);
  const secondKeyword = pick(config.keywords, 4, 'report');
  const suspiciousDomain = pick(config.suspiciousDomains, 0, 'bit.ly');

  if (scenarioId === 'suspicious_giveaway_escalating') {
    return [
      {
        author: 'demoSpammer',
        body: `DM me for free money. The giveaway wallet is at ${suspiciousDomain}/claim and an admin fee gift card unlocks it.`,
        reportReason: 'Scam giveaway link',
        branch: 'cluster',
      },
      {
        author: 'demoNewcomer',
        body: `That ${suspiciousDomain}/claim page asks for my wallet recovery code and says a recovery agent will help.`,
        reportReason: 'Suspicious domain',
        branch: 'cluster',
      },
      {
        author: 'demoSpammer',
        body: 'Message me on telegram for the recovery agent. I can fix accounts if you pay the admin fee.',
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'demoScout',
        body: `This same giveaway phrase keeps repeating: pay the admin fee to unlock free money.`,
        reportReason: 'Repeated scam phrase',
        branch: 'cluster',
      },
      {
        author: 'demoHelper',
        body: 'Do not share recovery codes or wallet details. Use only official support links.',
        branch: 'post',
      },
      {
        author: 'demoConcerned',
        body: `The suspicious giveaway is spreading fast and the same ${secondKeyword} warning keeps coming up.`,
        branch: 'post',
      },
    ];
  }

  if (scenarioId === 'scam_link_cleanup') {
    return [
      {
        author: 'demoScout',
        body: `This looks like a ${keyword} wave. The same account keeps dropping ${suspiciousDomain}/support in replies.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'demoNewcomer',
        body: `Do not click that ${suspiciousDomain}/support link. It asks for passwords and wallet details.`,
        reportReason: 'Unsafe support link',
        branch: 'cluster',
      },
      {
        author: 'demoSpammer',
        body: `DM me for account recovery. Pay the admin fee with a gift card and I can fix it.`,
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'demoSpammer',
        body: `Anyone who wants help should message me on telegram. I know a recovery agent.`,
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'demoHelper',
        body: 'Use the official help center and never share passwords or recovery codes.',
        branch: 'post',
      },
      {
        author: 'demoConcerned',
        body: `The suspicious link is still spreading and people are repeating the same ${secondKeyword} warning.`,
        branch: 'post',
      },
    ];
  }

  if (scenarioId === 'support_safety_cleanup') {
    return [
      {
        author: 'demoHelper',
        body: 'This sounds risky. Please do not post account numbers or private contact details.',
        branch: 'cluster',
      },
      {
        author: 'demoRegular',
        body: `The advice above may be unsafe. A ${keyword} comment is asking users to share passwords.`,
        reportReason: 'Unsafe advice',
        branch: 'cluster',
      },
      {
        author: 'demoNewcomer',
        body: 'I can paste my recovery code here if that helps.',
        reportReason: 'Personal information risk',
        branch: 'cluster',
      },
      {
        author: 'demoWatcher',
        body: `Someone linked ${suspiciousDomain}/verify and asked for personal details.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'demoScout',
        body: 'The safe answer is to contact official support and avoid sharing private info.',
        branch: 'post',
      },
      {
        author: 'demoConcerned',
        body: `The thread needs a mod look before the ${secondKeyword} replies get copied again.`,
        branch: 'post',
      },
    ];
  }

  const repeatedPhrase = 'mods are hiding evidence';
  return [
    {
      author: 'demoScout',
      body: `This suddenly looks like a ${keyword} from outside the community. ${repeatedPhrase}.`,
      branch: 'cluster',
    },
    {
      author: 'demoRegular',
      body: `I keep seeing the same claim. ${repeatedPhrase} and nobody is answering.`,
      reportReason: 'Personal attacks',
      branch: 'cluster',
    },
    {
      author: 'demoNewcomer',
      body: `Please check this ${suspiciousDomain}/post before it spreads further.`,
      reportReason: 'Suspicious link',
      branch: 'cluster',
    },
    {
      author: 'demoWatcher',
      body: `The argument is looping now. ${repeatedPhrase}.`,
      branch: 'cluster',
    },
    {
      author: 'demoHelper',
      body: `This feels like a ${secondKeyword} issue and the replies are getting personal.`,
      branch: 'cluster',
    },
    {
      author: 'demoConcerned',
      body: 'Several new accounts are repeating the same line in this branch.',
      branch: 'cluster',
    },
    {
      author: 'demoScout',
      body: `I reported the suspicious link and the ${keyword} comments.`,
      reportReason: 'Personal attacks',
      branch: 'post',
    },
    {
      author: 'demoRegular',
      body: 'Can a mod step in before everyone piles onto the same user?',
      branch: 'post',
    },
  ];
};

export const createDemoIncident = async (
  scenarioId = DEFAULT_DEMO_SCENARIO_ID
) => {
  const config = await getConfig();
  const seed = now();
  const scenario = getDemoScenario(scenarioId);
  const comments = buildDemoComments({ config, scenarioId: scenario.id });
  const title =
    scenario.id === 'suspicious_giveaway_escalating'
      ? 'Suspicious giveaway thread escalating'
      : `[Firewatch demo] ${scenario.label} ${new Date(seed).toLocaleTimeString()}`;
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title,
    text: [
      `This is a Firewatch demo post for: ${scenario.label}.`,
      'The mod queue is populated through the same path used by comments, reports, and posts sent by mods.',
      'Mods can test taking the post, adding a sticky reminder, removing comments, locking the post, saving a handoff note, and marking it handled without waiting for real reports.',
    ].join('\n\n'),
  });
  const branchParentId = `t1_fw_demo_branch_${seed.toString(36)}`;
  for (const [index, comment] of comments.entries()) {
    const createdAt = seed - (comments.length - index) * 4 * 60 * 1000;
    const commentId = `t1_fw_demo_${seed.toString(36)}_${index}`;
    await upsertIncidentSignal({
      type: 'comment_create',
      source: 'user',
      postId: post.id,
      commentId,
      author: comment.author,
      body: comment.body,
      parentId: comment.branch === 'cluster' ? branchParentId : post.id,
      createdAt,
      isDemo: true,
      metadata: {
        scenario: scenario.label,
        scenarioId: scenario.id,
        generatedIndex: index,
      },
    });

    if (comment.reportReason) {
      await upsertIncidentSignal({
        type: 'comment_report',
        source: 'report',
        postId: post.id,
        commentId,
        author: comment.author,
        body: comment.body,
        parentId: comment.branch === 'cluster' ? branchParentId : post.id,
        reason: comment.reportReason,
        createdAt: createdAt + 60 * 1000,
        isDemo: true,
        metadata: {
          scenario: scenario.label,
          scenarioId: scenario.id,
          generatedIndex: index,
        },
      });
    }
  }

  if (scenario.id === 'suspicious_giveaway_escalating') {
    await addUserStrike({
      createdBy: 'firewatch',
      reason: 'Previous suspicious giveaway link matched a watched domain',
      relatedPostId: post.id,
      source: 'watched_domain',
      subredditName: context.subredditName,
      username: 'demoSpammer',
      weight: 1,
    });
    await addUserStrike({
      createdBy: 'firewatch',
      reason: 'Previous scam phrase matched watched words',
      relatedPostId: post.id,
      source: 'watched_word',
      subredditName: context.subredditName,
      username: 'demoSpammer',
      weight: 1,
    });
  }

  await upsertIncidentSignal({
    type: 'post_report',
    source: 'report',
    postId: post.id,
    body: `${post.title}\nDemo report: ${scenario.description}`,
    reason: 'Post needs mod review',
    createdAt: seed - 2 * 60 * 1000,
    isDemo: true,
    metadata: {
      scenario: scenario.label,
      scenarioId: scenario.id,
    },
  });
  const incident = await upsertIncidentSignal({
    type: 'manual_escalation',
    source: 'mod_action',
    postId: post.id,
    reason: 'Demo post sent for moderator review',
    createdAt: seed,
    isDemo: true,
    metadata: {
      scenario: scenario.label,
      scenarioId: scenario.id,
    },
  });

  const actor = await actorName();
  const withAction = await appendAction(incident.postId, {
    type: 'demo_seeded',
    actor,
    detail: `Created ${scenario.label.toLowerCase()} demo with ${comments.length} comment events and report/manual signals`,
  });
  const demoIncident: Incident = {
    ...withAction,
    demo: {
      scenario: scenario.label,
      scenarioId: scenario.id,
      seededAt: seed,
    },
  };
  const enrichedDemoIncident = await attachRuleContext(demoIncident, config);

  await saveIncident(enrichedDemoIncident);
  const ruleLogs = await recordRuleMatches({
    config,
    incident: enrichedDemoIncident,
    triggerType:
      scenario.id === 'suspicious_giveaway_escalating'
        ? 'user_strike_count_changed'
        : 'incident_score_changed',
  });
  return runRuleAutomationActions(enrichedDemoIncident, ruleLogs);
};

export const resetDemoIncidents = async () => {
  const index = await getIndex();
  let resetCount = 0;
  const keptPostIds: string[] = [];

  for (const postId of index) {
    const incident = await getIncident(postId);
    if (incident?.demo) {
      resetCount += 1;
      await redis.del(incidentKey(postId), claimKey(postId));
    } else {
      keptPostIds.push(postId);
    }
  }

  await saveIndex(keptPostIds);
  return resetCount;
};

export const createFirewatchPost = async (options?: {
  incidentPostId?: string;
}) => {
  const normalizedIncidentPostId = options?.incidentPostId
    ? normalizePostId(options.incidentPostId)
    : undefined;
  const sourcePost = normalizedIncidentPostId
    ? await getPostSnapshot(normalizedIncidentPostId)
    : undefined;

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: sourcePost
      ? `Firewatch review: ${sourcePost.title.slice(0, 220)}`
      : 'Firewatch mod queue',
    entry: 'dashboard',
    postData: normalizedIncidentPostId
      ? {
          incidentPostId: normalizedIncidentPostId,
        }
      : {
          board: true,
        },
    textFallback: {
      text: sourcePost
        ? `Firewatch mod view for ${sourcePost.title}`
        : 'Firewatch mod queue for this community.',
    },
  });

  if (!options?.incidentPostId) {
    await redis.set(boardPostKey(context.subredditName), post.id);
  }

  return post;
};

export const getOrCreateFirewatchBoardPost = async () => {
  const storedPostId = await redis.get(boardPostKey(context.subredditName));

  if (storedPostId) {
    try {
      return await reddit.getPostById(normalizePostId(storedPostId));
    } catch (error) {
      console.error(
        `Stored Firewatch queue post could not be opened: ${error}`
      );
    }
  }

  return await createFirewatchPost();
};
