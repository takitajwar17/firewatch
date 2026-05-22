import { context } from '@devvit/web/server';
import type {
  FirewatchConfig,
  Incident,
  IncidentLevel,
  IncidentSignal,
  IncidentStatus,
  SignalSource,
} from '../../shared/api';
import {
  DEFAULT_CONFIG,
  INCIDENT_RETENTION_MS,
} from './firewatch-constants';

export type T1 = `t1_${string}`;
export type T3 = `t3_${string}`;

export const incidentKey = (postId: string) => `fw:incident:${postId}`;
export const configKey = (subredditName: string) => `fw:config:${subredditName}`;
export const boardPostKey = (subredditName: string) =>
  `fw:board-post:${subredditName}`;
export const claimKey = (postId: string) => `fw:claim:${postId}`;
export const selectionKey = (subredditName: string, username: string) =>
  `fw:selected:${subredditName}:${username}`;

export const now = () => Date.now();
export const retentionExpiration = () =>
  new Date(now() + INCIDENT_RETENTION_MS);
export const selectionExpiration = () =>
  new Date(now() + 24 * 60 * 60 * 1000);

export const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const normalizePostId = (postId: string): T3 =>
  (postId.startsWith('t3_') ? postId : `t3_${postId}`) as T3;

export const normalizeCommentId = (commentId: string): T1 =>
  (commentId.startsWith('t1_') ? commentId : `t1_${commentId}`) as T1;

export const normalizeUsername = (username: string | undefined) => {
  const normalized = username?.trim().replace(/^u\//i, '');
  if (!normalized || normalized.startsWith('t2_')) return undefined;
  return normalized;
};

export const isAppUsername = (username: string | undefined) =>
  normalizeUsername(username)?.toLowerCase() === context.appSlug.toLowerCase();

export const formatUserHandle = (username: string | undefined) => {
  const normalized = normalizeUsername(username);
  return normalized ? `u/${normalized}` : 'unknown user';
};

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
  if (status === 'active') return 'open';
  if (status === 'monitoring') return 'cooldown';
  if (status === 'open') return 'open';
  if (status === 'watching') return 'watching';
  if (status === 'review') return 'review';
  if (status === 'claimed') return 'claimed';
  if (status === 'cooldown') return 'cooldown';
  if (status === 'locked') return 'locked';
  if (status === 'handled') return 'handled';
  if (status === 'resolved') return 'resolved';
  return 'open';
};

export const deriveIncidentStatus = (
  incident: Incident,
  commentsToReview = 0
): IncidentStatus => {
  const normalized = normalizeStatus(incident.status);
  const lockAction = incident.actions.find(
    (action) => action.type === 'locked' || action.type === 'post_unlocked'
  );
  const locked =
    normalized === 'locked' ||
    lockAction?.type === 'locked';
  const finalNoteSaved =
    Boolean(incident.summary) ||
    Boolean(incident.resolvedAt) ||
    normalized === 'handled' ||
    normalized === 'resolved' ||
    incident.actions.some((action) => action.type === 'resolved');

  if (locked && commentsToReview > 0) return 'locked';
  if (commentsToReview > 0) return 'review';
  if (finalNoteSaved) return 'handled';
  if (locked) return 'locked';
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
    handled: 'handled',
    resolved: 'resolved',
  })[status];

export const parseCsv = (value: string | undefined, fallback: string[]) => {
  if (!value) return fallback;

  const parsed = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
};

const normalizeBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const normalizeWeight = (value: unknown, fallback: number, max = 50) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return clamp(Math.round(numericValue), 0, max);
};

