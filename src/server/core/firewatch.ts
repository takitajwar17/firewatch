import { context, redis, reddit } from '@devvit/web/server';
import type {
  FirewatchConfig,
  Incident,
  IncidentAction,
  IncidentSignal,
  SignalSource,
} from '../../shared/api';
import {
  COOLDOWN_COMMENT_TEXT,
  DEFAULT_CONFIG,
  INDEX_KEY,
  MAX_ACTIONS,
  MAX_RECENT_SIGNALS,
} from './firewatch-constants';
import {
  calculateIncident,
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
  normalizePostId,
  normalizeStatus,
  normalizeThresholds,
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

export const getConfig = async (
  subredditName = context.subredditName
): Promise<FirewatchConfig> => {
  const stored = await redis.get(configKey(subredditName));
  if (!stored) return DEFAULT_CONFIG;

  try {
    const parsed: Partial<FirewatchConfig> = JSON.parse(stored);
    const thresholds = normalizeThresholds(
      Number(parsed.heatThreshold ?? DEFAULT_CONFIG.heatThreshold),
      Number(parsed.fireThreshold ?? DEFAULT_CONFIG.fireThreshold),
      Number(parsed.wildfireThreshold ?? DEFAULT_CONFIG.wildfireThreshold)
    );

    return {
      keywords: parsed.keywords?.length
        ? parsed.keywords
        : DEFAULT_CONFIG.keywords,
      suspiciousDomains: parsed.suspiciousDomains?.length
        ? parsed.suspiciousDomains
        : DEFAULT_CONFIG.suspiciousDomains,
      ...thresholds,
    };
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
}) => {
  const current = await getConfig();
  const thresholds = normalizeThresholds(
    Number(values.heatThreshold ?? current.heatThreshold),
    Number(values.fireThreshold ?? current.fireThreshold),
    Number(values.wildfireThreshold ?? current.wildfireThreshold)
  );
  const nextConfig: FirewatchConfig = {
    keywords: parseCsv(values.keywords, current.keywords),
    suspiciousDomains: parseCsv(
      values.suspiciousDomains,
      current.suspiciousDomains
    ),
    ...thresholds,
  };

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
    console.error(`Failed to refresh sanitized incident ${normalizedPostId}`, error);
    await saveIncident(sanitizedIncident);
  }
};

const getPostSnapshot = async (postId: string) => {
  const post = await reddit.getPostById(normalizePostId(postId));

  return {
    title: post.title || 'Untitled post',
    permalink: post.permalink,
    subredditName: post.subredditName,
    numberOfReports: post.numberOfReports,
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
  const baseIncident: Incident =
    existing ??
    {
      postId,
      subredditName: postSnapshot.subredditName,
      title: postSnapshot.title,
      permalink: postSnapshot.permalink,
      score: 0,
      level: 'watch',
      peakScore: 0,
      peakLevel: 'watch',
      status: 'open',
      createdAt: now(),
      updatedAt: now(),
      reasons: [],
      flaggedComments: [],
      recentSignals: [],
      involvedUsers: [],
      repeatedPhrases: [],
      stats: makeEmptyStats(),
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
    await redis.set(claimKey(normalizedPostId), JSON.stringify(incident.claim), {
      expiration: retentionExpiration(),
      nx: true,
    });
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
    detail: storedClaim.username !== actor
      ? `Already taken by u/${storedClaim.username}`
      : `Taken by u/${actor}`,
  });
};

