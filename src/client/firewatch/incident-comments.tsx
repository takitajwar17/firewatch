import type { ReactNode } from 'react';
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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { DisclosurePanel, EmptyText, PanelLabel } from './common';
import { formatUsername } from './format';
import type { ActionRunner } from './types';
import type { FirewatchConfig, Incident } from '../../shared/api';
import {
  RedditApproveIcon,
  RedditBanIcon,
  RedditHideIcon,
  RedditLinkIcon,
  RedditLockIcon,
  RedditRefreshIcon,
  RedditRemoveIcon,
  RedditReportIcon,
  RedditSpamIcon,
  RedditUsersIcon,
} from './reddit-icons';

export const FlaggedCommentsCard = ({
  busyAction,
  config,
  cleanupReason,
  incident,
  onAction,
  onCleanupReasonChange,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  cleanupReason: string;
  incident: Incident;
  onAction: ActionRunner;
  onCleanupReasonChange: (value: string) => void;
}) => {
  const needsReview = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );
  const alreadyActioned = incident.flaggedComments.filter(
    (comment) => comment.removed || comment.reviewed
  );
  const controls = config.actionControls;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-5">Needs review</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Comments that matched reports, watched words, or watched domains.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {needsReview.length} open
        </span>
      </div>
      <div className="flex flex-col gap-0">
        {needsReview.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyText>No comments need review.</EmptyText>
          </div>
        ) : (
          <>
            <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:p-4">
              <label
                className="text-xs font-bold leading-5 text-muted-foreground"
                htmlFor="fw-cleanup-reason"
              >
                Removal reason
              </label>
              <Input
                id="fw-cleanup-reason"
                value={cleanupReason}
                onChange={(event) => onCleanupReasonChange(event.target.value)}
              />
            </div>

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
                    className="border-b border-border px-3 py-3 last:border-b-0 sm:px-4"
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
                            attention {comment.score}
                          </span>
                          {comment.reasons.map((reason) => (
                            <Badge key={reason} variant="secondary">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-foreground/90">
                          {comment.body}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {permalink ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigateTo(permalink)}
                            >
                              <RedditLinkIcon data-icon="inline-start" />
                              Open
                            </Button>
                          ) : null}
                          {controls.approveComments ? (
                            <Button
                              disabled={Boolean(busyAction)}
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                onAction(
                                  approveAction,
                                  `/api/incidents/${incident.postId}/comments/${comment.id}/approve`
                                )
                              }
                            >
                              {busyAction === approveAction ? (
                                <RedditRefreshIcon
                                  className="animate-spin"
                                  data-icon="inline-start"
                                />
                              ) : (
                                <RedditApproveIcon data-icon="inline-start" />
                              )}
                              {busyAction === approveAction
                                ? 'Working'
                                : 'Approve'}
                            </Button>
                          ) : null}
                          {controls.removeComments ? (
                            <Button
                              disabled={Boolean(busyAction)}
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                onAction(
                                  removeAction,
                                  `/api/incidents/${incident.postId}/comments/${comment.id}/remove`,
                                  { reason: cleanupReason }
                                )
                              }
                            >
                              {busyAction === removeAction ? (
                                <RedditRefreshIcon
                                  className="animate-spin"
                                  data-icon="inline-start"
                                />
                              ) : (
                                <RedditRemoveIcon data-icon="inline-start" />
                              )}
                              {busyAction === removeAction
                                ? 'Working'
                                : 'Remove'}
                            </Button>
                          ) : null}
                          {controls.banUsers && controls.removeComments ? (
                            <Button
                              disabled={Boolean(busyAction) || !canBanAuthor}
                              size="sm"
                              title="Remove this user's recent subreddit content, then ban them from the subreddit."
                              variant="destructive"
                              onClick={() =>
                                onAction(
                                  banAction,
                                  `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/ban`,
                                  { reason: cleanupReason }
                                )
                              }
                            >
                              {busyAction === banAction ? (
                                <RedditRefreshIcon
                                  className="animate-spin"
                                  data-icon="inline-start"
                                />
                              ) : (
                                <RedditBanIcon data-icon="inline-start" />
                              )}
                              {busyAction === banAction
                                ? 'Working'
                                : 'Ban user'}
                            </Button>
                          ) : null}
                        </div>

                        {hasAdvancedCommentActions || hasAdvancedUserActions ? (
                          <div className="mt-4">
                            <DisclosurePanel
                              description="Spam, thread cleanup, locking, reports, and user tools."
                              title="More actions"
                            >
                              <div className="flex flex-col gap-3">
                                {hasAdvancedCommentActions ? (
                                  <ActionGroup label="Comment">
                                    {controls.markCommentSpam ? (
                                      <NativeActionButton
                                        action={spamAction}
                                        busyAction={busyAction}
                                        icon={
                                          <RedditSpamIcon data-icon="inline-start" />
                                        }
                                        label="Spam"
                                        variant="destructive"
                                        onClick={() =>
                                          onAction(
                                            spamAction,
                                            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                            {
                                              action: 'spam',
                                              reason: cleanupReason,
                                            }
                                          )
                                        }
                                      />
                                    ) : null}
                                    {controls.removeCommentThreads &&
                                    controls.removeComments ? (
                                      <NativeActionButton
                                        action={threadAction}
                                        busyAction={busyAction}
                                        icon={
                                          <RedditRemoveIcon data-icon="inline-start" />
                                        }
                                        label="Remove thread"
                                        variant="destructive"
                                        onClick={() =>
                                          onAction(
                                            threadAction,
                                            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
                                            {
                                              action: 'remove-thread',
                                              reason: cleanupReason,
                                            }
                                          )
                                        }
                                      />
                                    ) : null}
                                    {controls.lockComments ? (
                                      <>
                                        <NativeActionButton
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
                                        <NativeActionButton
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
                                        <NativeActionButton
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
                                        <NativeActionButton
                                          action={watchReportsAction}
                                          busyAction={busyAction}
                                          icon={
                                            <RedditReportIcon data-icon="inline-start" />
                                          }
                                          label="Watch reports"
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
                                      <NativeActionButton
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
                                      <NativeActionButton
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
                                      <NativeActionButton
                                        action={muteUserAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditUsersIcon data-icon="inline-start" />
                                        }
                                        label="Mute"
                                        onClick={() =>
                                          onAction(
                                            muteUserAction,
                                            `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/native-action`,
                                            {
                                              action: 'mute',
                                              note: cleanupReason,
                                            }
                                          )
                                        }
                                      />
                                    ) : null}
                                    {controls.addModNotes ? (
                                      <NativeActionButton
                                        action={modNoteAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditReportIcon data-icon="inline-start" />
                                        }
                                        label="Add mod note"
                                        onClick={() =>
                                          onAction(
                                            modNoteAction,
                                            `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/native-action`,
                                            {
                                              action: 'add-mod-note',
                                              note: cleanupReason,
                                            }
                                          )
                                        }
                                      />
                                    ) : null}
                                    {controls.removeUserContent ? (
                                      <NativeActionButton
                                        action={removeContentAction}
                                        busyAction={busyAction}
                                        disabled={!canBanAuthor}
                                        icon={
                                          <RedditBanIcon data-icon="inline-start" />
                                        }
                                        label="Remove recent content"
                                        variant="destructive"
                                        onClick={() =>
                                          onAction(
                                            removeContentAction,
                                            `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/native-action`,
                                            {
                                              action: 'remove-recent-content',
                                              reason: cleanupReason,
                                            }
                                          )
                                        }
                                      />
                                    ) : null}
                                  </ActionGroup>
                                ) : null}
                              </div>
                            </DisclosurePanel>
                          </div>
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
                Reviewed comments stay here for the handoff note, but no longer
                count as active review work.
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
                        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                          {comment.body}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {comment.reasons.map((reason) => (
                            <Badge key={reason} variant="secondary">
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

const NativeActionButton = ({
  action,
  busyAction,
  disabled,
  icon,
  label,
  onClick,
  variant = 'outline',
}: {
  action: string;
  busyAction: string | undefined;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'outline' | 'destructive' | 'ghost';
}) => (
  <Button
    disabled={Boolean(busyAction) || disabled}
    size="sm"
    variant={variant}
    onClick={onClick}
  >
    {busyAction === action ? (
      <RedditRefreshIcon className="animate-spin" data-icon="inline-start" />
    ) : (
      icon
    )}
    {busyAction === action ? 'Working' : label}
  </Button>
);

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
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

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
            <div key={phrase.phrase} className="rounded-lg border p-3">
              <p className="text-sm font-semibold leading-5">{phrase.phrase}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
