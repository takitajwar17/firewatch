import type { IncidentActionType } from '../../shared/api';
import { formatUserHandle } from './firewatch-utils';

export type ModActionTargetKind = 'comment' | 'post';

export const COMMENT_MOD_ACTIONS = new Set([
  'approvecomment',
  'ignorereports',
  'lock',
  'removecomment',
  'showcomment',
  'spamcomment',
  'unignorereports',
  'unlock',
]);

export const POST_MOD_ACTIONS = new Set([
  'adjust_post_crowd_control_level',
  'approvelink',
  'ignorereports',
  'lock',
  'marknsfw',
  'removelink',
  'spamlink',
  'sticky',
  'spoiler',
  'unignorereports',
  'unlock',
  'unmarknsfw',
  'unspoiler',
  'unsticky',
]);

export const modActionSignalReason = ({
  action,
  moderatorName,
  targetKind,
}: {
  action: string;
  moderatorName?: string;
  targetKind: ModActionTargetKind;
}) => {
  const actor = `u/${moderatorName ?? 'mod'}`;
  const target = targetKind === 'comment' ? 'Comment' : 'Post';
  const labels: Record<string, string> = {
    adjust_post_crowd_control_level: 'Post Crowd Control adjusted',
    approvecomment: 'Comment approved',
    approvelink: 'Post approved',
    ignorereports: `${target} reports ignored`,
    lock: `${target} locked`,
    marknsfw: 'Post marked NSFW',
    removecomment: 'Comment removed',
    removelink: 'Post removed',
    showcomment: 'Comment shown',
    spamcomment: 'Comment removed as spam',
    spamlink: 'Post removed as spam',
    spoiler: 'Post marked spoiler',
    sticky: 'Post stickied',
    unignorereports: `${target} reports watched again`,
    unlock: `${target} unlocked`,
    unmarknsfw: 'Post unmarked NSFW',
    unspoiler: 'Post unmarked spoiler',
    unsticky: 'Post unstickied',
  };

  return `${labels[action] ?? `${target} action recorded`} by ${actor}`;
};

export const externalModActionType = ({
  action,
  targetKind,
}: {
  action: string;
  targetKind: ModActionTargetKind;
}): IncidentActionType | undefined => {
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

export const externalModActionDetail = ({
  action,
  moderatorName,
  targetKind,
}: {
  action: string;
  moderatorName?: string;
  targetKind: ModActionTargetKind;
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
