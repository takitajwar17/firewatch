import { navigateTo } from '@devvit/web/client';
import {
  CheckCircle2,
  ExternalLink,
  Lock,
  RadioTower,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
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
  EmptyText,
  PanelLabel,
  PlaybookButton,
} from './common';
import {
  clampScore,
  formatDateTime,
  formatStatus,
  formatTime,
  formatUsername,
  isTerminalStatus,
  pluralize,
  statusBadgeVariant,
} from './format';
import type { ActionRunner } from './types';
import type { Incident } from '../../shared/api';

export const IncidentIntro = ({ incident }: { incident: Incident }) => (
  <section className="overflow-hidden rounded-lg border bg-card text-card-foreground">
    <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusBadgeVariant[incident.status] ?? 'outline'}>
            Status: {formatStatus(incident.status)}
          </Badge>
          {incident.demo ? <Badge variant="secondary">Demo</Badge> : null}
          {incident.claim ? (
            <Badge variant="outline">
              Taken by {formatUsername(incident.claim.username)}
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-4 max-w-4xl text-2xl font-medium leading-tight sm:text-3xl">
          {incident.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Updated {formatDateTime(incident.updatedAt)}. {incident.stats.signalCount}{' '}
          recent events. Peak incident score {incident.peakScore}/100.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-end justify-between gap-4">
          <span className="text-[13px] font-medium leading-5 text-muted-foreground">
            Current attention
          </span>
          <span className="text-4xl font-medium leading-none tabular-nums">
            {incident.score}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${clampScore(incident.score)}%` }}
          />
        </div>
      </div>
    </div>
  </section>
);

export const IncidentHero = ({
  busyAction,
  incident,
  onAction,
}: {
  busyAction: string | undefined;
  incident: Incident;
  onAction: ActionRunner;
}) => {
  const terminal = isTerminalStatus(incident.status);
  const reminderAlreadyPosted = incident.status === 'cooldown';
  const postLocked = incident.status === 'locked';
  const permalink = incident.permalink;
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed
  ).length;

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="min-w-0">
          <CardTitle>Mod actions</CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            {incident.responseSuggestion.detail}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <PanelLabel>Primary actions</PanelLabel>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <PlaybookButton
              disabled={Boolean(incident.claim) || Boolean(busyAction) || terminal}
              icon={<UserCheck data-icon="inline-start" />}
              label={incident.claim ? 'Taken' : 'Take post'}
              loading={busyAction === 'claim'}
              onClick={() =>
                onAction('claim', `/api/incidents/${incident.postId}/claim`)
              }
            />
            <PlaybookButton
              disabled={
                Boolean(busyAction) ||
                terminal ||
                postLocked ||
                reminderAlreadyPosted
              }
              icon={<RadioTower data-icon="inline-start" />}
              label={reminderAlreadyPosted ? 'Reminder added' : 'Sticky reminder'}
              loading={busyAction === 'cool-down'}
              variant="outline"
              onClick={() =>
                onAction('cool-down', `/api/incidents/${incident.postId}/cool-down`)
              }
            />
            <PlaybookButton
              disabled={Boolean(busyAction) || terminal || postLocked}
              icon={<Lock data-icon="inline-start" />}
              label={postLocked ? 'Locked' : 'Lock post'}
              loading={busyAction === 'lock'}
              variant="destructive"
              onClick={() =>
                onAction('lock', `/api/incidents/${incident.postId}/lock`)
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <PanelLabel>Close out</PanelLabel>
          <div className="flex flex-wrap gap-2">
            <PlaybookButton
              disabled={Boolean(busyAction)}
              icon={<ShieldAlert data-icon="inline-start" />}
              label="Save handoff note"
              loading={busyAction === 'escalate'}
              variant="secondary"
              onClick={() =>
                onAction('escalate', `/api/incidents/${incident.postId}/escalate`)
              }
            />
            {permalink ? (
              <Button variant="ghost" onClick={() => navigateTo(permalink)}>
                <ExternalLink data-icon="inline-start" />
                Open post
              </Button>
            ) : null}
            <PlaybookButton
              disabled={Boolean(busyAction) || terminal || unresolvedCount > 0}
              icon={<CheckCircle2 data-icon="inline-start" />}
              label={
                terminal
                  ? 'Handled'
                  : unresolvedCount > 0
                    ? 'Review comments first'
                    : 'Mark handled'
              }
              loading={busyAction === 'resolve'}
              variant="ghost"
              onClick={() =>
                onAction('resolve', `/api/incidents/${incident.postId}/resolve`)
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ResponseCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Suggested action</CardTitle>
      <CardDescription>{incident.responseSuggestion.label}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {incident.responseSuggestion.steps.map((step, index) => (
        <div key={step} className="flex gap-3 rounded-lg border bg-muted/25 p-3">
          <Badge variant="outline">{index + 1}</Badge>
          <p className="text-sm leading-6">{step}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

export const RiskReasonsCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Why this post is here</CardTitle>
      <CardDescription>
        Based on user comments, reports, watched words, links, and mod actions.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.reasons.length === 0 ? (
        <EmptyText>No mod-review reasons yet.</EmptyText>
      ) : (
        <div className="flex flex-col gap-3">
          {incident.reasons.map((reason) => (
            <div key={reason.key} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5">{reason.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {reason.detail}
                  </p>
                  {reason.evidence?.length ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
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

export const TrendCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Activity trend</CardTitle>
      <CardDescription>
        Current attention from recent user comments, reports, and watched words.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.trend.length === 0 ? (
        <EmptyText>No recent activity yet.</EmptyText>
      ) : (
        <div className="flex h-40 items-stretch gap-2 rounded-lg border bg-muted/20 p-3">
          {incident.trend.map((point) => (
            <div
              key={point.timestamp}
              className="flex min-w-0 flex-1 flex-col gap-2"
              title={`${formatTime(point.timestamp)} attention score ${point.score}`}
            >
              <div className="flex min-h-0 flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-primary"
                  style={{ height: `${Math.max(8, clampScore(point.score))}%` }}
                />
              </div>
              <span className="text-[11px] font-medium leading-none text-muted-foreground">
                {formatTime(point.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export const ParticipantsCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Users in review</CardTitle>
      <CardDescription>
        Users attached to comments that still need a mod decision.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.involvedUsers.length === 0 ? (
        <EmptyText>No users have comments waiting for review.</EmptyText>
      ) : (
        <div className="flex flex-col">
          {incident.involvedUsers.map((user, index) => (
            <div key={user.username}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-5">
                    {formatUsername(user.username)}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {pluralize(user.flagged, 'comment')} to review -{' '}
                    {pluralize(user.signals, 'recent event')} -{' '}
                    {pluralize(user.branchCount, 'branch', 'branches')}
                  </p>
                </div>
                <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                  {formatTime(user.lastSeenAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
