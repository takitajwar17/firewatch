import { context, redis, reddit } from '@devvit/web/server';
import type {
  FirewatchConfig,
  Incident,
  IncidentImpactSnapshot,
} from '../../../shared/api';
import type {
  FirewatchConfigFormDefaults,
  FirewatchConfigUpdate,
} from '../../../shared/firewatch-config';
import { openCommentCount } from '../../../shared/incidents';
import { DEFAULT_CONFIG, INDEX_KEY } from '../firewatch-constants';
import { responseRulesKey, ruleLogsKey } from '../firewatch-rules/store';
import {
  getTrackedUserStrikeKeys,
  userStrikesKey,
} from '../firewatch-rules/strikes';
import {
  boardPostKey,
  claimKey,
  configKey,
  deriveIncidentStatus,
  indexKey,
  incidentKey,
  incidentRegistryKey,
  normalizeConfig,
  normalizePostId,
  normalizeStatus,
  normalizeUsername,
  parseCsv,
  retentionExpiration,
  selectionExpiration,
  selectionKey,
  userRegistryKey,
  userStrikeKeyRegistryKey,
} from '../firewatch-utils';
import { deleteRedditPostIfExists } from './reddit-runtime';
import { logFirewatchError } from './logging';

const legacyUsersResolvedImpactKey = ['users', 'Han', 'dled'].join('');
type IncidentClaim = NonNullable<Incident['claim']>;

