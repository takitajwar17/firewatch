import type {
  FirewatchConfig,
  IncidentLevel,
  IncidentSignal,
} from '../../shared/api';
import { EMPTY_CONFIG } from '../../shared/firewatch-config';

export const statusBadgeVariant: Record<
  string,
  'secondary' | 'outline' | 'destructive' | 'success'
> = {
  open: 'outline',
  watching: 'outline',
  review: 'destructive',
  claimed: 'outline',
  cooldown: 'outline',
  locked: 'destructive',
  handled: 'success',
  resolved: 'success',
};

export const levelBadgeVariant: Record<
  IncidentLevel,
  'secondary' | 'outline' | 'destructive'
> = {
  watch: 'secondary',
  heat: 'outline',
  fire: 'destructive',
  wildfire: 'destructive',
};

export const emptyConfig: FirewatchConfig = EMPTY_CONFIG;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatTime = (timestamp: number) =>
  timeFormatter.format(new Date(timestamp));

export const formatDateTime = (timestamp: number) =>
  dateTimeFormatter.format(new Date(timestamp));

export const formatStatus = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Open',
    watching: 'Watching',
    review: 'Review',
    claimed: 'Claimed',
    cooldown: 'Reminder posted',
    locked: 'Locked',
    handled: 'Handled',
    resolved: 'Resolved',
    active: 'Open',
    monitoring: 'Watching',
  };

  return labels[status] ?? status;
};

export const formatUsername = (username: string | undefined) => {
  const normalized = username?.trim().replace(/^u\//i, '');
  if (
    !normalized ||
    normalized.startsWith('t2_') ||
    normalized === 'unknown user'
  ) {
    return 'unknown user';
  }
  return `u/${normalized}`;
};

const isHandledStatus = (status: string) =>
  status === 'handled' || status === 'resolved';

export const isTerminalStatus = (status: string) =>
  isHandledStatus(status) || status === 'resolved';

const isFirewatchNotice = (signal: IncidentSignal) =>
  signal.source === 'firewatch_notice' ||
  signal.metadata?.firewatchNotice === true ||
  signal.body?.startsWith('Mod note: Please keep this discussion civil');

export const formatSignalType = (signal: IncidentSignal) => {
  if (isFirewatchNotice(signal)) return 'Mod notice posted';

  const labels: Record<string, string> = {
    post_create: 'New post',
    post_update: 'Post edit',
    comment_create: 'New comment',
    comment_report: 'Comment report',
    post_report: 'Post report',
    manual_escalation: 'Sent by mod',
    mod_action: 'Mod action',
    automod_filter: 'AutoModerator',
  };

  return labels[signal.type] ?? signal.type.replaceAll('_', ' ');
};

export const formatSignalDetail = (signal: IncidentSignal) => {
  if (isFirewatchNotice(signal)) {
    return 'Sticky comment.';
  }

  return signal.reason ?? signal.body ?? 'No details';
};

export const clampScore = (score: number) => Math.max(0, Math.min(100, score));

export const pluralize = (
  count: number,
  singular: string,
  plural = `${singular}s`
) => `${count} ${count === 1 ? singular : plural}`;

const errorMessageFromPayload = (payload: unknown) => {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return undefined;
};

export const readErrorMessage = async (res: Response) => {
  try {
    const payload: unknown = await res.json();
    const message = errorMessageFromPayload(payload);
    if (message) return message;
  } catch {
    // Fall back to status text below.
  }

  return res.statusText || `HTTP ${res.status}`;
};

export const actionLabel = (action: string) => {
  if (action.startsWith('ban:')) return 'Remove and ban user';
  if (action.startsWith('post:')) return 'Post action';
  if (action.startsWith('comment:')) return 'Comment action';
  if (action.startsWith('user:')) return 'User action';
  if (action.startsWith('rule:')) return 'Run prepared automation actions';
  if (action.startsWith('clear-strikes:')) return 'Clear Firewatch strikes';
  if (action.startsWith('approve:')) return 'Approve comment';
  if (action.startsWith('remove:') || action.startsWith('t1_')) {
    return 'Remove comment';
  }

  const labels: Record<string, string> = {
    claim: 'Claim post',
    'cool-down': 'Add sticky comment',
    lock: 'Lock post',
    escalate: 'Save handoff note',
    resolve: 'Mark handled',
    demo: 'Create demo thread',
    config: 'Save settings',
  };

  return (
    labels[action] ??
    action
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
};

export const actionSuccessMessage = (action: string) => {
  if (action.startsWith('ban:')) {
    return 'Comment removed and user banned.';
  }
  if (action === 'post:approve') return 'Post approved.';
  if (action === 'post:remove') return 'Post removed.';
  if (action === 'post:spam') return 'Post marked as spam.';
  if (action === 'post:unlock') return 'Post unlocked.';
  if (action === 'post:mark-nsfw') return 'Post marked NSFW.';
  if (action === 'post:unmark-nsfw') return 'NSFW label removed.';
  if (action === 'post:mark-spoiler') return 'Post marked spoiler.';
  if (action === 'post:unmark-spoiler') return 'Spoiler label removed.';
  if (action === 'post:ignore-reports') return 'Post reports ignored.';
  if (action === 'post:unignore-reports') return 'Post reports unignored.';
  if (action === 'post:crowd-control') return 'Crowd Control updated.';
  if (action === 'post:set-flair') return 'Post flair updated.';
  if (action.startsWith('comment:') && action.endsWith(':spam')) {
    return 'Comment marked as spam.';
  }
  if (action.startsWith('comment:') && action.endsWith(':lock')) {
    return 'Comment locked.';
  }
  if (action.startsWith('comment:') && action.endsWith(':unlock')) {
    return 'Comment unlocked.';
  }
  if (action.startsWith('comment:') && action.endsWith(':ignore-reports')) {
    return 'Comment reports ignored.';
  }
  if (action.startsWith('comment:') && action.endsWith(':unignore-reports')) {
    return 'Comment reports unignored.';
  }
  if (action.startsWith('comment:') && action.endsWith(':thread')) {
    return 'Comment thread removed.';
  }
  if (action.startsWith('comment:') && action.endsWith(':show')) {
    return 'Comment shown.';
  }
  if (action.startsWith('user:') && action.endsWith(':approve')) {
    return 'User approved.';
  }
  if (action.startsWith('user:') && action.endsWith(':mute')) {
    return 'User muted.';
  }
  if (action.startsWith('user:') && action.endsWith(':note')) {
    return 'Mod note added.';
  }
  if (action.startsWith('user:') && action.endsWith(':content')) {
    return 'Recent user content removed.';
  }
  if (action.startsWith('post:')) return 'Post updated.';
  if (action.startsWith('comment:')) return 'Comment updated.';
  if (action.startsWith('user:')) return 'User updated.';
  if (action.startsWith('rule:')) return 'Automation actions run.';
  if (action.startsWith('clear-strikes:')) return 'Strikes cleared.';
  if (action.startsWith('approve:')) return 'Comment approved.';
  if (action.startsWith('remove:') || action.startsWith('t1_')) {
    return 'Comment removed.';
  }

  const messages: Record<string, string> = {
    claim: 'Post claimed.',
    'cool-down': 'Sticky comment posted.',
    lock: 'Post locked.',
    escalate: 'Handoff saved.',
    resolve: 'Handled.',
    demo: 'Demo post created.',
    config: 'Saved.',
  };

  return messages[action] ?? `${actionLabel(action)} done.`;
};

export const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const copyTextToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
};
