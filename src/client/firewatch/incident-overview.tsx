import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { navigateTo } from '@devvit/web/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ActionInput,
  ActionPrepPanel,
  ActionSelect,
  ActionTextArea,
} from './action-prep';
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
} from './format';
import type { ActionRunner } from './types';
import type {
  CrowdControlLevel,
  FirewatchConfig,
  Incident,
  NativePostAction,
  PostFlairOption,
} from '../../shared/api';
import {
  CROWD_CONTROL_OPTIONS,
  parseCrowdControlLevel,
} from '../../shared/reddit-actions';
import {
  RedditApproveIcon,
  RedditCommentIcon,
  RedditDownvoteIcon,
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
  RedditUpvoteIcon,
  RedditUsersIcon,
} from './reddit-icons';

export const IncidentIntro = ({ incident }: { incident: Incident }) => {
  const authorLabel = incident.postAuthor
    ? formatUsername(incident.postAuthor)
    : `r/${incident.subredditName}`;
  const postScore = incident.postScore ?? incident.score;
  const postCommentCount =
    incident.postCommentCount ?? incident.flaggedComments.length;

  return (
    <section className="overflow-hidden border-b border-border bg-background text-card-foreground">
      <div className="grid max-w-full grid-cols-[minmax(0,1fr)] gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
        <article className="min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <img
              alt=""
              className="size-8 shrink-0 rounded-full"
              src="/avatar_default_2.png"
            />
            <span className="font-bold text-foreground">{authorLabel}</span>
            <span aria-hidden="true" className="text-muted-foreground/70">
              ·
            </span>
            <span>{formatTime(incident.createdAt)}</span>
            <InlineState variant="review">
              {formatStatus(incident.status)}
            </InlineState>
            {incident.demo ? <InlineState>Demo</InlineState> : null}
            {incident.claim ? (
              <InlineState variant="outline">
                Taken by {formatUsername(incident.claim.username)}
              </InlineState>
            ) : null}
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 max-w-full break-words text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {incident.title}
            </h1>
            <PostStateBadges incident={incident} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PostMetricPill
              ariaLabel={`Post score ${postScore}`}
              icon={<RedditUpvoteIcon />}
              secondaryIcon={<RedditDownvoteIcon />}
              value={String(postScore)}
            />
            <PostMetricPill
              ariaLabel={`${pluralize(postCommentCount, 'comment')} on Reddit`}
              icon={<RedditCommentIcon />}
              value={String(postCommentCount)}
            />
            <span className="px-1 text-xs font-semibold leading-6 text-muted-foreground">
              Updated {formatTime(incident.updatedAt)}
            </span>
          </div>
        </article>
        <AttentionScoreRail incident={incident} />
      </div>
    </section>
  );
};

const AttentionScoreRail = ({ incident }: { incident: Incident }) => {
  const score = clampScore(incident.score);
  const attentionTone =
    incident.level === 'watch'
      ? 'bg-primary/70'
      : incident.level === 'heat'
        ? 'bg-orange-500'
        : 'bg-destructive';

  return (
    <aside
      aria-label={`Review score ${incident.score}`}
      className="max-w-full rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold leading-4 text-muted-foreground">
          Review score
        </span>
        <Badge
          className="h-6 rounded-full px-2.5 text-xs font-bold tabular-nums"
          variant="secondary"
        >
          {incident.score}
        </Badge>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full', attentionTone)}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2 font-bold leading-5 text-foreground">
        <RedditCommentIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{incident.responseSuggestion.label}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <RedditReportIcon className="size-3.5" />
          {pluralize(incident.stats.reportSignals, 'report')}
        </span>
        <span aria-hidden="true">·</span>
        <span>{pluralize(incident.stats.keywordHits, 'keyword hit')}</span>
      </div>
    </aside>
  );
};

const InlineState = ({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'review';
}) => (
  <span
    className={cn(
      'inline-flex h-5 items-center rounded-full px-2 text-xs font-bold leading-none',
      variant === 'review'
        ? 'bg-destructive/15 text-destructive'
        : variant === 'outline'
          ? 'border border-border bg-transparent text-muted-foreground'
          : 'bg-secondary text-secondary-foreground'
    )}
  >
    {children}
  </span>
);

const isPostLocked = (incident: Incident) =>
  incident.postState?.locked ?? incident.status === 'locked';

