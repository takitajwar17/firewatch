import { context, redis } from '@devvit/web/server';
import type { Incident, UserStrike, UserStrikeSummary } from '../../../shared/api';
import {
  makeId,
  normalizeCommentId,
  normalizePostId,
  normalizeUsername,
  now,
  userRegistryKey,
  userStrikeKeyRegistryKey,
} from '../firewatch-utils';
import {
  currentIso,
  DEFAULT_STRIKE_WINDOW_DAYS,
  MAX_STRIKES_PER_USER,
  parseJsonList,
} from './common';
import { removedCommentCountForUser } from './metrics';

export const userStrikesKey = (subredditName: string, username: string) =>
  `fw:user:${subredditName}:${username.toLowerCase()}:strikes`;

const parseStoredStringList = (stored: string | undefined) => {
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};

const getTrackedUsers = async (subredditName: string) => {
  return parseStoredStringList(await redis.get(userRegistryKey(subredditName)));
};

const trackUser = async (subredditName: string, username: string) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return;
  const trackedUsers = await getTrackedUsers(subredditName);
  await redis.set(
    userRegistryKey(subredditName),
    JSON.stringify(
      Array.from(new Set([normalizedUsername, ...trackedUsers])).slice(0, 500)
    )
  );
};

export const getTrackedUserStrikeKeys = async (subredditName: string) =>
  parseStoredStringList(await redis.get(userStrikeKeyRegistryKey(subredditName)));

const saveTrackedUserStrikeKeys = async (
  subredditName: string,
  keys: string[]
) => {
  await redis.set(
    userStrikeKeyRegistryKey(subredditName),
    JSON.stringify(Array.from(new Set(keys.filter(Boolean))).slice(0, 500))
  );
};

const trackUserStrikeKey = async (subredditName: string, key: string) => {
  const trackedKeys = await getTrackedUserStrikeKeys(subredditName);
  await saveTrackedUserStrikeKeys(subredditName, [
    key,
    ...trackedKeys.filter((trackedKey) => trackedKey !== key),
  ]);
};

const untrackUserStrikeKey = async (subredditName: string, key: string) => {
  const trackedKeys = await getTrackedUserStrikeKeys(subredditName);
  await saveTrackedUserStrikeKeys(
    subredditName,
    trackedKeys.filter((trackedKey) => trackedKey !== key)
  );
};

export const addUserStrike = async ({
  createdBy = 'firewatch',
  expiresAt,
  reason,
  relatedCommentId,
  relatedPostId,
  source,
  subredditName = context.subredditName,
  username,
  weight = 1,
}: {
  createdBy?: 'firewatch' | string;
  expiresAt?: string;
  reason: string;
  relatedCommentId?: string | undefined;
  relatedPostId?: string | undefined;
  source: UserStrike['source'];
  subredditName?: string;
  username: string;
  weight?: number;
}) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot add strike to unknown user');

  const strike: UserStrike = {
    id: makeId('strike'),
    subredditId: subredditName,
    username: normalizedUsername,
    reason,
    source,
    weight,
    ...(relatedPostId ? { relatedPostId: normalizePostId(relatedPostId) } : {}),
    ...(relatedCommentId
      ? { relatedCommentId: normalizeCommentId(relatedCommentId) }
      : {}),
    createdAt: currentIso(),
    ...(expiresAt ? { expiresAt } : {}),
    createdBy,
  };
  const strikes = await getUserStrikes(subredditName, normalizedUsername);
  await trackUser(subredditName, normalizedUsername);
  const key = userStrikesKey(subredditName, normalizedUsername);
  await redis.set(
    key,
    JSON.stringify([strike, ...strikes].slice(0, MAX_STRIKES_PER_USER))
  );
  await trackUserStrikeKey(subredditName, key);
  return strike;
};

export const getUserStrikes = async (
  subredditName: string,
  username: string
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return [];

  const strikes = parseJsonList<UserStrike>(
    await redis.get(userStrikesKey(subredditName, normalizedUsername))
  );
  const nowMs = now();

  return strikes.filter((strike) => {
    if (!strike.expiresAt) return true;
    const expiresAt = Date.parse(strike.expiresAt);
    return Number.isFinite(expiresAt) ? expiresAt > nowMs : true;
  });
};

export const clearUserStrikes = async (
  subredditName: string,
  username: string
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot clear unknown user');
  const key = userStrikesKey(subredditName, normalizedUsername);
  await redis.del(key);
  await untrackUserStrikeKey(subredditName, key);
};

export const clearUserStrikesForPost = async (
  subredditName: string,
  username: string,
  postId: string
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot clear unknown user');

  const normalizedPostId = normalizePostId(postId);
  const strikes = await getUserStrikes(subredditName, normalizedUsername);
  const remainingStrikes = strikes.filter(
    (strike) => strike.relatedPostId !== normalizedPostId
  );
  const key = userStrikesKey(subredditName, normalizedUsername);

  if (remainingStrikes.length === 0) {
    await redis.del(key);
    await untrackUserStrikeKey(subredditName, key);
    return;
  }

  await redis.set(key, JSON.stringify(remainingStrikes));
  await trackUserStrikeKey(subredditName, key);
};

export const getUserStrikeSummaries = async (
  incident: Incident
): Promise<UserStrikeSummary[]> => {
  const usernames = Array.from(
    new Set(
      [
        ...incident.involvedUsers.map((user) => user.username),
        ...incident.flaggedComments.map((comment) => comment.author),
      ]
        .map(normalizeUsername)
        .filter((username): username is string => Boolean(username))
    )
  );

  return Promise.all(
    usernames.map(async (username) => {
      const strikes = await getUserStrikes(incident.subredditName, username);
      const windowStart =
        now() - DEFAULT_STRIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const recentStrikes = strikes.filter((strike) => {
        const createdAt = Date.parse(strike.createdAt);
        return Number.isFinite(createdAt) ? createdAt >= windowStart : true;
      });
      const removedComments = removedCommentCountForUser(
        incident,
        username,
        DEFAULT_STRIKE_WINDOW_DAYS * 24 * 60
      );
      const suspiciousDomainHits = recentStrikes.filter(
        (strike) => strike.source === 'watched_domain'
      ).length;
      const totalWeight = recentStrikes.reduce(
        (total, strike) => total + strike.weight,
        0
      );

      return {
        username,
        totalWeight,
        strikeCount: recentStrikes.length,
        recentWindowDays: DEFAULT_STRIKE_WINDOW_DAYS,
        removedComments,
        suspiciousDomainHits,
        strikes,
        ...(totalWeight >= 2 ? { preparedAction: 'temp ban review' } : {}),
      };
    })
  );
};
