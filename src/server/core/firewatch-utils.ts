import { context } from '@devvit/web/server';
import type {
  Incident,
  IncidentLevel,
  IncidentSignal,
  IncidentStatus,
  SignalSource,
} from '../../shared/api';
import {
  normalizeConfig,
  normalizeThresholds,
} from '../../shared/firewatch-config';
import {
  formatUserHandle,
  normalizeUsername,
  usernameKey,
} from '../../shared/usernames';
import { INCIDENT_RETENTION_MS } from './firewatch-constants';

export { normalizeConfig, normalizeThresholds };
export { formatUserHandle, normalizeUsername, usernameKey };

export type T1 = `t1_${string}`;
export type T3 = `t3_${string}`;

export const incidentKey = (postId: string) => `fw:incident:${postId}`;
export const indexKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:index`;
export const configKey = (subredditName: string) =>
  `fw:config:${subredditName}`;
export const boardPostKey = (subredditName: string) =>
  `fw:board-post:native-v11:${subredditName}`;
export const claimKey = (postId: string) => `fw:claim:${postId}`;
export const incidentRegistryKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:incident_ids`;
export const selectionKey = (subredditName: string, username: string) =>
  `fw:selected:${subredditName}:${username}`;
export const userRegistryKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:users`;
export const userStrikeKeyRegistryKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:user_strike_keys`;

export const now = () => Date.now();
export const retentionExpiration = () =>
  new Date(now() + INCIDENT_RETENTION_MS);
export const selectionExpiration = () => new Date(now() + 24 * 60 * 60 * 1000);

export const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const normalizePostId = (postId: string): T3 =>
  postId.startsWith('t3_') ? `t3_${postId.slice(3)}` : `t3_${postId}`;

export const normalizeCommentId = (commentId: string): T1 =>
  commentId.startsWith('t1_') ? `t1_${commentId.slice(3)}` : `t1_${commentId}`;

export const isAppUsername = (username: string | undefined) =>
  usernameKey(username) === context.appSlug.toLowerCase();

export const inferSignalSource = (signal: {
  author?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  source?: SignalSource;
  type: IncidentSignal['type'];
}): SignalSource => {
  if (signal.source) return signal.source;
  if (signal.metadata?.firewatchNotice || isAppUsername(signal.author)) {
    return 'firewatch_notice';
  }
  if (signal.type === 'comment_report' || signal.type === 'post_report') {
    return 'report';
  }
  if (
    signal.type === 'manual_escalation' ||
    signal.type === 'mod_action' ||
    signal.type === 'automod_filter'
  ) {
    return 'mod_action';
  }
  return 'user';
};

export const normalizeSignal = (signal: IncidentSignal): IncidentSignal => ({
  ...signal,
  author: normalizeUsername(signal.author),
  source: inferSignalSource(signal),
});

export const normalizeStatus = (status: string | undefined): IncidentStatus => {
  const legacyResolvedStatus = ['han', 'dled'].join('');
  if (status === 'active') return 'open';
  if (status === 'monitoring') return 'cooldown';
  if (status === 'open') return 'open';
  if (status === 'watching') return 'watching';
  if (status === 'review') return 'review';
  if (status === 'claimed') return 'claimed';
  if (status === 'cooldown') return 'cooldown';
  if (status === 'locked') return 'locked';
  if (status === legacyResolvedStatus) return 'resolved';
  if (status === 'resolved') return 'resolved';
  return 'open';
};

export const deriveIncidentStatus = (
  incident: Incident,
  commentsToReview = 0,
  currentPostLocked?: boolean
): IncidentStatus => {
  const normalized = normalizeStatus(incident.status);
  const latestLockAction = incident.actions.find(
    (action) => action.type === 'locked' || action.type === 'post_unlocked'
  );
  const actionLocked = latestLockAction?.type === 'locked';
  const actionUnlocked = latestLockAction?.type === 'post_unlocked';
  const locked =
    currentPostLocked ??
    (actionUnlocked
      ? false
      : normalized === 'locked' ||
        actionLocked ||
        incident.postState?.locked === true);
  const finalNoteSaved =
    Boolean(incident.summary) ||
    Boolean(incident.resolvedAt) ||
    normalized === 'resolved' ||
    incident.actions.some((action) => action.type === 'resolved');
  const cooldownPosted =
    normalized === 'cooldown' ||
    incident.actions.some((action) => action.type === 'cool_down');

  if (locked && commentsToReview > 0) return 'locked';
  if (commentsToReview > 0) return 'review';
  if (finalNoteSaved) return 'resolved';
  if (locked) return 'locked';
  if (cooldownPosted) return 'cooldown';
  if (incident.claim) return 'claimed';
  return 'watching';
};

export const formatLevel = (level: IncidentLevel) =>
  ({
    watch: 'watch',
    heat: 'review',
    fire: 'act',
    wildfire: 'lock likely',
  })[level];

export const formatStatus = (status: Incident['status']) =>
  ({
    open: 'open',
    watching: 'watching',
    review: 'review',
    claimed: 'claimed',
    cooldown: 'cooldown',
    locked: 'locked',
    resolved: 'resolved',
  })[status];

export const parseCsv = (value: string | undefined, fallback: string[]) => {
  if (value === undefined) return fallback;

  const parsed = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(parsed));
};
