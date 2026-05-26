import type {
  FlaggedComment,
  Incident,
  IncidentActionType,
  IncidentSignal,
} from '../../../shared/api';
import { actionCompleted } from '../../../shared/reddit-actions';

export type CommentPrepKind =
  | 'remove'
  | 'ban'
  | 'spam'
  | 'thread'
  | 'mute'
  | 'note'
  | 'content';

export type CommentPrepSelection = {
  commentId: string;
  kind: CommentPrepKind;
};

type LatestLockAction = Extract<
  IncidentActionType,
  'comment_locked' | 'comment_unlocked'
>;
type LatestReportAction = Extract<
  IncidentActionType,
  'comment_reports_ignored' | 'comment_reports_unignored'
>;
type LatestResolutionAction = Extract<
  IncidentActionType,
  | 'comment_approved'
  | 'comment_removed'
  | 'comment_spammed'
  | 'comment_thread_removed'
>;

export type CommentActionSnapshot = {
  latestLockAction?: LatestLockAction;
  latestReportAction?: LatestReportAction;
  latestResolutionAction?: LatestResolutionAction;
  resolutionActor?: string;
  resolutionAt?: number;
  resolutionDetail?: string;
  shown?: boolean;
};

export type CommentActionState = {
  locked: boolean;
  removed: boolean;
  reportsIgnored: boolean;
  reviewed: boolean;
  shown: boolean;
  spammed: boolean;
};

export type CommentThreadContext = {
  lines: {
    id: string;
    label: 'Parent' | 'Reply' | 'Nearby comment';
    signal: IncidentSignal;
  }[];
};

export type CommentReviewState = {
  actionSnapshotById: Map<string, CommentActionSnapshot>;
  alreadyActioned: FlaggedComment[];
  commentStateById: Map<string, CommentActionState>;
  needsReview: FlaggedComment[];
};