export const coolDownIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  const comment = await post.addComment({
    text: COOLDOWN_COMMENT_TEXT,
  });
  await comment.distinguish(true);

  await upsertIncidentSignal({
    type: 'comment_create',
    source: 'firewatch_notice',
    postId: normalizedPostId,
    commentId: comment.id,
    author: context.appSlug,
    body: COOLDOWN_COMMENT_TEXT,
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
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  await post.lock();

  return appendAction(normalizedPostId, {
    type: 'locked',
    actor,
    detail: 'Locked post',
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
  reason?: string
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await reddit.getCommentById(normalizedCommentId);
  await comment.remove(false);
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
    reason?.trim() || `Banned u/${normalizedUsername} from r/${context.subredditName}`;
  const removalResults = await Promise.all(
    targetIds.map((commentId) =>
      removeCommentIfReal(sourceIncident, commentId, actionReason)
    )
  );
  const redditRemovalCount = removalResults.filter(Boolean).length;
  const demoRemovalCount = targetIds.length - redditRemovalCount;
  const demoOnly = targetComments.every((comment) =>
    isDemoComment(sourceIncident, comment.id)
  );

  if (!demoOnly) {
    await reddit.banUser({
      context: contextCommentId,
      duration: 0,
      note: actionReason,
      reason: 'Firewatch moderation',
      subredditName: context.subredditName,
      username: normalizedUsername,
    });
  }

  const actor = await actorName();
  const removalDetail =
    demoRemovalCount === 0
      ? `Removed ${targetIds.length} comment${targetIds.length === 1 ? '' : 's'}`
      : redditRemovalCount === 0
        ? `Marked ${demoRemovalCount} demo comment${
            demoRemovalCount === 1 ? '' : 's'
          } removed`
        : `Removed ${redditRemovalCount} comment${
            redditRemovalCount === 1 ? '' : 's'
          } and marked ${demoRemovalCount} demo comment${
            demoRemovalCount === 1 ? '' : 's'
          } removed`;
  const incident = await appendAction(normalizedPostId, {
    type: 'user_banned',
    actor,
    detail: demoOnly
      ? `${removalDetail}; recorded demo ban for u/${normalizedUsername}`
      : `${removalDetail}; banned u/${normalizedUsername}`,
    targetIds,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
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
    `Why this needed review: ${topReasons || 'No active review reasons'}`,
    `Comments reviewed: ${incident.flaggedComments.length}`,
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

  const actor = await actorName();
  const escalationSummary = buildEscalationSummary(incident);
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
  const summary = buildSummary(resolved);
  const refreshedIncident = await refreshIncident({
    ...resolved,
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

export const createDemoIncident = async () => {
  const config = await getConfig();
  const seed = now();
  const keyword = demoKeyword(config);
  const secondKeyword = pick(config.keywords, 4, 'report');
  const suspiciousDomain = pick(config.suspiciousDomains, 0, 'bit.ly');
  const scenario = `rapid replies, reports, ${keyword} mentions, watched domains, and repeated wording`;
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title: `[Firewatch demo] Mod queue drill ${new Date(seed).toLocaleTimeString()}`,
    text: [
      'This is a Firewatch demo post generated by the app.',
      'The mod queue is populated through the same path used by comments, reports, and posts sent by mods.',
      'Mods can test taking the post, adding a sticky reminder, removing comments, locking the post, saving a handoff note, and marking it handled without waiting for real reports.',
    ].join('\n\n'),
  });
  const authors = [
    'demoScout',
    'demoRegular',
    'demoNewcomer',
    'demoWatcher',
    'demoHelper',
    'demoConcerned',
  ];
  const repeatedPhrase = 'mods are hiding evidence';
  const branchParentId = `t1_fw_demo_branch_${seed.toString(36)}`;
  const bodies = [
    `This suddenly looks like a ${keyword} from outside the community. ${repeatedPhrase}.`,
    `I keep seeing the same claim. ${repeatedPhrase} and nobody is answering.`,
    `Please check this ${suspiciousDomain}/post before it spreads further.`,
    `The argument is looping now. ${repeatedPhrase}.`,
    `This feels like a ${secondKeyword} issue and the replies are getting personal.`,
    `Several new accounts are repeating the same line in this branch.`,
    `I reported the suspicious link and the ${keyword} comments.`,
    `Can a mod step in before everyone piles onto the same user?`,
  ];
  for (const [index, body] of bodies.entries()) {
    const createdAt = seed - (bodies.length - index) * 4 * 60 * 1000;
    const commentId = `t1_fw_demo_${seed.toString(36)}_${index}`;
    await upsertIncidentSignal({
      type: 'comment_create',
      source: 'user',
      postId: post.id,
      commentId,
      author: authors[index % authors.length],
      body,
      parentId: index < 6 ? branchParentId : post.id,
      createdAt,
      isDemo: true,
      metadata: {
        scenario,
        generatedIndex: index,
      },
    });

    if ([1, 2, 6].includes(index)) {
      await upsertIncidentSignal({
        type: 'comment_report',
        source: 'report',
        postId: post.id,
        commentId,
        author: authors[index % authors.length],
        body,
        parentId: index < 6 ? branchParentId : post.id,
        reason: index === 2 ? 'Suspicious link' : 'Personal attacks',
        createdAt: createdAt + 60 * 1000,
        isDemo: true,
        metadata: {
          scenario,
          generatedIndex: index,
        },
      });
    }
  }

  await upsertIncidentSignal({
    type: 'post_report',
    source: 'report',
    postId: post.id,
    body: `${post.title}\nDemo report: repeated wording and watched domains`,
    reason: 'Post needs mod review',
    createdAt: seed - 2 * 60 * 1000,
    isDemo: true,
    metadata: {
      scenario,
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
      scenario,
    },
  });

  const actor = await actorName();
  const withAction = await appendAction(incident.postId, {
    type: 'demo_seeded',
    actor,
    detail: `Created demo post with ${bodies.length} comment events and 4 report/manual events`,
  });
  const demoIncident: Incident = {
    ...withAction,
    demo: {
      scenario,
      seededAt: seed,
    },
  };

  await saveIncident(demoIncident);
  return demoIncident;
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
      console.error(`Stored Firewatch queue post could not be opened: ${error}`);
    }
  }

  return await createFirewatchPost();
};