export const normalizeConfig = (
  value: Partial<FirewatchConfig> | undefined
): FirewatchConfig => {
  const thresholds = normalizeThresholds(
    Number(value?.heatThreshold ?? DEFAULT_CONFIG.heatThreshold),
    Number(value?.fireThreshold ?? DEFAULT_CONFIG.fireThreshold),
    Number(value?.wildfireThreshold ?? DEFAULT_CONFIG.wildfireThreshold)
  );
  const actionControls = value?.actionControls;
  const signalWeights = value?.signalWeights;
  const reminderText = value?.reminderText?.trim();

  return {
    keywords: value?.keywords?.length ? value.keywords : DEFAULT_CONFIG.keywords,
    suspiciousDomains: value?.suspiciousDomains?.length
      ? value.suspiciousDomains
      : DEFAULT_CONFIG.suspiciousDomains,
    ...thresholds,
    reminderText: reminderText
      ? reminderText.slice(0, 800)
      : DEFAULT_CONFIG.reminderText,
    actionControls: {
      approveComments: normalizeBoolean(
        actionControls?.approveComments,
        DEFAULT_CONFIG.actionControls.approveComments
      ),
      removeComments: normalizeBoolean(
        actionControls?.removeComments,
        DEFAULT_CONFIG.actionControls.removeComments
      ),
      banUsers: normalizeBoolean(
        actionControls?.banUsers,
        DEFAULT_CONFIG.actionControls.banUsers
      ),
      stickyReminder: normalizeBoolean(
        actionControls?.stickyReminder,
        DEFAULT_CONFIG.actionControls.stickyReminder
      ),
      lockPost: normalizeBoolean(
        actionControls?.lockPost,
        DEFAULT_CONFIG.actionControls.lockPost
      ),
      unlockPost: normalizeBoolean(
        actionControls?.unlockPost,
        DEFAULT_CONFIG.actionControls.unlockPost
      ),
      approvePosts: normalizeBoolean(
        actionControls?.approvePosts,
        DEFAULT_CONFIG.actionControls.approvePosts
      ),
      removePosts: normalizeBoolean(
        actionControls?.removePosts,
        DEFAULT_CONFIG.actionControls.removePosts
      ),
      markPostSpam: normalizeBoolean(
        actionControls?.markPostSpam,
        DEFAULT_CONFIG.actionControls.markPostSpam
      ),
      markPostNsfw: normalizeBoolean(
        actionControls?.markPostNsfw,
        DEFAULT_CONFIG.actionControls.markPostNsfw
      ),
      markPostSpoiler: normalizeBoolean(
        actionControls?.markPostSpoiler,
        DEFAULT_CONFIG.actionControls.markPostSpoiler
      ),
      ignoreReports: normalizeBoolean(
        actionControls?.ignoreReports,
        DEFAULT_CONFIG.actionControls.ignoreReports
      ),
      crowdControl: normalizeBoolean(
        actionControls?.crowdControl,
        DEFAULT_CONFIG.actionControls.crowdControl
      ),
      setPostFlair: normalizeBoolean(
        actionControls?.setPostFlair,
        DEFAULT_CONFIG.actionControls.setPostFlair
      ),
      lockComments: normalizeBoolean(
        actionControls?.lockComments,
        DEFAULT_CONFIG.actionControls.lockComments
      ),
      markCommentSpam: normalizeBoolean(
        actionControls?.markCommentSpam,
        DEFAULT_CONFIG.actionControls.markCommentSpam
      ),
      removeCommentThreads: normalizeBoolean(
        actionControls?.removeCommentThreads,
        DEFAULT_CONFIG.actionControls.removeCommentThreads
      ),
      showComments: normalizeBoolean(
        actionControls?.showComments,
        DEFAULT_CONFIG.actionControls.showComments
      ),
      approveUsers: normalizeBoolean(
        actionControls?.approveUsers,
        DEFAULT_CONFIG.actionControls.approveUsers
      ),
      muteUsers: normalizeBoolean(
        actionControls?.muteUsers,
        DEFAULT_CONFIG.actionControls.muteUsers
      ),
      addModNotes: normalizeBoolean(
        actionControls?.addModNotes,
        DEFAULT_CONFIG.actionControls.addModNotes
      ),
      removeUserContent: normalizeBoolean(
        actionControls?.removeUserContent,
        DEFAULT_CONFIG.actionControls.removeUserContent
      ),
      handoffNotes: normalizeBoolean(
        actionControls?.handoffNotes,
        DEFAULT_CONFIG.actionControls.handoffNotes
      ),
      markHandled: normalizeBoolean(
        actionControls?.markHandled,
        DEFAULT_CONFIG.actionControls.markHandled
      ),
    },
    signalWeights: {
      commentVelocity: normalizeWeight(
        signalWeights?.commentVelocity,
        DEFAULT_CONFIG.signalWeights.commentVelocity
      ),
      reports: normalizeWeight(
        signalWeights?.reports,
        DEFAULT_CONFIG.signalWeights.reports
      ),
      watchedWords: normalizeWeight(
        signalWeights?.watchedWords,
        DEFAULT_CONFIG.signalWeights.watchedWords
      ),
      watchedDomains: normalizeWeight(
        signalWeights?.watchedDomains,
        DEFAULT_CONFIG.signalWeights.watchedDomains
      ),
      replyPileOns: normalizeWeight(
        signalWeights?.replyPileOns,
        DEFAULT_CONFIG.signalWeights.replyPileOns
      ),
      repeatedWording: normalizeWeight(
        signalWeights?.repeatedWording,
        DEFAULT_CONFIG.signalWeights.repeatedWording
      ),
      recentRemovals: normalizeWeight(
        signalWeights?.recentRemovals,
        DEFAULT_CONFIG.signalWeights.recentRemovals
      ),
      manualSend: normalizeWeight(
        signalWeights?.manualSend,
        DEFAULT_CONFIG.signalWeights.manualSend
      ),
    },
  };
};

export const normalizeThresholds = (
  heatThreshold: number,
  fireThreshold: number,
  wildfireThreshold: number
) => {
  const heatInput = Number.isFinite(heatThreshold)
    ? heatThreshold
    : DEFAULT_CONFIG.heatThreshold;
  const fireInput = Number.isFinite(fireThreshold)
    ? fireThreshold
    : DEFAULT_CONFIG.fireThreshold;
  const wildfireInput = Number.isFinite(wildfireThreshold)
    ? wildfireThreshold
    : DEFAULT_CONFIG.wildfireThreshold;
  const heat = clamp(heatInput, 1, 98);
  const fire = clamp(fireInput, heat + 1, 99);
  const wildfire = clamp(wildfireInput, fire + 1, 100);

  return {
    heatThreshold: heat,
    fireThreshold: fire,
    wildfireThreshold: wildfire,
  };
};