export const BAN_DURATION_OPTIONS = [
  { label: 'Permanent', value: '0' },
  { label: '1 day', value: '1' },
  { label: '3 days', value: '3' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
];

export const parseBanDuration = (value: string) => {
  const duration = Number.parseInt(value, 10);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

export const commentAuthorKey = (author: string) =>
  author.trim().toLowerCase();

const contextSignalKey = (signal: IncidentSignal) =>
  `${signal.author ?? ''}:${signal.body?.trim().toLowerCase()}`;

const isBetterContextSignal = (
  current: IncidentSignal | undefined,
  next: IncidentSignal
) => {
  if (!current) return true;
  if (current.type !== 'comment_create' && next.type === 'comment_create') {
    return true;
  }
  return !current.body && Boolean(next.body);
};

const getSnapshot = (
  snapshots: Map<string, CommentActionSnapshot>,
  commentId: string
) => {
  const existing = snapshots.get(commentId);
  if (existing) return existing;

  const next: CommentActionSnapshot = {};
  snapshots.set(commentId, next);
  return next;
};

export const buildCommentActionSnapshots = (incident: Incident) => {
  const snapshots = new Map<string, CommentActionSnapshot>();

  const newestActions = [...incident.actions].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  for (const action of newestActions) {
    if (!actionCompleted(action)) continue;
    if (!action.targetIds?.length) continue;

    for (const targetId of action.targetIds) {
      const snapshot = getSnapshot(snapshots, targetId);

      if (
        (action.type === 'comment_locked' ||
          action.type === 'comment_unlocked') &&
        !snapshot.latestLockAction
      ) {
        snapshot.latestLockAction = action.type;
      }

      if (
        (action.type === 'comment_reports_ignored' ||
          action.type === 'comment_reports_unignored') &&
        !snapshot.latestReportAction
      ) {
        snapshot.latestReportAction = action.type;
      }

      if (
        (action.type === 'comment_approved' ||
          action.type === 'comment_removed' ||
          action.type === 'comment_spammed' ||
          action.type === 'comment_thread_removed') &&
        !snapshot.latestResolutionAction
      ) {
        snapshot.latestResolutionAction = action.type;
        snapshot.resolutionActor = action.actor;
        snapshot.resolutionAt = action.createdAt;
        snapshot.resolutionDetail = action.detail;
      }

      if (action.type === 'comment_shown') {
        snapshot.shown = true;
      }
    }
  }

  return snapshots;
};

export const getCommentActionState = (
  actionSnapshot: CommentActionSnapshot | undefined,
  comment: FlaggedComment
): CommentActionState => {
  const latestLockAction = actionSnapshot?.latestLockAction;
  const latestReportAction = actionSnapshot?.latestReportAction;
  const latestResolutionAction = actionSnapshot?.latestResolutionAction;
  const removedByAction =
    latestResolutionAction === 'comment_removed' ||
    latestResolutionAction === 'comment_spammed' ||
    latestResolutionAction === 'comment_thread_removed';
  const approvedByAction = latestResolutionAction === 'comment_approved';
  const nativeRemoved = Boolean(comment.removed) || Boolean(comment.spam);
  const nativeReviewed = Boolean(comment.reviewed) || Boolean(comment.approved);

  return {
    locked:
      latestLockAction === 'comment_unlocked'
        ? false
        : Boolean(comment.locked) || latestLockAction === 'comment_locked',
    removed: nativeRemoved || removedByAction,
    reportsIgnored:
      latestReportAction === 'comment_reports_unignored'
        ? false
        : Boolean(comment.ignoringReports) ||
          latestReportAction === 'comment_reports_ignored',
    reviewed: nativeReviewed || approvedByAction,
    shown: Boolean(actionSnapshot?.shown),
    spammed:
      Boolean(comment.spam) || latestResolutionAction === 'comment_spammed',
  };
};

export const buildCommentReviewState = (
  incident: Incident
): CommentReviewState => {
  const actionSnapshots = buildCommentActionSnapshots(incident);
  const needsReview: FlaggedComment[] = [];
  const alreadyActioned: FlaggedComment[] = [];
  const commentStateById = new Map<string, CommentActionState>();

  for (const comment of incident.flaggedComments) {
    const commentState = getCommentActionState(
      actionSnapshots.get(comment.id),
      comment
    );
    commentStateById.set(comment.id, commentState);

    if (commentState.removed || commentState.reviewed) {
      alreadyActioned.push(comment);
    } else {
      needsReview.push(comment);
    }
  }

  return {
    actionSnapshotById: actionSnapshots,
    alreadyActioned,
    commentStateById,
    needsReview,
  };
};

export const buildFirstOpenCommentIdByAuthor = (
  needsReview: FlaggedComment[]
) => {
  const firstByAuthor = new Map<string, string>();
  for (const comment of needsReview) {
    const authorKey = commentAuthorKey(comment.author);
    if (!authorKey || firstByAuthor.has(authorKey)) continue;
    firstByAuthor.set(authorKey, comment.id);
  }
  return firstByAuthor;
};

export const buildCommentThreadContextById = (incident: Incident) => {
  const signalsByCommentId = new Map<string, IncidentSignal>();
  const commentSignals = incident.recentSignals
    .filter((signal) => signal.commentId && signal.body)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const signal of commentSignals) {
    if (
      signal.commentId &&
      isBetterContextSignal(signalsByCommentId.get(signal.commentId), signal)
    ) {
      signalsByCommentId.set(signal.commentId, signal);
    }
  }

  const context = new Map<string, CommentThreadContext>();
  for (const comment of incident.flaggedComments) {
    const signal = signalsByCommentId.get(comment.id);
    if (!signal) continue;

    const lines: CommentThreadContext['lines'] = [];
    const seen = new Set<string>();
    const addContextLine = (
      label: CommentThreadContext['lines'][number]['label'],
      contextSignal: IncidentSignal | undefined
    ) => {
      if (!contextSignal?.body || contextSignal.commentId === comment.id) {
        return;
      }

      const key = contextSignalKey(contextSignal);
      if (seen.has(key)) return;

      seen.add(key);
      lines.push({
        id: `${label}:${key}`,
        label,
        signal: contextSignal,
      });
    };

    if (signal.parentId?.startsWith('t1_')) {
      addContextLine('Parent', signalsByCommentId.get(signal.parentId));
    }

    for (const candidate of commentSignals) {
      if (candidate.parentId === comment.id) {
        addContextLine('Reply', candidate);
      }
    }

    if (lines.length < 2 && signal.parentId) {
      for (const candidate of commentSignals) {
        if (candidate.parentId === signal.parentId) {
          addContextLine('Nearby comment', candidate);
        }
        if (lines.length >= 2) break;
      }
    }

    if (lines.length > 0) {
      context.set(comment.id, {
        lines: lines.slice(0, 2),
      });
    }
  }

  return context;
};
