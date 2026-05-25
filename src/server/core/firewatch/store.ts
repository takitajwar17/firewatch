import { context, redis, reddit } from '@devvit/web/server';
import type { FirewatchConfig, Incident } from '../../../shared/api';
import type {
  FirewatchConfigFormDefaults,
  FirewatchConfigUpdate,
} from '../../../shared/firewatch-config';
import { DEFAULT_CONFIG, INDEX_KEY } from '../firewatch-constants';
import {
  configKey,
  deriveIncidentStatus,
  incidentKey,
  normalizeConfig,
  normalizePostId,
  parseCsv,
  retentionExpiration,
  selectionExpiration,
  selectionKey,
} from '../firewatch-utils';


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

export const getIndex = async () => {
  const stored = await redis.get(INDEX_KEY);
  if (!stored) return [];

  try {
    const parsed: string[] = JSON.parse(stored);
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
};

export const saveIndex = async (postIds: string[]) => {
  await redis.set(
    INDEX_KEY,
    JSON.stringify(Array.from(new Set(postIds.filter(Boolean))).slice(0, 100))
  );
};

export const addToIndex = async (postId: string) => {
  const index = await getIndex();
  const nextIndex = [postId, ...index.filter((id) => id !== postId)].slice(
    0,
    100
  );
  await saveIndex(nextIndex);
};

export const removeFromIndex = async (postId: string) => {
  const index = await getIndex();
  await saveIndex(index.filter((id) => id !== postId));
};

export const getIncident = async (postId: string) => {
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

export const shouldShowInQueue = (incident: Incident) => {
  const status = deriveIncidentStatus(incident);
  const hasUnresolvedComments = incident.flaggedComments.some(
    (comment) => !comment.removed && !comment.reviewed
  );

  if (
    (status === 'handled' || status === 'resolved') &&
    !hasUnresolvedComments
  ) {
    return false;
  }

  return incident.score > 0 || hasUnresolvedComments || status !== 'open';
};

export const saveIncident = async (incident: Incident) => {
  await redis.set(incidentKey(incident.postId), JSON.stringify(incident), {
    expiration: retentionExpiration(),
  });
  if (shouldShowInQueue(incident)) {
    await addToIndex(incident.postId);
  } else {
    await removeFromIndex(incident.postId);
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
