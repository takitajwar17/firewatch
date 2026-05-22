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
import { EmptyText, FieldBlock } from './common';
import { formatUsername } from './format';
import type { ActionRunner } from './types';
import type { Incident } from '../../shared/api';

export const FlaggedCommentsCard = ({
  busyAction,
  cleanupReason,
  incident,
  onAction,
  onCleanupReasonChange,
}: {
  busyAction: string | undefined;
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
              description="Applied to Remove and Remove + ban."
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
                  const banAction = `ban:${comment.author}`;

                  return (
                    <div key={comment.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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

                        <div className="flex shrink-0 flex-wrap gap-2">
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
                            {busyAction === banAction ? 'Working' : 'Remove + ban'}
                          </Button>
                        </div>
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
