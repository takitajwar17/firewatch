import type { ReactNode } from 'react';
import { navigateTo } from '@devvit/web/client';
import { ExternalLink, RefreshCw } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DisclosurePanel, EmptyText, FieldBlock } from './common';
import { formatUsername } from './format';
import type { ActionRunner } from './types';
import type { FirewatchConfig, Incident } from '../../shared/api';

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
    <Card>
      <CardHeader>
        <CardTitle>Needs review</CardTitle>
        <CardDescription>
          Comments that matched reports, watched words, or watched domains.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {needsReview.length === 0 ? (
          <EmptyText>No comments need review.</EmptyText>
        ) : (
          <>
            <FieldBlock
              description="Used when a selected action needs a mod reason."
              htmlFor="fw-cleanup-reason"
              label="Removal and ban reason"
            >
              <Input
                id="fw-cleanup-reason"
                value={cleanupReason}
                onChange={(event) => onCleanupReasonChange(event.target.value)}
              />
            </FieldBlock>

            <ScrollArea className="max-h-[420px] pr-3">
              <div className="flex flex-col gap-3">
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
                    <div key={comment.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium leading-5">
                              {authorLabel}
                            </p>
                            <Badge variant="outline">attention {comment.score}</Badge>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
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

                        <div className="flex flex-wrap gap-2">
                          {permalink ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateTo(permalink)}
                            >
                              <ExternalLink data-icon="inline-start" />
                              Open
                            </Button>
                          ) : null}
                          {controls.approveComments ? (
                            <Button
                              disabled={Boolean(busyAction)}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onAction(
                                  approveAction,
                                  `/api/incidents/${incident.postId}/comments/${comment.id}/approve`
                                )
                              }
                            >
                              {busyAction === approveAction ? (
                                <RefreshCw
                                  className="animate-spin"
                                  data-icon="inline-start"
                                />
                              ) : null}
                              {busyAction === approveAction ? 'Working' : 'Approve'}
                            </Button>
                          ) : null}
                          {controls.removeComments ? (
                            <Button
                              disabled={Boolean(busyAction)}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onAction(
                                  removeAction,
                                  `/api/incidents/${incident.postId}/comments/${comment.id}/remove`,
                                  { reason: cleanupReason }
                                )
                              }
                            >
                              {busyAction === removeAction ? (
                                <RefreshCw
                                  className="animate-spin"
                                  data-icon="inline-start"
                                />
                              ) : null}
                              {busyAction === removeAction ? 'Working' : 'Remove'}
                            </Button>
                          ) : null}
                          {controls.banUsers && controls.removeComments ? (
                            <Button
                              disabled={Boolean(busyAction) || !canBanAuthor}
                              size="sm"
                              title="Remove this user's review comments, then ban them from the subreddit."
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
                                <RefreshCw
                                  className="animate-spin"
                                  data-icon="inline-start"
                                />
                              ) : null}
                              {busyAction === banAction ? 'Working' : 'Ban user'}
                            </Button>
                          ) : null}
                        </div>

                        {hasAdvancedCommentActions || hasAdvancedUserActions ? (
                          <DisclosurePanel
                            description="Spam, thread cleanup, locking, reports, and user tools."
                            title="More Reddit actions"
                          >
                            <div className="flex flex-col gap-3">
                              {hasAdvancedCommentActions ? (
                                <ActionGroup label="Comment">
                                  {controls.markCommentSpam ? (
                                    <NativeActionButton
                                      action={spamAction}
                                      busyAction={busyAction}
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
                                      label="Mute"
                                      onClick={() =>
                                        onAction(
                                          muteUserAction,
                                          `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/native-action`,
                                          { action: 'mute', note: cleanupReason }
                                        )
                                      }
                                    />
                                  ) : null}
                                  {controls.addModNotes ? (
                                    <NativeActionButton
                                      action={modNoteAction}
                                      busyAction={busyAction}
                                      disabled={!canBanAuthor}
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
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        {alreadyActioned.length > 0 ? (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium leading-5">Already actioned</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Reviewed comments stay here for the handoff note, but no longer
                count as active review work.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {alreadyActioned.map((comment) => {
                const permalink = comment.permalink;

                return (
                  <div key={comment.id} className="rounded-lg border bg-muted/25 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-5">
                          {formatUsername(comment.author)} -{' '}
                          {comment.removed ? 'removed' : 'approved'}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
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
                          variant="outline"
                          onClick={() => navigateTo(permalink)}
                        >
                          <ExternalLink data-icon="inline-start" />
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
      </CardContent>
    </Card>
  );
};

const NativeActionButton = ({
  action,
  busyAction,
  disabled,
  label,
  onClick,
  variant = 'outline',
}: {
  action: string;
  busyAction: string | undefined;
  disabled?: boolean;
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
      <RefreshCw className="animate-spin" data-icon="inline-start" />
    ) : null}
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
    <p className="text-xs font-medium leading-5 text-muted-foreground">
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
              <p className="text-sm font-medium leading-5">{phrase.phrase}</p>
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
