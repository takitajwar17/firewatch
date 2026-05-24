import { useState, type ReactNode } from 'react';
import { navigateTo } from '@devvit/web/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DisclosurePanel,
  EmptyText,
  PanelLabel,
  RedditActionButton,
} from './common';
import {
  ActionPrepPanel,
  ActionSelect,
  ActionTextArea,
} from './action-prep';
import { formatUsername } from './format';
import type { ActionRunner } from './types';
import type { FirewatchConfig, FlaggedComment, Incident } from '../../shared/api';
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
  const needsReview = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );
  const alreadyActioned = incident.flaggedComments.filter(
    (comment) => comment.removed || comment.reviewed
  );
  const controls = config.actionControls;

  return (
    <section className="min-w-0 rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-5">Needs review</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Flagged by reports, watched words, or watched domains.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {needsReview.length} open
        </span>
      </div>
      <div className="flex flex-col gap-0">
        {needsReview.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyText>No comments need mod review.</EmptyText>
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {needsReview.map((comment) => {
                const authorLabel = formatUsername(comment.author);
                const permalink = comment.permalink;
                const canBanAuthor = authorLabel !== 'unknown user';
                const approveAction = `approve:${comment.id}`;
                const removeAction = `remove:${comment.id}`;
                const spamAction = `comment:${comment.id}:spam`;
                const lockAction = `comment:${comment.id}:lock`;
                const unlockAction = `comment:${comment.id}:unlock`;
                const ignoreReportsAction = `comment:${comment.id}:ignore`;
                const watchReportsAction = `comment:${comment.id}:watch`;
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
                  controls.ignoreReports ||
                  controls.showComments;
                const hasAdvancedUserActions =
                  controls.approveUsers ||
                  controls.muteUsers ||
                  controls.addModNotes ||
                  controls.removeUserContent;

                return (
                  <article
                    key={comment.id}
                    className="min-w-0 overflow-hidden border-b border-border px-3 py-3 last:border-b-0 sm:px-4"
                  >
                    <div className="flex gap-3">
                      <img
                        alt=""
                        className="mt-0.5 size-7 shrink-0 rounded-full"
                        src="/avatar_default_2.png"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-bold leading-5 text-foreground">
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
                        <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-foreground/90">
                          {comment.body}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {permalink ? (
                            <Button
                              className="max-w-full"
                              size="sm"
                              variant="ghost"
                              onClick={() => navigateTo(permalink)}
                            >
                              <RedditLinkIcon data-icon="inline-start" />
                              Open
                            </Button>
                          ) : null}
                          {controls.approveComments ? (
                            <RedditActionButton
                              action={approveAction}
                              busyAction={busyAction}
                              icon={
                                <RedditApproveIcon data-icon="inline-start" />
                              }
                              label="Approve"
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
                              icon={
                                <RedditRemoveIcon data-icon="inline-start" />
                              }
                              label="Remove"
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
                              disabled={!canBanAuthor}
                              icon={<RedditBanIcon data-icon="inline-start" />}
                              label="Ban user"
                              title="Remove this user's recent content here, then ban them."
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

                        {hasAdvancedCommentActions || hasAdvancedUserActions ? (
                          <div className="mt-4">
                            <DisclosurePanel
                              description="Spam, thread removal, locks, reports, and user actions."
                              title="More actions"
                            >
                              <div className="flex flex-col gap-3">
                                {hasAdvancedCommentActions ? (
                                  <ActionGroup label="Comment">
                                    {controls.markCommentSpam ? (
                                      <RedditActionButton
                                        action={spamAction}
                                        busyAction={busyAction}
                                        icon={
                                          <RedditSpamIcon data-icon="inline-start" />
                                        }
                                        label="Spam"
                                        variant="destructive"
                                        onClick={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'spam',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.removeCommentThreads &&
                                    controls.removeComments ? (
                                      <RedditActionButton
                                        action={threadAction}
                                        busyAction={busyAction}
                                        icon={
                                          <RedditRemoveIcon data-icon="inline-start" />
                                        }
                                        label="Remove thread"
                                        variant="destructive"
                                        onClick={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'thread',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.lockComments ? (
                                      <>
                                        <RedditActionButton
                                          action={lockAction}
                                          busyAction={busyAction}
                                          icon={
                                            <RedditLockIcon data-icon="inline-start" />
                                          }
                                          label="Lock"
                                          onClick={() =>
                                            onAction(
                                              lockAction,
                                              `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                              { action: 'lock' }
                                            )
                                          }
                                        />
                                        <RedditActionButton
                                          action={unlockAction}
                                          busyAction={busyAction}
                                          icon={
                                            <RedditLockIcon data-icon="inline-start" />
                                          }
                                          label="Unlock"
                                          variant="ghost"
                                          onClick={() =>
                                            onAction(
                                              unlockAction,
                                              `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                              { action: 'unlock' }
                                            )
                                          }
                                        />
                                      </>
                                    ) : null}
                                    {controls.ignoreReports ? (
                                      <>
                                        <RedditActionButton
                                          action={ignoreReportsAction}
                                          busyAction={busyAction}
                                          icon={
                                            <RedditReportIcon data-icon="inline-start" />
                                          }
                                          label="Ignore reports"
                                          onClick={() =>
                                            onAction(
                                              ignoreReportsAction,
                                              `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                              { action: 'ignore-reports' }
                                            )
                                          }
                                        />
                                        <RedditActionButton
                                          action={watchReportsAction}
                                          busyAction={busyAction}
                                          icon={
                                            <RedditReportIcon data-icon="inline-start" />
                                          }
                                          label="Unignore reports"
                                          variant="ghost"
                                          onClick={() =>
                                            onAction(
                                              watchReportsAction,
                                              `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                              { action: 'unignore-reports' }
                                            )
                                          }
                                        />
                                      </>
                                    ) : null}
                                    {controls.showComments ? (
                                      <RedditActionButton
                                        action={showAction}
                                        busyAction={busyAction}
                                        icon={
                                          <RedditHideIcon data-icon="inline-start" />
                                        }
                                        label="Show"
                                        onClick={() =>
                                          onAction(
                                            showAction,
                                            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                            { action: 'show-comment' }
                                          )
                                        }
                                      />
                                    ) : null}
                                  </ActionGroup>
                                ) : null}

                                {hasAdvancedUserActions ? (
                                  <ActionGroup label="User">
                                    {controls.approveUsers ? (
                                      <RedditActionButton
                                        action={approveUserAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditUsersIcon data-icon="inline-start" />
                                        }
                                        label="Approve user"
                                        onClick={() =>
                                          onAction(
                                            approveUserAction,
                                            `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/native-action`,
                                            { action: 'approve' }
                                          )
                                        }
                                      />
                                    ) : null}
                                    {controls.muteUsers ? (
                                      <RedditActionButton
                                        action={muteUserAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditUsersIcon data-icon="inline-start" />
                                        }
                                        label="Mute"
                                        onClick={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'mute',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.addModNotes ? (
                                      <RedditActionButton
                                        action={modNoteAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditReportIcon data-icon="inline-start" />
                                        }
                                        label="Add mod note"
                                        onClick={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'note',
                                          })
                                        }
                                      />
                                    ) : null}
                                    {controls.removeUserContent ? (
                                      <RedditActionButton
                                        action={removeContentAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditBanIcon data-icon="inline-start" />
                                        }
                                        label="Remove recent content"
                                        variant="destructive"
                                        onClick={() =>
                                          setActivePrep({
                                            commentId: comment.id,
                                            kind: 'content',
                                          })
                                        }
                                      />
                                    ) : null}
                                  </ActionGroup>
                                ) : null}
                              </div>
                            </DisclosurePanel>
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
            <div className="px-3 py-3 sm:px-4">
              <PanelLabel>ALREADY ACTIONED</PanelLabel>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                These stay in the record and no longer count as open review.
              </p>
            </div>
            <div className="flex flex-col">
              {alreadyActioned.map((comment) => {
                const permalink = comment.permalink;

                return (
                  <div
                    key={comment.id}
                    className="border-t border-border px-3 py-3 sm:px-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5">
                          {formatUsername(comment.author)} -{' '}
                          {comment.removed ? 'removed' : 'approved'}
                        </p>
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
                          onClick={() => navigateTo(permalink)}
                        >
                          <RedditLinkIcon data-icon="inline-start" />
                          Open
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

const ActionGroup = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold leading-5 text-muted-foreground">
      {label}
    </p>
    <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
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
  const run = (action: string, endpoint: string, body: Record<string, unknown>) => {
    void onAction(action, endpoint, body).then((updatedIncident) => {
      if (updatedIncident) onCancel();
    });
  };

  if (activePrep === 'remove') {
    return (
      <ActionPrepPanel
        busy={busyAction === removeAction}
        description="Add a removal reason before removing."
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
          description="Saved as a removal note when Reddit accepts one."
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
        description="Removes this user's unreviewed comments first, then bans them."
        primaryIcon={<RedditBanIcon data-icon="inline-start" />}
        primaryLabel="Remove and ban"
        title={`Ban ${formatUsername(comment.author)}`}
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(banAction, `/api/incidents/${incident.postId}/users/${encodedAuthor}/ban`, {
            durationDays: parseBanDuration(banDuration),
            reason,
          })
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
          description="Used for the ban note and removals."
          id={`fw-ban-reason-${comment.id}`}
          label="Reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'spam' || activePrep === 'thread') {
    const nativeAction =
      activePrep === 'spam' ? 'spam' : 'remove-thread';

    return (
      <ActionPrepPanel
        busy={busyAction === commentAction}
        description={
          activePrep === 'spam'
            ? 'Mark this comment as spam and add an optional removal note.'
            : 'Remove this comment and the replies Reddit returns under it.'
        }
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
          description="Saved as the removal note when Reddit accepts one."
          id={`fw-comment-native-reason-${comment.id}`}
          label="Reason"
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
        description={
          activePrep === 'mute'
            ? 'Mute this user from modmail and save the note.'
            : 'Add a Reddit mod note for this user.'
        }
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
          description="Saved with the Reddit action."
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
      description="Remove recent posts and comments from this subreddit that Firewatch can access."
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
        description="Saved as the removal note when Reddit accepts one."
        id={`fw-content-removal-reason-${comment.id}`}
        label="Reason"
        value={reason}
        onChange={onReasonChange}
      />
    </ActionPrepPanel>
  );
};

export const RepeatedPhrasesCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Repeated wording</CardTitle>
      <CardDescription>
        Repeated phrases across user comments can point to brigading.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.repeatedPhrases.length === 0 ? (
        <EmptyText>No repeated wording found.</EmptyText>
      ) : (
        <div className="flex flex-col gap-3">
          {incident.repeatedPhrases.map((phrase) => (
            <div key={phrase.phrase} className="min-w-0 rounded-lg border p-3">
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
