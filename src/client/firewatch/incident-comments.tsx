import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  EmptyText,
  PanelLabel,
  RedditActionButton,
  RedditMenuItem,
  RedditMenuSeparator,
  RedditOverflowMenu,
} from './common';
import { ActionPrepPanel, ActionSelect, ActionTextArea } from './action-prep';
import { formatTime, formatUsername } from './format';
import { openRedditUrlInNewTab } from './navigation';
import type { ActionRunner } from './types';
import type {
  FirewatchConfig,
  FlaggedComment,
  Incident,
  IncidentSignal,
  IncidentActionType,
} from '../../shared/api';
import {
  RedditApproveIcon,
  RedditBanIcon,
  RedditHideIcon,
  RedditLinkIcon,
  RedditLockIcon,
  RedditRemoveIcon,
  RedditReportIcon,
  RedditSpamIcon,
  RedditUsersIcon,
} from './reddit-icons';

type CommentPrepKind =
  | 'remove'
  | 'ban'
  | 'spam'
  | 'thread'
  | 'mute'
  | 'note'
  | 'content';

type CommentPrepSelection = {
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

type CommentActionSnapshot = {
  latestLockAction?: LatestLockAction;
  latestReportAction?: LatestReportAction;
  latestResolutionAction?: LatestResolutionAction;
  resolutionActor?: string;
  resolutionAt?: number;
  resolutionDetail?: string;
  shown?: boolean;
};

type CommentThreadContext = {
  lines: {
    id: string;
    label: 'Parent' | 'Reply' | 'Nearby comment';
    signal: IncidentSignal;
  }[];
};

const BAN_DURATION_OPTIONS = [
  { label: 'Permanent', value: '0' },
  { label: '1 day', value: '1' },
  { label: '3 days', value: '3' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
];

const parseBanDuration = (value: string) => {
  const duration = Number.parseInt(value, 10);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const commentAuthorKey = (author: string) => author.trim().toLowerCase();

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

const buildCommentActionSnapshots = (incident: Incident) => {
  const snapshots = new Map<string, CommentActionSnapshot>();

  const newestActions = [...incident.actions].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  for (const action of newestActions) {
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

const getCommentActionState = (
  actionSnapshot: CommentActionSnapshot | undefined,
  comment: FlaggedComment
) => {
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

export const FlaggedCommentsCard = ({
  busyAction,
  config,
  incident,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  onAction: ActionRunner;
}) => {
  const [activePrep, setActivePrep] = useState<CommentPrepSelection>();
  const [reason, setReason] = useState('Rule-breaking comment');
  const [userNote, setUserNote] = useState('Firewatch moderator action');
  const [banDuration, setBanDuration] = useState('0');
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(
    () => new Set()
  );
  const { actionSnapshotById, alreadyActioned, commentStateById, needsReview } =
    useMemo(() => {
      const actionSnapshots = buildCommentActionSnapshots(incident);
      const nextNeedsReview: FlaggedComment[] = [];
      const nextAlreadyActioned: FlaggedComment[] = [];
      const nextCommentStateById = new Map<
        string,
        ReturnType<typeof getCommentActionState>
      >();

      for (const comment of incident.flaggedComments) {
        const commentState = getCommentActionState(
          actionSnapshots.get(comment.id),
          comment
        );
        nextCommentStateById.set(comment.id, commentState);

        if (commentState.removed || commentState.reviewed) {
          nextAlreadyActioned.push(comment);
        } else {
          nextNeedsReview.push(comment);
        }
      }

      return {
        actionSnapshotById: actionSnapshots,
        alreadyActioned: nextAlreadyActioned,
        commentStateById: nextCommentStateById,
        needsReview: nextNeedsReview,
      };
    }, [incident]);
  const firstOpenCommentIdByAuthor = useMemo(() => {
    const firstByAuthor = new Map<string, string>();
    for (const comment of needsReview) {
      const authorKey = commentAuthorKey(comment.author);
      if (!authorKey || firstByAuthor.has(authorKey)) continue;
      firstByAuthor.set(authorKey, comment.id);
    }
    return firstByAuthor;
  }, [needsReview]);
  const contextByCommentId = useMemo(() => {
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
  }, [incident.flaggedComments, incident.recentSignals]);
  const controls = config.actionControls;
  const toggleExpanded = (commentId: string) => {
    setExpandedCommentIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  return (
    <section className="min-w-0 rounded-md border border-border bg-background">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5">
            Comments to review
          </h3>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {needsReview.length} open
        </span>
      </div>
      <div className="flex flex-col gap-0">
        {needsReview.length === 0 ? (
          <div className="p-3">
            <EmptyText>No comments waiting on review.</EmptyText>
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {needsReview.map((comment) => {
                const authorLabel = formatUsername(comment.author);
                const permalink = comment.permalink;
                const canBanAuthor = authorLabel !== 'unknown user';
                const commentState = commentStateById.get(comment.id);
                if (!commentState) return null;
                const commentOpen =
                  !commentState.removed && !commentState.reviewed;
                const approveAction = `approve:${comment.id}`;
                const removeAction = `remove:${comment.id}`;
                const spamAction = `comment:${comment.id}:spam`;
                const lockToggle = commentState.locked ? 'unlock' : 'lock';
                const lockAction = `comment:${comment.id}:${lockToggle}`;
                const reportsToggle = commentState.reportsIgnored
                  ? 'unignore-reports'
                  : 'ignore-reports';
                const reportsAction = `comment:${comment.id}:${reportsToggle}`;
                const threadAction = `comment:${comment.id}:thread`;
                const showAction = `comment:${comment.id}:show`;
                const approveUserAction = `user:${comment.author}:approve`;
                const muteUserAction = `user:${comment.author}:mute`;
                const modNoteAction = `user:${comment.author}:note`;
                const removeContentAction = `user:${comment.author}:content`;
                const banAction = `ban:${comment.author}`;
                const hasAdvancedCommentActions =
                  controls.markCommentSpam ||
                  (controls.removeCommentThreads && controls.removeComments) ||
                  controls.lockComments ||
                  controls.ignoreCommentReports ||
                  controls.showComments;
                const hasAdvancedUserActions =
                  controls.approveUsers ||
                  controls.muteUsers ||
                  controls.addModNotes ||
                  controls.removeUserContent;
                const showUserTools =
                  hasAdvancedUserActions &&
                  firstOpenCommentIdByAuthor.get(
                    commentAuthorKey(comment.author)
                  ) === comment.id;
                const threadContext = contextByCommentId.get(comment.id);

                return (
                  <article
                    key={comment.id}
                    className="content-visibility-list-item min-w-0 overflow-hidden border-b border-border px-3 py-2.5 last:border-b-0"
                  >
                    <div className="flex gap-2.5">
                      <img
                        alt=""
                        className="mt-0.5 size-7 shrink-0 rounded-full"
                        src="/avatar_default_2.png"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-semibold leading-5 text-foreground">
                            {authorLabel}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-muted-foreground/70"
                          >
                            ·
                          </span>
                          <span className="text-xs font-semibold leading-5 text-muted-foreground">
                            score {comment.score}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-muted-foreground/70"
                          >
                            ·
                          </span>
                          <span className="text-xs font-semibold leading-5 text-muted-foreground">
                            {formatTime(comment.createdAt)}
                          </span>
                          {comment.numReports ? (
                            <Badge className="max-w-full" variant="outline">
                              {comment.numReports} reports
                            </Badge>
                          ) : null}
                          {comment.reasons.map((reason) => (
                            <Badge
                              key={reason}
                              className="max-w-full"
                              variant="secondary"
                            >
                              {reason}
                            </Badge>
                          ))}
                          {commentState.locked ? (
                            <Badge className="max-w-full" variant="outline">
                              Locked
                            </Badge>
                          ) : null}
                          {commentState.reportsIgnored ? (
                            <Badge className="max-w-full" variant="outline">
                              Reports ignored
                            </Badge>
                          ) : null}
                          {commentState.shown ? (
                            <Badge className="max-w-full" variant="outline">
                              Shown
                            </Badge>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            'mt-1 break-words text-sm leading-5 text-foreground/90',
                            expandedCommentIds.has(comment.id)
                              ? ''
                              : 'line-clamp-3'
                          )}
                        >
                          {comment.body}
                        </p>
                        {comment.body.length > 220 ? (
                          <button
                            className="mt-1 text-xs font-semibold leading-5 text-primary hover:underline"
                            type="button"
                            onClick={() => toggleExpanded(comment.id)}
                          >
                            {expandedCommentIds.has(comment.id)
                              ? 'Show less'
                              : 'Show full comment'}
                          </button>
                        ) : null}

                        {threadContext ? (
                          <CommentContextBlock context={threadContext} />
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {permalink ? (
                            <Button
                              className="max-w-full"
                              size="sm"
                              variant="ghost"
                              onClick={() => openRedditUrlInNewTab(permalink)}
                            >
                              <RedditLinkIcon data-icon="inline-start" />
                              Open context
                            </Button>
                          ) : null}
                          {controls.approveComments ? (
                            <RedditActionButton
                              action={approveAction}
                              busyAction={busyAction}
                              disabled={!commentOpen}
                              icon={
                                <RedditApproveIcon data-icon="inline-start" />
                              }
                              label={
                                commentState.reviewed ? 'Approved' : 'Approve'
                              }
                              variant="secondary"
                              onClick={() =>
                                onAction(
                                  approveAction,
                                  `/api/incidents/${incident.postId}/comments/${comment.id}/approve`
                                )
                              }
                            />
                          ) : null}
                          {controls.removeComments ? (
                            <RedditActionButton
                              action={removeAction}
                              busyAction={busyAction}
                              disabled={!commentOpen}
                              icon={
                                <RedditRemoveIcon data-icon="inline-start" />
                              }
                              label={
                                commentState.removed ? 'Removed' : 'Remove'
                              }
                              variant="secondary"
                              onClick={() =>
                                setActivePrep({
                                  commentId: comment.id,
                                  kind: 'remove',
                                })
                              }
                            />
                          ) : null}
                          {controls.banUsers && controls.removeComments ? (
                            <RedditActionButton
                              action={banAction}
                              busyAction={busyAction}
                              disabled={!canBanAuthor || !commentOpen}
                              icon={<RedditBanIcon data-icon="inline-start" />}
                              label="Remove and ban"
                              variant="destructive"
                              onClick={() =>
                                setActivePrep({
                                  commentId: comment.id,
                                  kind: 'ban',
                                })
                              }
                            />
                          ) : null}
                        </div>

                        {hasAdvancedCommentActions || showUserTools ? (
                          <div className="mt-3">
                            <RedditOverflowMenu
                              align="start"
                              label="More actions"
                            >
                              <>
                                {hasAdvancedCommentActions ? (
                                  <>
                                    {controls.markCommentSpam ? (
                                      <RedditMenuItem
                                        destructive
                                        disabled={
                                          Boolean(busyAction) || !commentOpen
                                        }
                                        icon={<RedditSpamIcon />}
                                        label={
                                          busyAction === spamAction
                                            ? 'Working'
                                            : commentState.spammed
                                              ? 'Marked as spam'
                                              : 'Mark as spam'
                                        }
                                        onSelect={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'spam',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.removeCommentThreads &&
                                    controls.removeComments ? (
                                      <RedditMenuItem
                                        destructive
                                        disabled={
                                          Boolean(busyAction) || !commentOpen
                                        }
                                        icon={<RedditRemoveIcon />}
                                        label={
                                          busyAction === threadAction
                                            ? 'Working'
                                            : 'Remove thread'
                                        }
                                        onSelect={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'thread',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.lockComments ? (
                                      <RedditMenuItem
                                        disabled={
                                          Boolean(busyAction) || !commentOpen
                                        }
                                        icon={<RedditLockIcon />}
                                        label={
                                          busyAction === lockAction
                                            ? 'Working'
                                            : commentState.locked
                                              ? 'Unlock'
                                              : 'Lock'
                                        }
                                        onSelect={() => {
                                          void onAction(
                                            lockAction,
                                            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                            { action: lockToggle }
                                          );
                                        }}
                                      />
                                    ) : null}
                                    {controls.ignoreCommentReports ? (
                                      <RedditMenuItem
                                        disabled={
                                          Boolean(busyAction) || !commentOpen
                                        }
                                        icon={<RedditReportIcon />}
                                        label={
                                          busyAction === reportsAction
                                            ? 'Working'
                                            : commentState.reportsIgnored
                                              ? 'Unignore reports'
                                              : 'Ignore reports'
                                        }
                                        onSelect={() => {
                                          void onAction(
                                            reportsAction,
                                            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                            { action: reportsToggle }
                                          );
                                        }}
                                      />
                                    ) : null}
                                    {controls.showComments ? (
                                      <RedditMenuItem
                                        disabled={
                                          Boolean(busyAction) ||
                                          !commentOpen ||
                                          commentState.shown
                                        }
                                        icon={<RedditHideIcon />}
                                        label={
                                          busyAction === showAction
                                            ? 'Working'
                                            : commentState.shown
                                              ? 'Shown'
                                              : 'Show comment'
                                        }
                                        onSelect={() => {
                                          void onAction(
                                            showAction,
                                            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                            { action: 'show-comment' }
                                          );
                                        }}
                                      />
                                    ) : null}
                                  </>
                                ) : null}

                                {hasAdvancedCommentActions && showUserTools ? (
                                  <RedditMenuSeparator />
                                ) : null}

                                {showUserTools ? (
                                  <>
                                    {controls.approveUsers ? (
                                      <RedditMenuItem
                                        disabled={
                                          Boolean(busyAction) || !canBanAuthor
                                        }
                                        icon={<RedditUsersIcon />}
                                        label={
                                          busyAction === approveUserAction
                                            ? 'Working'
                                            : 'Approve user'
                                        }
                                        onSelect={() => {
                                          void onAction(
                                            approveUserAction,
                                            `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/native-action`,
                                            { action: 'approve' }
                                          );
                                        }}
                                      />
                                    ) : null}
                                    {controls.muteUsers ? (
                                      <RedditMenuItem
                                        disabled={
                                          Boolean(busyAction) || !canBanAuthor
                                        }
                                        icon={<RedditUsersIcon />}
                                        label={
                                          busyAction === muteUserAction
                                            ? 'Working'
                                            : 'Mute user'
                                        }
                                        onSelect={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'mute',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.addModNotes ? (
                                      <RedditMenuItem
                                        disabled={
                                          Boolean(busyAction) || !canBanAuthor
                                        }
                                        icon={<RedditReportIcon />}
                                        label={
                                          busyAction === modNoteAction
                                            ? 'Working'
                                            : 'Add mod note'
                                        }
                                        onSelect={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'note',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.removeUserContent ? (
                                      <RedditMenuItem
                                        destructive
                                        disabled={
                                          Boolean(busyAction) || !canBanAuthor
                                        }
                                        icon={<RedditBanIcon />}
                                        label={
                                          busyAction === removeContentAction
                                            ? 'Working'
                                            : 'Remove recent user content'
                                        }
                                        onSelect={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'content',
                                          })
                                        }
                                      />
                                    ) : null}
                                  </>
                                ) : null}
                              </>
                            </RedditOverflowMenu>
                          </div>
                        ) : null}
                        {activePrep?.commentId === comment.id ? (
                          <CommentActionPrepPanel
                            activePrep={activePrep.kind}
                            banDuration={banDuration}
                            busyAction={busyAction}
                            comment={comment}
                            incident={incident}
                            reason={reason}
                            userNote={userNote}
                            onAction={onAction}
                            onBanDurationChange={setBanDuration}
                            onCancel={() => setActivePrep(undefined)}
                            onReasonChange={setReason}
                            onUserNoteChange={setUserNote}
                          />
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {alreadyActioned.length > 0 ? (
          <>
            <Separator className="my-0" />
            <div className="px-3 py-2.5">
              <PanelLabel>ALREADY ACTIONED</PanelLabel>
            </div>
            <div className="flex flex-col">
              {alreadyActioned.map((comment) => {
                const permalink = comment.permalink;
                const commentState = commentStateById.get(comment.id);
                const actionSnapshot = actionSnapshotById.get(comment.id);
                if (!commentState) return null;
                const actionLabel = commentState.removed
                  ? commentState.spammed
                    ? 'spammed'
                    : 'removed'
                  : 'approved';

                return (
                  <div
                    key={comment.id}
                    className="content-visibility-list-item border-t border-border px-3 py-2.5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5">
                          {formatUsername(comment.author)} · {actionLabel}
                        </p>
                        {actionSnapshot?.resolutionActor ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            by {formatUsername(actionSnapshot.resolutionActor)}
                            {actionSnapshot.resolutionAt
                              ? ` at ${formatTime(actionSnapshot.resolutionAt)}`
                              : ''}
                          </p>
                        ) : null}
                        <p className="mt-2 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">
                          {comment.body}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {comment.reasons.map((reason) => (
                            <Badge
                              key={reason}
                              className="max-w-full"
                              variant="secondary"
                            >
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {permalink ? (
                        <Button
                          className="shrink-0"
                          size="sm"
                          variant="ghost"
                          onClick={() => openRedditUrlInNewTab(permalink)}
                        >
                          <RedditLinkIcon data-icon="inline-start" />
                          Open context
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};

const CommentContextBlock = ({
  context,
}: {
  context: CommentThreadContext;
}) => (
  <div className="mt-2 border-l-2 border-border py-1 pl-3">
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      Thread context
    </p>
    <div className="mt-1.5 flex flex-col gap-1.5">
      {context.lines.map((line) => (
        <ContextLine key={line.id} label={line.label} signal={line.signal} />
      ))}
    </div>
  </div>
);

const ContextLine = ({
  label,
  signal,
}: {
  label: string;
  signal: IncidentSignal;
}) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold leading-5 text-muted-foreground">
      {label}
      {signal.author ? ` by ${formatUsername(signal.author)}` : ''}
    </p>
    <p className="line-clamp-2 break-words text-sm leading-5 text-foreground/85">
      {signal.body}
    </p>
  </div>
);

const CommentActionPrepPanel = ({
  activePrep,
  banDuration,
  busyAction,
  comment,
  incident,
  reason,
  userNote,
  onAction,
  onBanDurationChange,
  onCancel,
  onReasonChange,
  onUserNoteChange,
}: {
  activePrep: CommentPrepKind;
  banDuration: string;
  busyAction: string | undefined;
  comment: FlaggedComment;
  incident: Incident;
  reason: string;
  userNote: string;
  onAction: ActionRunner;
  onBanDurationChange: (value: string) => void;
  onCancel: () => void;
  onReasonChange: (value: string) => void;
  onUserNoteChange: (value: string) => void;
}) => {
  const encodedAuthor = encodeURIComponent(comment.author);
  const commentAction = `comment:${comment.id}:${activePrep}`;
  const removeAction = `remove:${comment.id}`;
  const banAction = `ban:${comment.author}`;
  const userAction = `user:${comment.author}:${activePrep}`;
  const run = (
    action: string,
    endpoint: string,
    body: Record<string, unknown>
  ) => {
    void onAction(action, endpoint, body).then((updatedIncident) => {
      if (updatedIncident) onCancel();
    });
  };

  if (activePrep === 'remove') {
    return (
      <ActionPrepPanel
        busy={busyAction === removeAction}
        primaryIcon={<RedditRemoveIcon data-icon="inline-start" />}
        primaryLabel="Remove"
        title="Remove comment"
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            removeAction,
            `/api/incidents/${incident.postId}/comments/${comment.id}/remove`,
            { reason }
          )
        }
      >
        <ActionTextArea
          id={`fw-remove-reason-${comment.id}`}
          label="Removal reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'ban') {
    return (
      <ActionPrepPanel
        busy={busyAction === banAction}
        primaryIcon={<RedditBanIcon data-icon="inline-start" />}
        primaryLabel="Remove and ban"
        title={`Ban ${formatUsername(comment.author)}`}
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            banAction,
            `/api/incidents/${incident.postId}/users/${encodedAuthor}/ban`,
            {
              durationDays: parseBanDuration(banDuration),
              reason,
            }
          )
        }
      >
        <ActionSelect
          id={`fw-ban-duration-${comment.id}`}
          label="Ban duration"
          value={banDuration}
          onChange={onBanDurationChange}
        >
          {BAN_DURATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ActionSelect>
        <ActionTextArea
          id={`fw-ban-reason-${comment.id}`}
          label="Ban reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'spam' || activePrep === 'thread') {
    const nativeAction = activePrep === 'spam' ? 'spam' : 'remove-thread';

    return (
      <ActionPrepPanel
        busy={busyAction === commentAction}
        primaryIcon={
          activePrep === 'spam' ? (
            <RedditSpamIcon data-icon="inline-start" />
          ) : (
            <RedditRemoveIcon data-icon="inline-start" />
          )
        }
        primaryLabel={activePrep === 'spam' ? 'Spam' : 'Remove thread'}
        title={activePrep === 'spam' ? 'Spam comment' : 'Remove comment thread'}
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            commentAction,
            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
            {
              action: nativeAction,
              reason,
            }
          )
        }
      >
        <ActionTextArea
          id={`fw-comment-native-reason-${comment.id}`}
          label="Removal reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'mute' || activePrep === 'note') {
    const nativeAction = activePrep === 'mute' ? 'mute' : 'add-mod-note';

    return (
      <ActionPrepPanel
        busy={busyAction === userAction}
        primaryIcon={<RedditUsersIcon data-icon="inline-start" />}
        primaryLabel={activePrep === 'mute' ? 'Mute' : 'Add note'}
        title={
          activePrep === 'mute'
            ? `Mute ${formatUsername(comment.author)}`
            : `Add mod note for ${formatUsername(comment.author)}`
        }
        variant="outline"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            userAction,
            `/api/incidents/${incident.postId}/users/${encodedAuthor}/native-action`,
            {
              action: nativeAction,
              note: userNote,
            }
          )
        }
      >
        <ActionTextArea
          id={`fw-user-note-${comment.id}`}
          label="Note"
          value={userNote}
          onChange={onUserNoteChange}
        />
      </ActionPrepPanel>
    );
  }

  return (
    <ActionPrepPanel
      busy={busyAction === userAction}
      primaryIcon={<RedditBanIcon data-icon="inline-start" />}
      primaryLabel="Remove content"
      title={`Remove recent content from ${formatUsername(comment.author)}`}
      variant="destructive"
      onCancel={onCancel}
      onSubmit={() =>
        run(
          userAction,
          `/api/incidents/${incident.postId}/users/${encodedAuthor}/native-action`,
          {
            action: 'remove-recent-content',
            reason,
          }
        )
      }
    >
      <ActionTextArea
        id={`fw-content-removal-reason-${comment.id}`}
        label="Removal reason"
        value={reason}
        onChange={onReasonChange}
      />
    </ActionPrepPanel>
  );
};

export const RepeatedPhrasesCard = ({ incident }: { incident: Incident }) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Repeated wording</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.repeatedPhrases.length === 0 ? (
        <EmptyText>No repeated wording yet.</EmptyText>
      ) : (
        <div className="flex flex-col">
          {incident.repeatedPhrases.map((phrase) => (
            <div
              key={phrase.phrase}
              className="min-w-0 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <p className="break-words text-sm font-semibold leading-5">
                {phrase.phrase}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                {phrase.count} matches
                {phrase.authors.length
                  ? ` - ${phrase.authors.map(formatUsername).join(', ')}`
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
