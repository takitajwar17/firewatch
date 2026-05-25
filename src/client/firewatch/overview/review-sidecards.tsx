import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EmptyText } from '../common';
import { formatTime, formatUsername, pluralize } from '../format';
import type { ActionRunner } from '../types';
import type { Incident } from '../../../shared/api';

export const ResponseCard = ({ incident }: { incident: Incident }) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Suggested action</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.responseSuggestion.steps.map((step, index) => (
        <div
          key={step}
          className="flex gap-2 border-t border-border py-2 first:border-t-0 first:pt-0 last:pb-0"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {index + 1}
          </span>
          <p className="text-sm leading-5">{step}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

export const RiskReasonsCard = ({ incident }: { incident: Incident }) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Signals</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.reasons.length === 0 ? (
        <EmptyText>No active reasons.</EmptyText>
      ) : (
        <div className="flex flex-col">
          {incident.reasons.map((reason) => (
            <div
              key={reason.key}
              className="border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5">
                    {reason.label}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {reason.detail}
                  </p>
                  {reason.evidence?.length ? (
                    <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                      {reason.evidence.join(', ')}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline">+{reason.points}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export const ParticipantsCard = ({
  busyAction,
  incident,
  onAction,
}: {
  busyAction?: string | undefined;
  incident: Incident;
  onAction?: ActionRunner | undefined;
}) => {
  const strikeSummaryByUsername = useMemo(() => {
    const summaries = new Map(
      (incident.userStrikeSummaries ?? []).map((summary) => [
        summary.username.toLowerCase(),
        summary,
      ])
    );

    return summaries;
  }, [incident.userStrikeSummaries]);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Authors with open comments</CardTitle>
      </CardHeader>
      <CardContent>
        {incident.involvedUsers.length === 0 ? (
          <EmptyText>No authors with open comments.</EmptyText>
        ) : (
          <div className="flex flex-col">
            {incident.involvedUsers.map((user, index) => {
              const strikeSummary = strikeSummaryByUsername.get(
                user.username.toLowerCase()
              );

              return (
                <div
                  key={user.username}
                  className="content-visibility-list-item"
                >
                  {index > 0 ? <Separator /> : null}
                  <div className="flex flex-col gap-2 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-5">
                          {formatUsername(user.username)}
                        </p>
                        <p className="break-words text-xs leading-5 text-muted-foreground">
                          {pluralize(user.flagged, 'open comment')} ·{' '}
                          {pluralize(user.signals, 'recent event')} ·{' '}
                          {pluralize(
                            user.branchCount,
                            'reply branch',
                            'reply branches'
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                        {formatTime(user.lastSeenAt)}
                      </span>
                    </div>
                    {strikeSummary && strikeSummary.strikeCount > 0 ? (
                      <div className="rounded-md bg-muted/45 p-2">
                        <p className="text-xs font-semibold leading-5">
                          {strikeSummary.strikeCount} Firewatch strike
                          {strikeSummary.strikeCount === 1 ? '' : 's'} in{' '}
                          {strikeSummary.recentWindowDays} days
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {strikeSummary.removedComments} removed comments -{' '}
                          {strikeSummary.suspiciousDomainHits} suspicious domain
                          hits
                          {strikeSummary.preparedAction
                            ? ` - Prepared action: ${strikeSummary.preparedAction}`
                            : ''}
                        </p>
                        {onAction ? (
                          <button
                            className="mt-1 text-xs font-semibold text-primary hover:underline disabled:text-muted-foreground"
                            disabled={
                              Boolean(busyAction) ||
                              busyAction === `clear-strikes:${user.username}`
                            }
                            type="button"
                            onClick={() =>
                              onAction(
                                `clear-strikes:${user.username}`,
                                `/api/incidents/${incident.postId}/users/${user.username}/strikes/clear`
                              )
                            }
                          >
                            Clear strikes
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
