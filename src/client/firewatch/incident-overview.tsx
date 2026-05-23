import { useState } from 'react';
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
import {
  DisclosurePanel,
  EmptyText,
  PanelLabel,
  PlaybookButton,
} from './common';
import {
  clampScore,
  formatStatus,
  formatTime,
  formatUsername,
  isTerminalStatus,
  pluralize,
  statusBadgeVariant,
} from './format';
import type { ActionRunner } from './types';
import type {
  CrowdControlLevel,
  FirewatchConfig,
  Incident,
  NativePostAction,
} from '../../shared/api';
import {
  RedditApproveIcon,
  RedditHideIcon,
  RedditLinkIcon,
  RedditListIcon,
  RedditLockIcon,
  RedditPinIcon,
  RedditRemoveIcon,
  RedditReportIcon,
  RedditShieldIcon,
  RedditSpamIcon,
  RedditTagIcon,
  RedditUsersIcon,
} from './reddit-icons';

export const IncidentIntro = ({ incident }: { incident: Incident }) => (
  <section className="overflow-hidden border-b border-border bg-background text-card-foreground">
    <div className="grid gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_168px] xl:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <img
            alt=""
            className="size-8 shrink-0 rounded-full"
            src="/avatar_default_2.png"
          />
          <span className="text-sm font-bold text-muted-foreground">
            {incident.recentSignals[0]?.author
              ? `u/${incident.recentSignals[0].author}`
              : `r/${incident.subredditName}`}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-sm">{formatTime(incident.createdAt)}</span>
          <Badge variant={statusBadgeVariant[incident.status] ?? 'outline'}>
            {formatStatus(incident.status)}
          </Badge>
          {incident.demo ? <Badge variant="secondary">Demo</Badge> : null}
          {incident.claim ? (
            <Badge variant="outline">
              Taken by {formatUsername(incident.claim.username)}
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-3 max-w-4xl text-2xl font-bold leading-tight">
          {incident.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {incident.responseSuggestion.detail}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-muted-foreground">
          <span>1 upvote</span>
          <span aria-hidden="true">·</span>
          <span>{pluralize(incident.flaggedComments.length, 'comment')}</span>
          <span aria-hidden="true">·</span>
          <span>Updated {formatTime(incident.updatedAt)}</span>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/60 p-3">
        <div className="flex items-end justify-between gap-4">
          <span className="text-xs font-semibold leading-5 text-muted-foreground">
            Attention
          </span>
          <span className="text-3xl font-bold leading-none tabular-nums">
            {incident.score}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${clampScore(incident.score)}%` }}
          />
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-semibold leading-5 text-muted-foreground">Suggested action</p>
          <p className="mt-0.5 text-sm font-semibold leading-5">
            {incident.responseSuggestion.label}
          </p>
        </div>
      </div>
    </div>
  </section>
);

export const IncidentHero = ({
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
  const terminal = isTerminalStatus(incident.status);
  const reminderAlreadyPosted = incident.status === 'cooldown';
  const postLocked = incident.status === 'locked';
  const permalink = incident.permalink;
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;

  return (
    <Card>
      <CardHeader className="gap-2 border-b border-border">
        <div className="min-w-0">
          <CardTitle>Mod actions</CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            {incident.responseSuggestion.label}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-2">
          <PanelLabel>Primary actions</PanelLabel>
          <div className="flex flex-wrap gap-2">
            <PlaybookButton
              disabled={Boolean(incident.claim) || Boolean(busyAction) || terminal}
              icon={<RedditUsersIcon data-icon="inline-start" />}
              label={incident.claim ? 'Taken' : 'Take'}
              loading={busyAction === 'claim'}
              onClick={() =>
                onAction('claim', `/api/incidents/${incident.postId}/claim`)
              }
            />
            {config.actionControls.stickyReminder ? (
              <PlaybookButton
                disabled={
                  Boolean(busyAction) ||
                  terminal ||
                  postLocked ||
                  reminderAlreadyPosted
                }
                icon={<RedditPinIcon data-icon="inline-start" />}
                label={reminderAlreadyPosted ? 'Reminder added' : 'Sticky'}
                loading={busyAction === 'cool-down'}
                variant="secondary"
                onClick={() =>
                  onAction(
                    'cool-down',
                    `/api/incidents/${incident.postId}/cool-down`
                  )
                }
              />
            ) : null}
            {config.actionControls.lockPost ? (
              <PlaybookButton
                disabled={Boolean(busyAction) || terminal || postLocked}
                icon={<RedditLockIcon data-icon="inline-start" />}
                label={postLocked ? 'Locked' : 'Lock'}
                loading={busyAction === 'lock'}
                variant="destructive"
                onClick={() =>
                  onAction('lock', `/api/incidents/${incident.postId}/lock`)
                }
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <PanelLabel>Close out</PanelLabel>
          <div className="flex flex-wrap gap-2">
            <PlaybookButton
              disabled={Boolean(busyAction) || !config.actionControls.handoffNotes}
              icon={<RedditShieldIcon data-icon="inline-start" />}
              label="Handoff"
              loading={busyAction === 'escalate'}
              variant="secondary"
              onClick={() =>
                onAction('escalate', `/api/incidents/${incident.postId}/escalate`)
              }
            />
            {permalink ? (
              <Button variant="ghost" onClick={() => navigateTo(permalink)}>
                <RedditLinkIcon data-icon="inline-start" />
                Open post
              </Button>
            ) : null}
            <PlaybookButton
              disabled={
                Boolean(busyAction) ||
                terminal ||
                unresolvedCount > 0 ||
                !config.actionControls.markHandled
              }
              icon={<RedditApproveIcon data-icon="inline-start" />}
              label={
                terminal ? 'Handled' : unresolvedCount > 0 ? 'Review comments' : 'Handled'
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

const CROWD_CONTROL_OPTIONS: {
  label: string;
  value: CrowdControlLevel;
}[] = [
  { label: 'Off', value: 'OFF' },
  { label: 'Lenient', value: 'LENIENT' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Strict', value: 'STRICT' },
];

const parseCrowdControlLevel = (value: string): CrowdControlLevel => {
  if (
    value === 'OFF' ||
    value === 'LENIENT' ||
    value === 'MEDIUM' ||
    value === 'STRICT'
  ) {
    return value;
  }
  return 'MEDIUM';
};

export const NativePostControlsCard = ({
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
  const [reason, setReason] = useState('Rule-breaking post');
  const [flairText, setFlairText] = useState('Needs mod review');
  const [crowdControlLevel, setCrowdControlLevel] =
    useState<CrowdControlLevel>('MEDIUM');
  const controls = config.actionControls;
  const disabled = Boolean(busyAction);
  const postLocked = incident.status === 'locked';
  const hasRemovalActions = controls.removePosts || controls.markPostSpam;
  const hasPrimaryActions =
    controls.approvePosts ||
    controls.removePosts ||
    controls.markPostSpam ||
    (controls.unlockPost && postLocked);
  const hasAdvancedActions =
    controls.markPostNsfw ||
    controls.markPostSpoiler ||
    controls.ignoreReports ||
    controls.setPostFlair ||
    controls.crowdControl;
  const runPostAction = (
    action: NativePostAction,
    body: Record<string, unknown> = {}
  ) =>
    onAction(`post:${action}`, `/api/incidents/${incident.postId}/post-action`, {
      action,
      reason,
      ...body,
    });

  if (!hasPrimaryActions && !hasAdvancedActions) return null;

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Post tools</CardTitle>
        <CardDescription>
          Reddit actions for the selected post.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {hasRemovalActions ? (
          <FieldInput
            label="Removal reason"
            value={reason}
            onChange={setReason}
          />
        ) : null}

        {hasPrimaryActions ? (
          <div className="flex flex-wrap gap-2">
            {controls.approvePosts ? (
              <PlaybookButton
                disabled={disabled}
                icon={<RedditApproveIcon data-icon="inline-start" />}
                label="Approve"
                loading={busyAction === 'post:approve'}
                variant="secondary"
                onClick={() => runPostAction('approve')}
              />
            ) : null}
            {controls.removePosts ? (
              <PlaybookButton
                disabled={disabled}
                icon={<RedditRemoveIcon data-icon="inline-start" />}
                label="Remove"
                loading={busyAction === 'post:remove'}
                variant="destructive"
                onClick={() => runPostAction('remove')}
              />
            ) : null}
            {controls.markPostSpam ? (
              <PlaybookButton
                disabled={disabled}
                icon={<RedditSpamIcon data-icon="inline-start" />}
                label="Spam post"
                loading={busyAction === 'post:spam'}
                variant="destructive"
                onClick={() => runPostAction('spam')}
              />
            ) : null}
            {controls.unlockPost && postLocked ? (
              <PlaybookButton
                disabled={disabled}
                icon={<RedditLockIcon data-icon="inline-start" />}
                label="Unlock post"
                loading={busyAction === 'post:unlock'}
                variant="outline"
                onClick={() => runPostAction('unlock')}
              />
            ) : null}
          </div>
        ) : null}

        {hasAdvancedActions ? (
          <DisclosurePanel
            description="Flair, report handling, labels, and Crowd Control."
            title="More Reddit post actions"
          >
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {controls.markPostNsfw ? (
                  <>
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditHideIcon data-icon="inline-start" />}
                      label="Mark NSFW"
                      loading={busyAction === 'post:mark-nsfw'}
                      variant="outline"
                      onClick={() => runPostAction('mark-nsfw')}
                    />
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditHideIcon data-icon="inline-start" />}
                      label="Clear NSFW"
                      loading={busyAction === 'post:unmark-nsfw'}
                      variant="ghost"
                      onClick={() => runPostAction('unmark-nsfw')}
                    />
                  </>
                ) : null}
                {controls.markPostSpoiler ? (
                  <>
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditReportIcon data-icon="inline-start" />}
                      label="Mark spoiler"
                      loading={busyAction === 'post:mark-spoiler'}
                      variant="outline"
                      onClick={() => runPostAction('mark-spoiler')}
                    />
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditReportIcon data-icon="inline-start" />}
                      label="Clear spoiler"
                      loading={busyAction === 'post:unmark-spoiler'}
                      variant="ghost"
                      onClick={() => runPostAction('unmark-spoiler')}
                    />
                  </>
                ) : null}
                {controls.ignoreReports ? (
                  <>
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditReportIcon data-icon="inline-start" />}
                      label="Ignore reports"
                      loading={busyAction === 'post:ignore-reports'}
                      variant="outline"
                      onClick={() => runPostAction('ignore-reports')}
                    />
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditReportIcon data-icon="inline-start" />}
                      label="Watch reports"
                      loading={busyAction === 'post:unignore-reports'}
                      variant="ghost"
                      onClick={() => runPostAction('unignore-reports')}
                    />
                  </>
                ) : null}
              </div>

              {controls.setPostFlair ? (
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <FieldInput
                    label="Post flair"
                    value={flairText}
                    onChange={setFlairText}
                  />
                  <div className="flex items-end">
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditTagIcon data-icon="inline-start" />}
                      label="Set flair"
                      loading={busyAction === 'post:set-flair'}
                      variant="outline"
                      onClick={() => runPostAction('set-flair', { flairText })}
                    />
                  </div>
                </div>
              ) : null}

              {controls.crowdControl ? (
                <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <label
                    className="text-[13px] font-semibold leading-none"
                    htmlFor="fw-crowd-control"
                  >
                    Crowd Control
                  </label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <select
                      id="fw-crowd-control"
                      className="h-9 w-full rounded-full border border-transparent bg-secondary px-4 text-sm outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                      value={crowdControlLevel}
                      onChange={(event) =>
                        setCrowdControlLevel(
                          parseCrowdControlLevel(event.target.value)
                        )
                      }
                    >
                      {CROWD_CONTROL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <PlaybookButton
                      disabled={disabled}
                      icon={<RedditListIcon data-icon="inline-start" />}
                      label="Apply"
                      loading={busyAction === 'post:crowd-control'}
                      variant="outline"
                      onClick={() =>
                        runPostAction('crowd-control', { crowdControlLevel })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </DisclosurePanel>
        ) : null}
      </CardContent>
    </Card>
  );
};

const FieldInput = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <label className="flex flex-col gap-2">
    <span className="text-[13px] font-semibold leading-none">{label}</span>
    <Input value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

export const ResponseCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Suggested action</CardTitle>
      <CardDescription>{incident.responseSuggestion.label}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {incident.responseSuggestion.steps.map((step, index) => (
        <div key={step} className="flex gap-3 rounded-lg border bg-muted/60 p-3">
          <Badge variant="outline">{index + 1}</Badge>
          <p className="text-sm leading-6">{step}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const ImpactSnapshotCard = ({ incident }: { incident: Incident }) => {
  const impact = incident.impact;
  const rows = [
    {
      label: 'Comments reviewed',
      value: String(impact.commentsReviewed),
      detail: `${impact.commentsAwaitingReview} waiting`,
    },
    {
      label: 'Users handled',
      value: String(impact.usersHandled),
      detail: `${impact.usersInReview} in review`,
    },
    {
      label: 'Mod actions',
      value: String(impact.actionsTaken),
      detail: `${impact.approvals} approved, ${impact.removals} removed, ${impact.bans} banned`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderator impact</CardTitle>
        <CardDescription>
          Actions taken and remaining review work for this post.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border bg-muted/60">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">{row.label}</p>
                <p className="truncate text-xs leading-5 text-muted-foreground">
                  {row.detail}
                </p>
              </div>
              <span className="shrink-0 text-xl font-bold leading-none tabular-nums">
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">Open {formatDuration(impact.timeOpenMinutes)}</Badge>
          <Badge variant="outline">Peak {impact.peakAttention}/100</Badge>
          {impact.handoffSaved ? (
            <Badge variant="secondary">Handoff saved</Badge>
          ) : null}
          {impact.finalNoteSaved ? (
            <Badge variant="secondary">Final note saved</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

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
                  <p className="text-sm font-semibold leading-5">{reason.label}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
        <div className="flex h-40 items-stretch gap-2 rounded-lg border bg-muted/60 p-3">
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
              <span className="text-[11px] font-semibold leading-none text-muted-foreground">
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
      <CardTitle>Users to review</CardTitle>
      <CardDescription>
        Users attached to comments that still need a mod decision.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.involvedUsers.length === 0 ? (
        <EmptyText>No users have unreviewed comments.</EmptyText>
      ) : (
        <div className="flex flex-col">
          {incident.involvedUsers.map((user, index) => (
            <div key={user.username}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-5">
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
