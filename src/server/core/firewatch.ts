import { context, redis, reddit } from '@devvit/web/server';
import type {
  CrowdControlLevel,
  FirewatchConfig,
  FirewatchDemoScenarioId,
  Incident,
  IncidentAction,
  IncidentSignal,
  NativeCommentAction,
  NativePostAction,
  NativeUserAction,
  SignalSource,
} from '../../shared/api';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  getDemoScenario,
} from '../../shared/firewatch-presets';
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

export const saveConfig = async (values: {
  keywords?: string;
  suspiciousDomains?: string;
  heatThreshold?: number;
  fireThreshold?: number;
  wildfireThreshold?: number;
  reminderText?: string;
  actionControls?: Partial<FirewatchConfig['actionControls']>;
  signalWeights?: Partial<FirewatchConfig['signalWeights']>;
}) => {
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

export const getConfigFormDefaults = async () => {
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
  return calculateIncident(incident, config, postSnapshot);
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
  const nextIncident = calculateIncident(
    {
      ...baseIncident,
      status: nextStatus,
      resolvedAt: undefined,
      recentSignals: [signal, ...baseIncident.recentSignals].slice(
        0,
        MAX_RECENT_SIGNALS
      ),
    },
    await getConfig(postSnapshot.subredditName),
    postSnapshot
  );

  await saveIncident(nextIncident);
  return nextIncident;
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

  return visibleIncidents
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, 25);
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

export const coolDownIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.stickyReminder) {
    throw new Error('Sticky reminders are disabled in Firewatch settings');
  }
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  const comment = await post.addComment({
    text: config.reminderText,
  });
  await comment.distinguish(true);

  await upsertIncidentSignal({
    type: 'comment_create',
    source: 'firewatch_notice',
    postId: normalizedPostId,
    commentId: comment.id,
    author: context.appSlug,
    body: config.reminderText,
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
    throw new Error('Post locking is disabled in Firewatch settings');
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

const externalModActionType = ({
  action,
  targetKind,
}: {
  action: string;
  targetKind: 'comment' | 'post';
}): IncidentAction['type'] | undefined => {
  if (targetKind === 'comment') {
    switch (action) {
      case 'approvecomment':
        return 'comment_approved';
      case 'removecomment':
        return 'comment_removed';
      case 'spamcomment':
        return 'comment_spammed';
      case 'lock':
        return 'comment_locked';
      case 'unlock':
        return 'comment_unlocked';
      case 'ignorereports':
        return 'comment_reports_ignored';
      case 'unignorereports':
        return 'comment_reports_unignored';
      case 'showcomment':
        return 'comment_shown';
      default:
        return undefined;
    }
  }

  switch (action) {
    case 'approvelink':
      return 'post_approved';
    case 'removelink':
      return 'post_removed';
    case 'spamlink':
      return 'post_spammed';
    case 'lock':
      return 'locked';
    case 'unlock':
      return 'post_unlocked';
    case 'marknsfw':
    case 'unmarknsfw':
      return 'post_nsfw';
    case 'spoiler':
    case 'unspoiler':
      return 'post_spoiler';
    case 'ignorereports':
      return 'post_reports_ignored';
    case 'unignorereports':
      return 'post_reports_unignored';
    case 'adjust_post_crowd_control_level':
      return 'post_crowd_control';
    default:
      return undefined;
  }
};

const externalModActionDetail = ({
  action,
  moderatorName,
  targetKind,
}: {
  action: string;
  moderatorName?: string;
  targetKind: 'comment' | 'post';
}) => {
  const actor = moderatorName ? formatUserHandle(moderatorName) : 'a mod';
  const target = targetKind === 'comment' ? 'comment' : 'post';
  const labels: Record<string, string> = {
    adjust_post_crowd_control_level: `Adjusted Crowd Control on ${target}`,
    approvecomment: 'Approved comment',
    approvelink: 'Approved post',
    ignorereports: `Ignored reports on ${target}`,
    lock: `Locked ${target}`,
    marknsfw: 'Marked post NSFW',
    removecomment: 'Removed comment',
    removelink: 'Removed post',
    showcomment: 'Marked comment as shown',
    spamcomment: 'Removed comment as spam',
    spamlink: 'Removed post as spam',
    spoiler: 'Marked post spoiler',
    unignorereports: `Stopped ignoring reports on ${target}`,
    unlock: `Unlocked ${target}`,
    unmarknsfw: 'Removed NSFW tag',
    unspoiler: 'Removed spoiler tag',
  };

  return `${labels[action] ?? `Recorded ${action}`} outside Firewatch by ${actor}`;
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
    throw new Error('Comment approvals are disabled in Firewatch settings');
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
    throw new Error('Comment removals are disabled in Firewatch settings');
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
  return refreshedIncident;
};

export const banUserAndRemoveComments = async (
  postId: string,
  username: string,
  reason?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot ban an unknown user');

  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(sourceIncident.subredditName);
  if (!config.actionControls.banUsers) {
    throw new Error('User bans are disabled in Firewatch settings');
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
      duration: 0,
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

const postActionControl = (
  action: NativePostAction
): keyof FirewatchConfig['actionControls'] => {
  switch (action) {
    case 'approve':
      return 'approvePosts';
    case 'remove':
      return 'removePosts';
    case 'spam':
      return 'markPostSpam';
    case 'unlock':
      return 'unlockPost';
    case 'mark-nsfw':
    case 'unmark-nsfw':
      return 'markPostNsfw';
    case 'mark-spoiler':
    case 'unmark-spoiler':
      return 'markPostSpoiler';
    case 'ignore-reports':
    case 'unignore-reports':
      return 'ignoreReports';
    case 'crowd-control':
      return 'crowdControl';
    case 'set-flair':
      return 'setPostFlair';
  }
};

const nativePostActionType = (
  action: NativePostAction
): IncidentAction['type'] => {
  switch (action) {
    case 'approve':
      return 'post_approved';
    case 'remove':
      return 'post_removed';
    case 'spam':
      return 'post_spammed';
    case 'unlock':
      return 'post_unlocked';
    case 'mark-nsfw':
    case 'unmark-nsfw':
      return 'post_nsfw';
    case 'mark-spoiler':
    case 'unmark-spoiler':
      return 'post_spoiler';
    case 'ignore-reports':
      return 'post_reports_ignored';
    case 'unignore-reports':
      return 'post_reports_unignored';
    case 'crowd-control':
      return 'post_crowd_control';
    case 'set-flair':
      return 'post_flaired';
  }
};

const postActionDetail = ({
  action,
  crowdControlLevel,
  flairText,
  reason,
}: {
  action: NativePostAction;
  crowdControlLevel?: CrowdControlLevel;
  flairText?: string;
  reason?: string;
}) => {
  switch (action) {
    case 'approve':
      return 'Approved post';
    case 'remove':
      return `Removed post${reason ? `: ${reason}` : ''}`;
    case 'spam':
      return `Removed post as spam${reason ? `: ${reason}` : ''}`;
    case 'unlock':
      return 'Unlocked post';
    case 'mark-nsfw':
      return 'Marked post NSFW';
    case 'unmark-nsfw':
      return 'Removed NSFW tag';
    case 'mark-spoiler':
      return 'Marked post spoiler';
    case 'unmark-spoiler':
      return 'Removed spoiler tag';
    case 'ignore-reports':
      return 'Ignored future reports on post';
    case 'unignore-reports':
      return 'Stopped ignoring post reports';
    case 'crowd-control':
      return `Set crowd control to ${crowdControlLevel ?? 'MEDIUM'}`;
    case 'set-flair':
      return flairText ? `Set post flair to "${flairText}"` : 'Set post flair';
  }
};

const validateCrowdControlLevel = (
  level: string | undefined
): CrowdControlLevel => {
  if (
    level === 'OFF' ||
    level === 'LENIENT' ||
    level === 'MEDIUM' ||
    level === 'STRICT'
  ) {
    return level;
  }
  return 'MEDIUM';
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
      'This Reddit post action is disabled in Firewatch settings'
    );
  }

  const actor = await actorName();
  const post = await reddit.getPostById(normalizedPostId);
  const reason = values.reason?.trim();
  const removalNote = trimRemovalNote(reason);
  const flairText = values.flairText?.trim().slice(0, 64);
  const crowdControlLevel = validateCrowdControlLevel(values.crowdControlLevel);

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

const commentActionControl = (
  action: NativeCommentAction
): keyof FirewatchConfig['actionControls'] => {
  switch (action) {
    case 'spam':
      return 'markCommentSpam';
    case 'lock':
    case 'unlock':
      return 'lockComments';
    case 'ignore-reports':
    case 'unignore-reports':
      return 'ignoreReports';
    case 'remove-thread':
      return 'removeCommentThreads';
    case 'show-comment':
      return 'showComments';
  }
};

const nativeCommentActionType = (
  action: NativeCommentAction
): IncidentAction['type'] => {
  switch (action) {
    case 'spam':
      return 'comment_spammed';
    case 'lock':
      return 'comment_locked';
    case 'unlock':
      return 'comment_unlocked';
    case 'ignore-reports':
      return 'comment_reports_ignored';
    case 'unignore-reports':
      return 'comment_reports_unignored';
    case 'remove-thread':
      return 'comment_thread_removed';
    case 'show-comment':
      return 'comment_shown';
  }
};

const commentActionDetail = ({
  action,
  count,
  reason,
}: {
  action: NativeCommentAction;
  count: number;
  reason?: string;
}) => {
  switch (action) {
    case 'spam':
      return `Removed comment as spam${reason ? `: ${reason}` : ''}`;
    case 'lock':
      return 'Locked comment';
    case 'unlock':
      return 'Unlocked comment';
    case 'ignore-reports':
      return 'Ignored future reports on comment';
    case 'unignore-reports':
      return 'Stopped ignoring comment reports';
    case 'remove-thread':
      return `Removed comment thread (${count} comment${count === 1 ? '' : 's'})${
        reason ? `: ${reason}` : ''
      }`;
    case 'show-comment':
      return 'Marked comment as shown';
  }
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
      'This Reddit comment action is disabled in Firewatch settings'
    );
  }
  if (
    values.action === 'remove-thread' &&
    !config.actionControls.removeComments
  ) {
    throw new Error('Comment removals are disabled in Firewatch settings');
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

const userActionControl = (
  action: NativeUserAction
): keyof FirewatchConfig['actionControls'] => {
  switch (action) {
    case 'approve':
      return 'approveUsers';
    case 'mute':
      return 'muteUsers';
    case 'add-mod-note':
      return 'addModNotes';
    case 'remove-recent-content':
      return 'removeUserContent';
  }
};

const nativeUserActionType = (
  action: NativeUserAction
): IncidentAction['type'] => {
  switch (action) {
    case 'approve':
      return 'user_approved';
    case 'mute':
      return 'user_muted';
    case 'add-mod-note':
      return 'mod_note_added';
    case 'remove-recent-content':
      return 'user_content_removed';
  }
};

const userActionDetail = ({
  action,
  count,
  note,
  username,
}: {
  action: NativeUserAction;
  count: number;
  note?: string;
  username: string;
}) => {
  switch (action) {
    case 'approve':
      return `Approved u/${username} in this subreddit`;
    case 'mute':
      return `Muted u/${username} from modmail${note ? `: ${note}` : ''}`;
    case 'add-mod-note':
      return `Added native mod note for u/${username}${note ? `: ${note}` : ''}`;
    case 'remove-recent-content':
      return `Removed ${count} recent item${count === 1 ? '' : 's'} from u/${username}`;
  }
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
      'This Reddit user action is disabled in Firewatch settings'
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
  ].join('\n');
};

export const escalateIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.handoffNotes) {
    throw new Error('Handoff notes are disabled in Firewatch settings');
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
    throw new Error('Mark handled is disabled in Firewatch settings');
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
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title: `[Firewatch demo] ${scenario.label} ${new Date(seed).toLocaleTimeString()}`,
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

  await saveIncident(demoIncident);
  return demoIncident;
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