const finiteNumberOrZero = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const legacyUsersResolved = (
  impact: Partial<IncidentImpactSnapshot> | undefined
) => {
  if (!impact) return undefined;

  const value = Reflect.get(impact, legacyUsersResolvedImpactKey);
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const normalizeIncidentImpact = (
  impact: Partial<IncidentImpactSnapshot> | undefined
): IncidentImpactSnapshot => ({
  reportsGrouped: finiteNumberOrZero(impact?.reportsGrouped),
  commentsReviewed: finiteNumberOrZero(impact?.commentsReviewed),
  commentsAwaitingReview: finiteNumberOrZero(impact?.commentsAwaitingReview),
  usersInReview: finiteNumberOrZero(impact?.usersInReview),
  usersResolved: finiteNumberOrZero(
    impact?.usersResolved ?? legacyUsersResolved(impact)
  ),
  actionsTaken: finiteNumberOrZero(impact?.actionsTaken),
  removals: finiteNumberOrZero(impact?.removals),
  approvals: finiteNumberOrZero(impact?.approvals),
  bans: finiteNumberOrZero(impact?.bans),
  handoffSaved: Boolean(impact?.handoffSaved),
  finalNoteSaved: Boolean(impact?.finalNoteSaved),
  timeOpenMinutes: finiteNumberOrZero(impact?.timeOpenMinutes),
  peakAttention: finiteNumberOrZero(impact?.peakAttention),
});

const parseStoredClaim = (
  stored: string | undefined,
  postId: string,
  fallback?: IncidentClaim | undefined
) => {
  if (!stored) return fallback;

  try {
    const parsed: Partial<IncidentClaim> = JSON.parse(stored);
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
    logFirewatchError('store.parse_claim_failed', {
      postId,
      error,
    });
  }

  return fallback;
};

const hydrateStoredClaim = async (incident: Incident) => {
  const key = claimKey(incident.postId);
  const storedClaim = parseStoredClaim(
    await redis.get(key),
    incident.postId,
    incident.claim
  );
  if (storedClaim && !incident.claim) {
    await redis.set(key, JSON.stringify(storedClaim), {
      expiration: retentionExpiration(),
    });
  }

  return storedClaim;
};

const saveStoredClaim = async (incident: Incident) => {
  if (!incident.claim) {
    await redis.del(claimKey(incident.postId));
    return;
  }

  await redis.set(claimKey(incident.postId), JSON.stringify(incident.claim), {
    expiration: retentionExpiration(),
  });
};

// Config and incident persistence
export const getConfig = async (
  subredditName = context.subredditName
): Promise<FirewatchConfig> => {
  const stored = await redis.get(configKey(subredditName));
  if (!stored) return DEFAULT_CONFIG;

  try {
    const parsed: Partial<FirewatchConfig> = JSON.parse(stored);
    return normalizeConfig({
      keywords: parsed.keywords,
      suspiciousDomains: parsed.suspiciousDomains,
      heatThreshold: parsed.heatThreshold,
      fireThreshold: parsed.fireThreshold,
      wildfireThreshold: parsed.wildfireThreshold,
      reminderText: parsed.reminderText,
      actionControls: parsed.actionControls,
      signalWeights: parsed.signalWeights,
    });
  } catch (error) {
    logFirewatchError('store.parse_config_failed', {
      subredditName,
      error,
    });
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

const parseIndex = (stored: string | undefined) => {
  if (!stored) return [];

  try {
    const parsed: string[] = JSON.parse(stored);
    return parsed.filter(Boolean).map(normalizePostId);
  } catch {
    return [];
  }
};

export const getIndex = async (subredditName = context.subredditName) => {
  const scopedIndex = parseIndex(await redis.get(indexKey(subredditName)));
  if (scopedIndex.length > 0) return scopedIndex;

  const legacyIndex = parseIndex(await redis.get(INDEX_KEY));
  if (legacyIndex.length === 0) return [];

  const migratedPostIds: string[] = [];
  for (const postId of legacyIndex) {
    const incident = await getIncident(postId);
    if (incident?.subredditName === subredditName) {
      migratedPostIds.push(normalizePostId(postId));
    }
  }

  if (migratedPostIds.length > 0) {
    await saveIndex(migratedPostIds, subredditName);
  }

  return migratedPostIds;
};

export const saveIndex = async (
  postIds: string[],
  subredditName = context.subredditName
) => {
  await redis.set(
    indexKey(subredditName),
    JSON.stringify(Array.from(new Set(postIds.filter(Boolean))).slice(0, 100))
  );
};

const parseStringList = (stored: string | undefined) => {
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
};

const saveStringList = async (key: string, values: string[]) => {
  await redis.set(
    key,
    JSON.stringify(Array.from(new Set(values.filter(Boolean))).slice(0, 500)),
    { expiration: retentionExpiration() }
  );
};

export const getIncidentRegistry = async (
  subredditName = context.subredditName
) => parseStringList(await redis.get(incidentRegistryKey(subredditName)));

export const addToIncidentRegistry = async (
  subredditName: string,
  postId: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const registry = await getIncidentRegistry(subredditName);
  await saveStringList(incidentRegistryKey(subredditName), [
    normalizedPostId,
    ...registry.filter((id) => id !== normalizedPostId),
  ]);
};

export const removeFromIncidentRegistry = async (
  subredditName: string,
  postId: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const registry = await getIncidentRegistry(subredditName);
  await saveStringList(
    incidentRegistryKey(subredditName),
    registry.filter((id) => id !== normalizedPostId)
  );
};

export const addToIndex = async (
  postId: string,
  subredditName = context.subredditName
) => {
  const index = await getIndex(subredditName);
  const nextIndex = [postId, ...index.filter((id) => id !== postId)].slice(
    0,
    100
  );
  await saveIndex(nextIndex, subredditName);
};

export const removeFromIndex = async (
  postId: string,
  subredditName = context.subredditName
) => {
  const index = await getIndex(subredditName);
  await saveIndex(
    index.filter((id) => id !== postId),
    subredditName
  );
};

export const getIncident = async (
  postId: string
): Promise<Incident | undefined> => {
  const stored = await redis.get(incidentKey(postId));
  if (!stored) return undefined;

  try {
    const parsed: Incident = JSON.parse(stored);
    const claim = await hydrateStoredClaim(parsed);
    return {
      ...parsed,
      claim,
      status: normalizeStatus(parsed.status),
      impact: normalizeIncidentImpact(parsed.impact),
    };
  } catch (error) {
    logFirewatchError('store.parse_incident_failed', {
      postId,
      error,
    });
    return undefined;
  }
};

export const shouldShowInQueue = (incident: Incident) => {
  const status = deriveIncidentStatus(incident);
  const hasUnresolvedComments = openCommentCount(incident) > 0;

  if (status === 'resolved' && !hasUnresolvedComments) {
    return false;
  }

  return incident.score > 0 || hasUnresolvedComments || status !== 'open';
};

export const saveIncident = async (incident: Incident) => {
  await redis.set(incidentKey(incident.postId), JSON.stringify(incident), {
    expiration: retentionExpiration(),
  });
  await saveStoredClaim(incident);
  await addToIncidentRegistry(incident.subredditName, incident.postId);
  if (shouldShowInQueue(incident)) {
    await addToIndex(incident.postId, incident.subredditName);
  } else {
    await removeFromIndex(incident.postId, incident.subredditName);
  }
};



// Current moderator and selected incident state
export const currentUsername = async () =>
  context.username ?? (await reddit.getCurrentUsername()) ?? undefined;

export const actorName = async () => (await currentUsername()) ?? 'mod';

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

export const clearRememberedIncident = async () => {
  const username = await currentUsername();
  if (!username) return;

  await redis.del(selectionKey(context.subredditName, username));
};

const incidentUsernames = (incident: Incident) =>
  [
    incident.postAuthor,
    incident.claim?.username,
    ...incident.actions.flatMap((action) => [
      action.actor,
      ...(action.targetIds ?? []),
    ]),
    ...incident.flaggedComments.map((comment) => comment.author),
    ...incident.involvedUsers.map((user) => user.username),
    ...incident.recentSignals.map((signal) => signal.author),
  ]
    .map(normalizeUsername)
    .filter((username): username is string => Boolean(username));

const getModeratorSelectionUsernames = async (subredditName: string) => {
  const usernames = new Set<string>();
  const current = await currentUsername();
  const normalizedCurrent = normalizeUsername(current);
  if (normalizedCurrent) usernames.add(normalizedCurrent);

  try {
    const moderators = await reddit
      .getModerators({ subredditName, limit: 1000, pageSize: 100 })
      .all();

    for (const moderator of moderators) {
      const username = normalizeUsername(moderator.username);
      if (username) usernames.add(username);
    }
  } catch (error) {
    logFirewatchError('reset.load_moderators_failed', {
      subredditName,
      error,
    });
  }

  return usernames;
};

const deleteRedisKeys = async (keys: string[]) => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (uniqueKeys.length === 0) return 0;

  for (let index = 0; index < uniqueKeys.length; index += 50) {
    await redis.del(...uniqueKeys.slice(index, index + 50));
  }

  return uniqueKeys.length;
};

export const resetAppData = async () => {
  const subredditName = context.subredditName;
  const boardPostId = await redis.get(boardPostKey(subredditName));
  const [
    indexPostIds,
    registeredPostIds,
    trackedUsers,
    trackedUserStrikeKeys,
  ] = await Promise.all([
    getIndex(subredditName),
    getIncidentRegistry(subredditName),
    parseStringList(await redis.get(userRegistryKey(subredditName))),
    getTrackedUserStrikeKeys(subredditName),
  ]);
  const postIds = Array.from(
    new Set([...indexPostIds, ...registeredPostIds].map(normalizePostId))
  );
  const incidents = (
    await Promise.all(postIds.map((postId) => getIncident(postId)))
  ).filter((incident): incident is Incident => Boolean(incident));
  const usernames = new Set(
    trackedUsers
      .map(normalizeUsername)
      .filter((username): username is string => Boolean(username))
  );

  for (const incident of incidents) {
    for (const username of incidentUsernames(incident)) {
      usernames.add(username);
    }
  }

  const selectionUsernames = await getModeratorSelectionUsernames(
    subredditName
  );
  const redditPostIdsToDelete = Array.from(
    new Set([
      ...(boardPostId ? [boardPostId] : []),
      ...incidents
        .filter((incident) => Boolean(incident.demo))
        .map((incident) => incident.postId),
    ])
  );
  let redditPostDeleteFailures = 0;

  for (const postId of redditPostIdsToDelete) {
    try {
      await deleteRedditPostIfExists(postId);
    } catch (error) {
      redditPostDeleteFailures += 1;
      logFirewatchError('reset.reddit_post_delete_failed', {
        postId,
        subredditName,
        error,
      });
    }
  }

  const keysToDelete = [
    INDEX_KEY,
    indexKey(subredditName),
    boardPostKey(subredditName),
    configKey(subredditName),
    incidentRegistryKey(subredditName),
    responseRulesKey(subredditName),
    ruleLogsKey(subredditName),
    userRegistryKey(subredditName),
    userStrikeKeyRegistryKey(subredditName),
    ...postIds.flatMap((postId) => [incidentKey(postId), claimKey(postId)]),
    ...Array.from(selectionUsernames).map((username) =>
      selectionKey(subredditName, username)
    ),
    ...trackedUserStrikeKeys,
    ...Array.from(usernames).map((username) =>
      userStrikesKey(subredditName, username)
    ),
  ];

  return {
    deletedKeys: await deleteRedisKeys(keysToDelete),
    incidentCount: postIds.length,
    redditPostDeleteFailures,
    redditPostDeleteCount: redditPostIdsToDelete.length - redditPostDeleteFailures,
    userCount: usernames.size,
  };
};