const PostStateBadges = ({ incident }: { incident: Incident }) => {
  const state = incident.postState;
  if (!state) return null;

  return (
    <>
      {state.flair ? <PostFlairChip state={state.flair} /> : null}
      {state.nsfw ? <PostLabelChip tone="danger">NSFW</PostLabelChip> : null}
      {state.spoiler ? <PostLabelChip>Spoiler</PostLabelChip> : null}
      {state.locked && incident.status !== 'locked' ? (
        <PostLabelChip>Locked</PostLabelChip>
      ) : null}
      {state.ignoringReports ? (
        <PostLabelChip>Reports ignored</PostLabelChip>
      ) : null}
      {state.removed || state.spam ? (
        <PostLabelChip tone="danger">
          {state.spam ? 'Spam' : 'Removed'}
        </PostLabelChip>
      ) : state.approved ? (
        <PostLabelChip tone="success">Approved</PostLabelChip>
      ) : null}
    </>
  );
};

const PostFlairChip = ({
  state,
}: {
  state: NonNullable<Incident['postState']>['flair'];
}) => {
  if (!state?.text) return null;

  const style: CSSProperties | undefined = state.backgroundColor
    ? {
        backgroundColor: state.backgroundColor,
        color: state.textColor === 'light' ? '#ffffff' : '#181c1f',
      }
    : undefined;

  return (
    <span
      className="inline-flex h-5 max-w-full items-center rounded px-1.5 text-xs font-bold leading-none text-secondary-foreground"
      style={style}
      title={`Post flair: ${state.text}`}
    >
      <span className="truncate">{state.text}</span>
    </span>
  );
};

const PostLabelChip = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'danger' | 'neutral' | 'success';
}) => (
  <span
    className={cn(
      'inline-flex h-5 items-center rounded px-1.5 text-xs font-bold leading-none',
      tone === 'danger'
        ? 'border border-destructive/40 text-destructive'
        : tone === 'success'
          ? 'border border-[#008a10]/35 text-[#008a10] dark:border-[#46d160]/35 dark:text-[#46d160]'
          : 'border border-border text-muted-foreground'
    )}
  >
    {children}
  </span>
);

