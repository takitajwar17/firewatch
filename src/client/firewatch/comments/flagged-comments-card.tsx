import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  EmptyText,
  Input,
  PanelLabel,
  RedditActionButton,
  RedditMenuItem,
  RedditMenuSeparator,
  RedditOverflowMenu,
} from '../common';
import { formatTime, formatUsername } from '../format';
import { openRedditUrlInNewTab } from '../navigation';
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
} from '../reddit-icons';
import type { ActionRunner } from '../types';
import { UsernameHistoryTrigger } from '../username-history';
import type { FirewatchConfig, Incident } from '../../../shared/api';
import { CommentActionPrepPanel } from './comment-action-prep';
import { CommentContextBlock } from './comment-context';
import {
  buildCommentReviewState,
  buildCommentThreadContextById,
  buildFirstOpenCommentIdByAuthor,
  commentAuthorKey,
  type CommentPrepSelection,
} from './comment-state';

export const FlaggedCommentsCard = ({
  actionLocked,
  actionLockReason,
  busyAction,
  config,
  incident,
  onAction,
}: {
  actionLocked: boolean;
  actionLockReason: string;
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
  const [bulkReviewState, setBulkReviewState] = useState(() => ({
    postId: incident.postId,
    removeOpen: false,
    selectedCommentIds: new Set<string>(),
  }));
  const { actionSnapshotById, alreadyActioned, commentStateById, needsReview } =
    useMemo(() => buildCommentReviewState(incident), [incident]);
  const controls = config.actionControls;
  const omittedReviewComments = incident.stats.flaggedCommentsOmitted ?? 0;
  const selectedCommentIds = useMemo(
    () =>
      bulkReviewState.postId === incident.postId
        ? bulkReviewState.selectedCommentIds
        : new Set<string>(),
    [bulkReviewState, incident.postId]
  );
  const bulkRemoveOpen =
    bulkReviewState.postId === incident.postId
      ? bulkReviewState.removeOpen
      : false;
  const selectionEnabled =
    !actionLocked &&
    needsReview.length > 1 &&
    (controls.approveComments || controls.removeComments);
  const selectedOpenCommentIds = useMemo(
    () =>
      needsReview
        .map((comment) => comment.id)
        .filter((commentId) => selectedCommentIds.has(commentId)),
    [needsReview, selectedCommentIds]
  );
  const selectedCount = selectedOpenCommentIds.length;
  const allSelected =
    needsReview.length > 0 && selectedCount === needsReview.length;
  const bulkApproveAction = 'bulk-comments:approve';
  const bulkRemoveAction = 'bulk-comments:remove';
  const firstOpenCommentIdByAuthor = useMemo(
    () => buildFirstOpenCommentIdByAuthor(needsReview),
    [needsReview]
  );
  const contextByCommentId = useMemo(
    () => buildCommentThreadContextById(incident),
    [incident]
  );

  const clearBulkSelection = () => {
    setBulkReviewState({
      postId: incident.postId,
      removeOpen: false,
      selectedCommentIds: new Set<string>(),
    });
  };

  const toggleSelectedComment = (commentId: string) => {
    if (actionLocked) return;

    setBulkReviewState((current) => {
      const currentSelection =
        current.postId === incident.postId
          ? current.selectedCommentIds
          : new Set<string>();
      const next = new Set(currentSelection);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return {
        postId: incident.postId,
        removeOpen:
          current.postId === incident.postId ? current.removeOpen : false,
        selectedCommentIds: next,
      };
    });
  };

  const toggleAllSelectedComments = () => {
    if (actionLocked) return;

    setBulkReviewState({
      postId: incident.postId,
      removeOpen: false,
      selectedCommentIds: allSelected
        ? new Set<string>()
        : new Set(needsReview.map((comment) => comment.id)),
    });
  };

  const updateBulkRemoveOpen = (removeOpen: boolean) => {
    if (actionLocked) return;

    setBulkReviewState((current) => ({
      postId: incident.postId,
      removeOpen,
      selectedCommentIds:
        current.postId === incident.postId
          ? current.selectedCommentIds
          : new Set<string>(),
    }));
  };

  const runBulkReview = (action: 'approve' | 'remove') => {
    if (actionLocked) return;

    const commentIds = selectedOpenCommentIds;
    if (commentIds.length === 0) return;

    void onAction(
      action === 'approve' ? bulkApproveAction : bulkRemoveAction,
      `/api/incidents/${incident.postId}/comments/bulk-review`,
      {
        action,
        commentIds,
        ...(action === 'remove' ? { reason } : {}),
      }
    ).then((updatedIncident) => {
      if (updatedIncident) clearBulkSelection();
    });
  };

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
          {omittedReviewComments > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Showing the top {needsReview.length} open comments.{' '}
              {omittedReviewComments} older review match
              {omittedReviewComments === 1 ? '' : 'es'} are hidden.
            </p>
          ) : null}
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
          <div className="flex flex-col">
            {selectionEnabled ? (
              <div className="border-b border-border bg-muted/25 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleAllSelectedComments}
                  >
                    {allSelected ? 'Clear selection' : 'Select all'}
                  </Button>
                  <span className="text-xs font-semibold leading-5 text-muted-foreground">
                    {selectedCount > 0
                      ? `${selectedCount} selected`
                      : 'Select comments to review together'}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {selectedCount > 0 && !allSelected ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearBulkSelection}
                      >
                        Clear
                      </Button>
                    ) : null}
                    {controls.approveComments ? (
                      <RedditActionButton
                        action={bulkApproveAction}
                        busyAction={busyAction}
                        disabled={actionLocked || selectedCount === 0}
                        icon={<RedditApproveIcon data-icon="inline-start" />}
                        label="Approve selected"
                        title={actionLocked ? actionLockReason : undefined}
                        variant="secondary"
                        onClick={() => runBulkReview('approve')}
                      />
                    ) : null}
                    {controls.removeComments ? (
                      <Button
                        disabled={
                          Boolean(busyAction) ||
                          actionLocked ||
                          selectedCount === 0
                        }
                        size="sm"
                        title={actionLocked ? actionLockReason : undefined}
                        variant={bulkRemoveOpen ? 'destructive' : 'secondary'}
                        onClick={() => updateBulkRemoveOpen(true)}
                      >
                        <RedditRemoveIcon data-icon="inline-start" />
                        Remove selected
                      </Button>
                    ) : null}
                  </div>
                </div>
                {bulkRemoveOpen && selectedCount > 0 ? (
                  <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-background p-2 sm:flex-row sm:items-center">
                    <Input
                      aria-label="Removal reason for selected comments"
                      className="sm:flex-1"
                      disabled={actionLocked}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <RedditActionButton
                      action={bulkRemoveAction}
                      busyAction={busyAction}
                      disabled={actionLocked || selectedCount === 0}
                      icon={<RedditRemoveIcon data-icon="inline-start" />}
                      label={`Confirm remove ${selectedCount}`}
                      title={actionLocked ? actionLockReason : undefined}
                      variant="destructive"
                      onClick={() => runBulkReview('remove')}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateBulkRemoveOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
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
              const selected =
                !actionLocked && selectedCommentIds.has(comment.id);

              return (
                <article
                  key={comment.id}
                  className={cn(
                    'content-visibility-list-item min-w-0 overflow-hidden border-b border-border px-3 py-2.5 last:border-b-0',
                    selected ? 'bg-accent/30' : undefined
                  )}
                >
                  <div className="flex gap-2.5">
                    {selectionEnabled ? (
                      <input
                        aria-label={`Select comment by ${authorLabel}`}
                        checked={selected}
                        className="mt-1 size-4 shrink-0 accent-primary"
                        type="checkbox"
                        onChange={() => toggleSelectedComment(comment.id)}
                      />
                    ) : null}
                    <img
                      alt=""
                      className="mt-0.5 size-7 shrink-0 rounded-full"
                      src="/avatar_default_2.png"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <UsernameHistoryTrigger
                          incident={incident}
                          username={comment.author}
                        />
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
                            disabled={actionLocked || !commentOpen}
                            icon={
                              <RedditApproveIcon data-icon="inline-start" />
                            }
                            label={
                              commentState.reviewed ? 'Approved' : 'Approve'
                            }
                            title={actionLocked ? actionLockReason : undefined}
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
                            disabled={actionLocked || !commentOpen}
                            icon={<RedditRemoveIcon data-icon="inline-start" />}
                            label={commentState.removed ? 'Removed' : 'Remove'}
                            title={actionLocked ? actionLockReason : undefined}
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
                            disabled={
                              actionLocked || !canBanAuthor || !commentOpen
                            }
                            icon={<RedditBanIcon data-icon="inline-start" />}
                            label="Remove and ban"
                            title={actionLocked ? actionLockReason : undefined}
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !commentOpen
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !commentOpen
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !commentOpen
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !commentOpen
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        actionLocked ||
                                        !commentOpen ||
                                        commentState.shown
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !canBanAuthor
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !canBanAuthor
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !canBanAuthor
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                                        Boolean(busyAction) ||
                                        actionLocked ||
                                        !canBanAuthor
                                      }
                                      description={
                                        actionLocked
                                          ? actionLockReason
                                          : undefined
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
                          actionLocked={actionLocked}
                          actionLockReason={actionLockReason}
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
                const approveAction = `approve:${comment.id}`;
                const removeAction = `remove:${comment.id}`;
                const lockToggle = commentState.locked ? 'unlock' : 'lock';
                const lockAction = `comment:${comment.id}:${lockToggle}`;
                const reportsToggle = commentState.reportsIgnored
                  ? 'unignore-reports'
                  : 'ignore-reports';
                const reportsAction = `comment:${comment.id}:${reportsToggle}`;
                const showAction = `comment:${comment.id}:show`;
                const actionLabel = commentState.removed
                  ? commentState.spammed
                    ? 'spammed'
                    : 'removed'
                  : 'approved';
                const canShowStateMenu =
                  controls.lockComments ||
                  controls.ignoreCommentReports ||
                  controls.showComments;

                return (
                  <div
                    key={comment.id}
                    className="content-visibility-list-item border-t border-border px-3 py-2.5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold leading-5">
                          <UsernameHistoryTrigger
                            incident={incident}
                            username={comment.author}
                          />
                          <span
                            aria-hidden="true"
                            className="text-muted-foreground/70"
                          >
                            ·
                          </span>
                          <span>{actionLabel}</span>
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
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 md:justify-end">
                        {commentState.removed && controls.approveComments ? (
                          <RedditActionButton
                            action={approveAction}
                            busyAction={busyAction}
                            disabled={actionLocked}
                            icon={
                              <RedditApproveIcon data-icon="inline-start" />
                            }
                            label="Restore"
                            title={actionLocked ? actionLockReason : undefined}
                            variant="secondary"
                            onClick={() =>
                              onAction(
                                approveAction,
                                `/api/incidents/${incident.postId}/comments/${comment.id}/approve`
                              )
                            }
                          />
                        ) : null}
                        {!commentState.removed && controls.removeComments ? (
                          <RedditActionButton
                            action={removeAction}
                            busyAction={busyAction}
                            disabled={actionLocked}
                            icon={<RedditRemoveIcon data-icon="inline-start" />}
                            label="Remove"
                            title={actionLocked ? actionLockReason : undefined}
                            variant="secondary"
                            onClick={() =>
                              setActivePrep({
                                commentId: comment.id,
                                kind: 'remove',
                              })
                            }
                          />
                        ) : null}
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
                        {canShowStateMenu ? (
                          <RedditOverflowMenu align="end" label="More actions">
                            <>
                              {controls.lockComments ? (
                                <RedditMenuItem
                                  disabled={Boolean(busyAction) || actionLocked}
                                  description={
                                    actionLocked ? actionLockReason : undefined
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
                                  disabled={Boolean(busyAction) || actionLocked}
                                  description={
                                    actionLocked ? actionLockReason : undefined
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
                                    actionLocked ||
                                    commentState.shown
                                  }
                                  description={
                                    actionLocked ? actionLockReason : undefined
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
                          </RedditOverflowMenu>
                        ) : null}
                      </div>
                    </div>
                    {activePrep?.commentId === comment.id ? (
                      <CommentActionPrepPanel
                        activePrep={activePrep.kind}
                        actionLocked={actionLocked}
                        actionLockReason={actionLockReason}
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
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};
