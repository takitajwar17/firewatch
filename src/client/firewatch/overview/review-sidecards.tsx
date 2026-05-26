import { useMemo, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { EmptyText } from '../common';
import { formatTime, formatUsername, pluralize } from '../format';
import type { ActionRunner } from '../types';
import { UsernameHistoryTrigger } from '../username-history';
import type { FlaggedComment, Incident } from '../../../shared/api';

type EvidenceRow = {
  label: string;
  meta?: ReactNode;
  value: string;
};

const strongestOpenCommentFrom = (incident: Incident) =>
  [...incident.flaggedComments]
    .filter((comment) => !comment.removed && !comment.reviewed)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.reasons.length - a.reasons.length ||
        b.createdAt - a.createdAt
    )[0];

const commentMeta = (comment: FlaggedComment) => formatUsername(comment.author);

const signalSummary = (incident: Incident) => {
  const parts = [
    incident.impact.reportsGrouped > 0
      ? pluralize(incident.impact.reportsGrouped, 'report')
      : undefined,
    incident.stats.suspiciousLinkHits > 0
      ? pluralize(incident.stats.suspiciousLinkHits, 'watched link')
      : undefined,
    incident.stats.keywordHits > 0
      ? pluralize(incident.stats.keywordHits, 'keyword hit')
      : undefined,
    incident.stats.repeatedPhraseHits > 0
      ? pluralize(incident.stats.repeatedPhraseHits, 'repeated phrase')
      : undefined,
    incident.stats.branchPileOns > 0
      ? pluralize(
          incident.stats.branchPileOns,
          'reply cluster',
          'reply clusters'
        )
      : undefined,
  ].filter((part): part is string => Boolean(part));

  return parts.slice(0, 4).join(' · ');
};

const openWorkSummary = (incident: Incident) => {
  const openComments = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );
  const authorCount = new Set(
    openComments.map((comment) => comment.author.toLowerCase())
  ).size;

  if (openComments.length === 0) {
    return undefined;
  }

  return `${pluralize(openComments.length, 'comment')} from ${pluralize(
    authorCount,
    'author'
  )} still need decisions`;
};

const preparedAutomationSummary = (incident: Incident) => {
  const rules = incident.matchedRules ?? [];
  const firstRule = rules[0];

  if (!firstRule) return undefined;

  const remainingCount = rules.length - 1;

  return remainingCount > 0
    ? `${firstRule.ruleName} + ${pluralize(remainingCount, 'more automation')}`
    : firstRule.ruleName;
};

const evidenceRowsFrom = (incident: Incident) => {
  const topReason = incident.reasons[0] ?? incident.peakReasons?.[0];
  const openComment = strongestOpenCommentFrom(incident);
  const signals = signalSummary(incident);
  const openWork = openWorkSummary(incident);
  const automation = preparedAutomationSummary(incident);
  const safetyReview = incident.safetyReview;

  const rows: EvidenceRow[] = [];

  if (safetyReview) {
    rows.push({
      label: 'Safety review',
      meta: 'Advisory',
      value: safetyReview.summary,
    });
  }

  if (signals || topReason) {
    const reasonRow: EvidenceRow = {
      label: 'Why now',
      value:
        signals || topReason?.detail || topReason?.label || 'Review signal',
    };

    if (topReason) {
      reasonRow.meta = topReason.label;
    }

    rows.push(reasonRow);
  }

  if (openComment) {
    rows.push({
      label: 'Start with',
      meta: commentMeta(openComment),
      value: openComment.body,
    });
  }

  if (openWork) {
    rows.push({
      label: 'Still open',
      value: openWork,
    });
  }

  if (automation) {
    rows.push({
      label: 'Automations',
      meta: `${incident.matchedRules?.length ?? 0} ready`,
      value: automation,
    });
  }

  return rows;
};

export const EvidenceCapsuleCard = ({ incident }: { incident: Incident }) => {
  const rows = evidenceRowsFrom(incident);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Review snapshot</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyText>No review evidence yet.</EmptyText>
        ) : (
          <div className="rounded-md border bg-background">
            {rows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-5 text-muted-foreground">
                    {row.label}
                  </p>
                  {row.meta ? (
                    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
                      {row.meta}
                    </p>
                  ) : null}
                </div>
                <p className="line-clamp-2 min-w-0 break-words text-sm leading-5 text-foreground">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

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

export const SafetyReviewCard = ({ incident }: { incident: Incident }) => {
  if (!incident.safetyReview) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Safety review</CardTitle>
          <Badge variant="outline">Advisory</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-background">
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-semibold leading-5">
              Review before routine cleanup.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Firewatch found narrow safety language. It will not auto-act from
              this signal alone.
            </p>
          </div>
          {incident.safetyReview.matches.map((match) => (
            <div
              key={`${match.category}-${match.matchedText}-${match.createdAt}`}
              className="border-b px-3 py-2.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5">
                    {match.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {match.author ? (
                      <>
                        <UsernameHistoryTrigger
                          className="text-xs text-muted-foreground"
                          incident={incident}
                          username={match.author}
                        />{' '}
                        ·{' '}
                      </>
                    ) : null}
                    {formatTime(match.createdAt)}
                  </p>
                </div>
                <Badge
                  className="max-w-[9rem] truncate"
                  title={match.matchedText}
                  variant="secondary"
                >
                  {match.matchedText}
                </Badge>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {match.detail}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const RiskReasonsCard = ({ incident }: { incident: Incident }) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Current signals</CardTitle>
      {incident.stats.signalsOmitted ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Showing the latest {incident.stats.signalsStored ?? 0} stored signals.
          {` ${incident.stats.signalsOmitted} older signal${
            incident.stats.signalsOmitted === 1 ? '' : 's'
          } were capped.`}
        </p>
      ) : null}
    </CardHeader>
    <CardContent>
      {incident.reasons.length === 0 ? (
        <EmptyText>No current reasons.</EmptyText>
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
                <Badge title="Signal weight used for the Firewatch rating" variant="outline">
                  +{reason.points}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export const ParticipantsCard = ({
  actionLocked = false,
  actionLockReason,
  busyAction,
  incident,
  onAction,
}: {
  actionLocked?: boolean;
  actionLockReason?: string;
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
                          <UsernameHistoryTrigger
                            incident={incident}
                            username={user.username}
                          />
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
                              actionLocked ||
                              busyAction === `clear-strikes:${user.username}`
                            }
                            title={actionLocked ? actionLockReason : undefined}
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