const PostMetricPill = ({
  ariaLabel,
  icon,
  secondaryIcon,
  value,
}: {
  ariaLabel: string;
  icon: ReactNode;
  secondaryIcon?: ReactNode;
  value: string;
}) => (
  <span
    aria-label={ariaLabel}
    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground sm:h-8 sm:text-sm [&_svg]:size-4"
    role="img"
  >
    <span className="text-foreground">{icon}</span>
    <span className="tabular-nums">{value}</span>
    {secondaryIcon ? (
      <span className="text-foreground">{secondaryIcon}</span>
    ) : null}
  </span>
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
  const [showStickyPrep, setShowStickyPrep] = useState(false);
  const [stickyText, setStickyText] = useState(config.reminderText);
  const terminal = isTerminalStatus(incident.status);
  const reminderAlreadyPosted = incident.actions.some(
    (action) => action.type === 'cool_down'
  );
  const postLocked = isPostLocked(incident);
  const canToggleLock = postLocked
    ? config.actionControls.unlockPost
    : config.actionControls.lockPost;
  const permalink = incident.permalink;
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-base font-bold leading-5">Mod actions</h2>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <PanelLabel>QUICK ACTIONS</PanelLabel>
          <div className="flex flex-wrap items-center gap-2">
            <PlaybookButton
              disabled={
                Boolean(incident.claim) || Boolean(busyAction) || terminal
              }
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
                label={reminderAlreadyPosted ? 'Sticky posted' : 'Add sticky'}
                loading={busyAction === 'cool-down'}
                variant="secondary"
                onClick={() => {
                  setStickyText(config.reminderText);
                  setShowStickyPrep(true);
                }}
              />
            ) : null}
            {canToggleLock ? (
              <PlaybookButton
                disabled={Boolean(busyAction) || terminal}
                icon={<RedditLockIcon data-icon="inline-start" />}
                label={postLocked ? 'Unlock' : 'Lock'}
                loading={busyAction === (postLocked ? 'post:unlock' : 'lock')}
                variant={postLocked ? 'outline' : 'destructive'}
                onClick={() =>
                  postLocked
                    ? onAction(
                        'post:unlock',
                        `/api/incidents/${incident.postId}/post-action`,
                        { action: 'unlock' }
                      )
                    : onAction(
                        'lock',
                        `/api/incidents/${incident.postId}/lock`
                      )
                }
              />
            ) : null}
          </div>
          {showStickyPrep ? (
            <ActionPrepPanel
              busy={busyAction === 'cool-down'}
              disabled={stickyText.trim().length === 0}
              primaryIcon={<RedditPinIcon data-icon="inline-start" />}
              primaryLabel="Post sticky"
              title="Add sticky comment"
              onCancel={() => setShowStickyPrep(false)}
              onSubmit={() => {
                void onAction(
                  'cool-down',
                  `/api/incidents/${incident.postId}/cool-down`,
                  { reminderText: stickyText }
                ).then((updatedIncident) => {
                  if (updatedIncident) setShowStickyPrep(false);
                });
              }}
            >
              <ActionTextArea
                id="fw-sticky-reminder"
                label="Comment text"
                rows={4}
                value={stickyText}
                onChange={setStickyText}
              />
            </ActionPrepPanel>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <PanelLabel>MOD NOTES</PanelLabel>
          <div className="flex flex-wrap items-center gap-2">
            <PlaybookButton
              disabled={
                Boolean(busyAction) || !config.actionControls.handoffNotes
              }
              icon={<RedditShieldIcon data-icon="inline-start" />}
              label="Save handoff"
              loading={busyAction === 'escalate'}
              variant="secondary"
              onClick={() =>
                onAction(
                  'escalate',
                  `/api/incidents/${incident.postId}/escalate`
                )
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
                terminal
                  ? 'Handled'
                  : unresolvedCount > 0
                    ? 'Review comments'
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
      </div>
    </section>
  );
};

export const NativePostControlsCard = ({
  busyAction,
  config,
  incident,
  postFlairOptions,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  postFlairOptions: PostFlairOption[];
  onAction: ActionRunner;
}) => {
  const [activePrep, setActivePrep] = useState<NativePostAction | undefined>();
  const [reason, setReason] = useState('Rule-breaking post');
  const [flairText, setFlairText] = useState('Needs mod review');
  const [flairTemplateId, setFlairTemplateId] = useState('');
  const [crowdControlLevel, setCrowdControlLevel] =
    useState<CrowdControlLevel>('MEDIUM');
  const controls = config.actionControls;
  const disabled = Boolean(busyAction);
  const postState = incident.postState;
  const postApproved = Boolean(
    postState?.approved && !postState.removed && !postState.spam
  );
  const postRemoved = Boolean(postState?.removed || postState?.spam);
  const postSpam = Boolean(postState?.spam);
  const postNsfw = Boolean(postState?.nsfw);
  const postSpoiler = Boolean(postState?.spoiler);
  const postIgnoringReports = Boolean(postState?.ignoringReports);
  const nsfwAction: NativePostAction = postNsfw
    ? 'unmark-nsfw'
    : 'mark-nsfw';
  const spoilerAction: NativePostAction = postSpoiler
    ? 'unmark-spoiler'
    : 'mark-spoiler';
  const reportsAction: NativePostAction = postIgnoringReports
    ? 'unignore-reports'
    : 'ignore-reports';
  const hasPrimaryActions =
    controls.approvePosts ||
    controls.removePosts ||
    controls.markPostSpam;
  const hasAdvancedActions =
    controls.markPostNsfw ||
    controls.markPostSpoiler ||
    controls.ignoreReports ||
    controls.setPostFlair ||
    controls.crowdControl;
  const runPostAction = (
    action: NativePostAction,
    body: Record<string, unknown> = {}
  ) => {
    void onAction(
      `post:${action}`,
      `/api/incidents/${incident.postId}/post-action`,
      {
        action,
        reason,
        ...body,
      }
    ).then((updatedIncident) => {
      if (updatedIncident) setActivePrep(undefined);
    });
  };
  const selectFlairTemplate = (value: string) => {
    setFlairTemplateId(value);
    const selected = postFlairOptions.find((option) => option.id === value);
    if (selected) setFlairText(selected.text);
  };
  const selectedFlair = postFlairOptions.find(
    (option) => option.id === flairTemplateId
  );

  if (!hasPrimaryActions && !hasAdvancedActions) return null;

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-3 sm:px-4">
        <h3 className="text-base font-bold leading-5">Post actions</h3>
      </div>
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        {hasPrimaryActions ? (
          <div>
            <div className="flex flex-wrap gap-2">
              {controls.approvePosts ? (
                <PlaybookButton
                  disabled={disabled || postApproved}
                  icon={<RedditApproveIcon data-icon="inline-start" />}
                  label={postApproved ? 'Approved' : 'Approve'}
                  loading={busyAction === 'post:approve'}
                  variant="secondary"
                  onClick={() => runPostAction('approve')}
                />
              ) : null}
              {controls.removePosts ? (
                <PlaybookButton
                  disabled={disabled || postRemoved}
                  icon={<RedditRemoveIcon data-icon="inline-start" />}
                  label={postRemoved ? 'Removed' : 'Remove'}
                  loading={busyAction === 'post:remove'}
                  variant="destructive"
                  onClick={() => setActivePrep('remove')}
                />
              ) : null}
              {controls.markPostSpam ? (
                <PlaybookButton
                  disabled={disabled || postSpam}
                  icon={<RedditSpamIcon data-icon="inline-start" />}
                  label={postSpam ? 'Spam' : 'Spam post'}
                  loading={busyAction === 'post:spam'}
                  variant="destructive"
                  onClick={() => setActivePrep('spam')}
                />
              ) : null}
            </div>
            {activePrep === 'remove' || activePrep === 'spam' ? (
              <ActionPrepPanel
                busy={busyAction === `post:${activePrep}`}
                primaryIcon={
                  activePrep === 'spam' ? (
                    <RedditSpamIcon data-icon="inline-start" />
                  ) : (
                    <RedditRemoveIcon data-icon="inline-start" />
                  )
                }
                primaryLabel={activePrep === 'spam' ? 'Spam post' : 'Remove'}
                title={activePrep === 'spam' ? 'Spam post' : 'Remove post'}
                variant="destructive"
                onCancel={() => setActivePrep(undefined)}
                onSubmit={() => runPostAction(activePrep)}
              >
                <ActionTextArea
                  id="fw-post-removal-reason"
                  label="Reason"
                  value={reason}
                  onChange={setReason}
                />
              </ActionPrepPanel>
            ) : null}
          </div>
        ) : null}

        {hasAdvancedActions ? (
          <DisclosurePanel title="More actions">
            <div className="flex flex-col gap-3">
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {controls.markPostNsfw ? (
                  <PlaybookButton
                    disabled={disabled}
                    icon={<RedditHideIcon data-icon="inline-start" />}
                    label={postNsfw ? 'Clear NSFW' : 'Mark NSFW'}
                    loading={busyAction === `post:${nsfwAction}`}
                    variant={postNsfw ? 'ghost' : 'outline'}
                    onClick={() => runPostAction(nsfwAction)}
                  />
                ) : null}
                {controls.markPostSpoiler ? (
                  <PlaybookButton
                    disabled={disabled}
                    icon={<RedditReportIcon data-icon="inline-start" />}
                    label={postSpoiler ? 'Clear spoiler' : 'Mark spoiler'}
                    loading={busyAction === `post:${spoilerAction}`}
                    variant={postSpoiler ? 'ghost' : 'outline'}
                    onClick={() => runPostAction(spoilerAction)}
                  />
                ) : null}
                {controls.ignoreReports ? (
                  <PlaybookButton
                    disabled={disabled}
                    icon={<RedditReportIcon data-icon="inline-start" />}
                    label={
                      postIgnoringReports
                        ? 'Unignore reports'
                        : 'Ignore reports'
                    }
                    loading={busyAction === `post:${reportsAction}`}
                    variant={postIgnoringReports ? 'ghost' : 'outline'}
                    onClick={() => runPostAction(reportsAction)}
                  />
                ) : null}
                {controls.setPostFlair ? (
                  <PlaybookButton
                    disabled={disabled}
                    icon={<RedditTagIcon data-icon="inline-start" />}
                    label="Set flair"
                    loading={busyAction === 'post:set-flair'}
                    variant="outline"
                    onClick={() => setActivePrep('set-flair')}
                  />
                ) : null}
                {controls.crowdControl ? (
                  <PlaybookButton
                    disabled={disabled}
                    icon={<RedditListIcon data-icon="inline-start" />}
                    label="Crowd Control"
                    loading={busyAction === 'post:crowd-control'}
                    variant="outline"
                    onClick={() => setActivePrep('crowd-control')}
                  />
                ) : null}
              </div>

              {activePrep === 'set-flair' ? (
                <ActionPrepPanel
                  busy={busyAction === 'post:set-flair'}
                  disabled={flairText.trim().length === 0 && !selectedFlair}
                  primaryIcon={<RedditTagIcon data-icon="inline-start" />}
                  primaryLabel="Set flair"
                  title="Set post flair"
                  variant="outline"
                  onCancel={() => setActivePrep(undefined)}
                  onSubmit={() =>
                    runPostAction('set-flair', {
                      flairTemplateId: selectedFlair?.id,
                      flairText,
                    })
                  }
                >
                  <ActionSelect
                    id="fw-post-flair-template"
                    label="Flair template"
                    value={flairTemplateId}
                    onChange={selectFlairTemplate}
                  >
                    <option value="">Custom flair text</option>
                    {postFlairOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.text}
                      </option>
                    ))}
                  </ActionSelect>
                  <ActionInput
                    id="fw-post-flair-text"
                    label="Flair text"
                    value={flairText}
                    onChange={setFlairText}
                  />
                </ActionPrepPanel>
              ) : null}

              {activePrep === 'crowd-control' ? (
                <ActionPrepPanel
                  busy={busyAction === 'post:crowd-control'}
                  primaryIcon={<RedditListIcon data-icon="inline-start" />}
                  primaryLabel="Apply"
                  title="Set Crowd Control"
                  variant="outline"
                  onCancel={() => setActivePrep(undefined)}
                  onSubmit={() =>
                    runPostAction('crowd-control', { crowdControlLevel })
                  }
                >
                  <ActionSelect
                    id="fw-crowd-control"
                    label="Crowd Control level"
                    value={crowdControlLevel}
                    onChange={(value) =>
                      setCrowdControlLevel(parseCrowdControlLevel(value))
                    }
                  >
                    {CROWD_CONTROL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </ActionSelect>
                </ActionPrepPanel>
              ) : null}
            </div>
          </DisclosurePanel>
        ) : null}
      </div>
    </section>
  );
};

export const ResponseCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Next</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      {incident.responseSuggestion.steps.map((step, index) => (
        <div
          key={step}
          className="flex gap-3 rounded-lg border bg-muted/60 p-3"
        >
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
        <CardTitle>Impact</CardTitle>
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
          <Badge variant="outline">
            Open {formatDuration(impact.timeOpenMinutes)}
          </Badge>
          <Badge variant="outline">Peak score {impact.peakAttention}/100</Badge>
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
      <CardTitle>Signals</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.reasons.length === 0 ? (
        <EmptyText>No signals.</EmptyText>
      ) : (
        <div className="flex flex-col gap-3">
          {incident.reasons.map((reason) => (
            <div key={reason.key} className="rounded-lg border p-3">
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

export const TrendCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Trend</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.trend.length === 0 ? (
        <EmptyText>No trend.</EmptyText>
      ) : (
        <div className="flex h-40 items-stretch gap-2 rounded-lg border bg-muted/60 p-3">
          {incident.trend.map((point) => (
            <div
              key={point.timestamp}
              className="flex min-w-0 flex-1 flex-col gap-2"
              title={`${formatTime(point.timestamp)} review score ${point.score}`}
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
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
      </CardHeader>
      <CardContent>
        {incident.involvedUsers.length === 0 ? (
          <EmptyText>No users.</EmptyText>
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
                          {pluralize(user.flagged, 'comment')} to review -{' '}
                          {pluralize(user.signals, 'recent event')} -{' '}
                          {pluralize(user.branchCount, 'branch', 'branches')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                        {formatTime(user.lastSeenAt)}
                      </span>
                    </div>
                    {strikeSummary && strikeSummary.strikeCount > 0 ? (
                      <div className="rounded-md bg-muted/60 p-2">
                        <p className="text-xs font-semibold leading-5">
                          {strikeSummary.strikeCount} Firewatch strike
                          {strikeSummary.strikeCount === 1 ? '' : 's'} in{' '}
                          {strikeSummary.recentWindowDays} days
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {strikeSummary.removedComments} removed comments -{' '}
                          {strikeSummary.suspiciousDomainHits} suspicious
                          domain hits
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
