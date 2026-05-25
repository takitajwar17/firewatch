import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ActionInput,
  ActionPrepPanel,
  ActionSelect,
  ActionTextArea,
} from './action-prep';
import {
  EmptyText,
  PlaybookButton,
  RedditMenuItem,
  RedditOverflowMenu,
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
import { openRedditUrlInNewTab } from './navigation';
import {
  RedditApproveIcon,
  RedditCautionIcon,
  RedditCommentIcon,
  RedditCrowdControlIcon,
  RedditDownvoteIcon,
  RedditLinkIcon,
  RedditLockIcon,
  RedditNsfwIcon,
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
      <div className="max-w-full py-3">
        <article className="min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <img
              alt=""
              className="size-8 shrink-0 rounded-full"
              src="/avatar_default_2.png"
            />
            <span className="font-semibold text-foreground">{authorLabel}</span>
            <span aria-hidden="true" className="text-muted-foreground/70">
              ·
            </span>
            <span>{formatTime(incident.createdAt)}</span>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 max-w-full break-words text-xl font-semibold leading-tight text-foreground sm:text-2xl">
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
            <span className="inline-flex h-7 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground sm:h-8 sm:text-sm">
              Review score {incident.score}
            </span>
            <span className="px-1 text-xs font-semibold leading-6 text-muted-foreground">
              Updated {formatTime(incident.updatedAt)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <InlineState
              variant={
                incident.status === 'review' || incident.status === 'locked'
                  ? 'workflow'
                  : 'outline'
              }
            >
              Firewatch: {formatStatus(incident.status)}
            </InlineState>
            {incident.claim ? (
              <InlineState variant="outline">
                Claimed by {formatUsername(incident.claim.username)}
              </InlineState>
            ) : null}
            {incident.demo ? <InlineState>Demo</InlineState> : null}
          </div>
        </article>
      </div>
    </section>
  );
};

const InlineState = ({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'workflow';
}) => (
  <span
    className={cn(
      'inline-flex h-5 items-center rounded-full px-2 text-xs font-bold leading-none',
      variant === 'workflow'
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

type PostPrepKind = NativePostAction | 'sticky';

const PostStateBadges = ({ incident }: { incident: Incident }) => {
  const state = incident.postState;
  if (!state) return null;

  return (
    <>
      {state.flair ? <PostFlairChip state={state.flair} /> : null}
      {state.nsfw ? <PostLabelChip tone="danger">NSFW</PostLabelChip> : null}
      {state.spoiler ? <PostLabelChip>Spoiler</PostLabelChip> : null}
      {state.locked ? <PostLabelChip>Locked</PostLabelChip> : null}
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
  onReviewComments,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  onReviewComments: () => void;
  onAction: ActionRunner;
}) => {
  const terminal = isTerminalStatus(incident.status);
  const permalink = incident.permalink;
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;

  return (
    <section className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold leading-5">Mod actions</h2>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {permalink ? (
            <Button
              variant="secondary"
              onClick={() => openRedditUrlInNewTab(permalink)}
            >
              <RedditLinkIcon data-icon="inline-start" />
              Open on Reddit
            </Button>
          ) : null}
          {unresolvedCount > 0 ? (
            <Button variant="outline" onClick={onReviewComments}>
              <RedditCommentIcon data-icon="inline-start" />
              Review comments
            </Button>
          ) : null}
          <PlaybookButton
            disabled={Boolean(incident.claim) || Boolean(busyAction) || terminal}
            icon={<RedditUsersIcon data-icon="inline-start" />}
            label={incident.claim ? 'Claimed' : 'Claim'}
            loading={busyAction === 'claim'}
            onClick={() =>
              onAction('claim', `/api/incidents/${incident.postId}/claim`)
            }
          />
          <PlaybookButton
            disabled={Boolean(busyAction) || !config.actionControls.handoffNotes}
            icon={<RedditShieldIcon data-icon="inline-start" />}
            label="Save handoff note"
            loading={busyAction === 'escalate'}
            variant="secondary"
            onClick={() =>
              onAction(
                'escalate',
                `/api/incidents/${incident.postId}/escalate`
              )
            }
          />
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
        {unresolvedCount > 0 && !terminal ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {pluralize(unresolvedCount, 'comment')} still needs a decision.
          </p>
        ) : null}
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
  const [activePrep, setActivePrep] = useState<PostPrepKind | undefined>();
  const [reason, setReason] = useState('Rule-breaking post');
  const [stickyText, setStickyText] = useState(config.reminderText);
  const [flairText, setFlairText] = useState('Needs mod review');
  const [flairTemplateId, setFlairTemplateId] = useState('');
  const [crowdControlLevel, setCrowdControlLevel] =
    useState<CrowdControlLevel>('MEDIUM');
  const controls = config.actionControls;
  const disabled = Boolean(busyAction);
  const terminal = isTerminalStatus(incident.status);
  const postState = incident.postState;
  const postApproved = Boolean(
    postState?.approved && !postState.removed && !postState.spam
  );
  const postRemoved = Boolean(postState?.removed || postState?.spam);
  const postSpam = Boolean(postState?.spam);
  const postNsfw = Boolean(postState?.nsfw);
  const postSpoiler = Boolean(postState?.spoiler);
  const postIgnoringReports = Boolean(postState?.ignoringReports);
  const postLocked = isPostLocked(incident);
  const canToggleLock = postLocked ? controls.unlockPost : controls.lockPost;
  const reminderAlreadyPosted = incident.actions.some(
    (action) => action.type === 'cool_down'
  );
  const nsfwAction: NativePostAction = postNsfw ? 'unmark-nsfw' : 'mark-nsfw';
  const spoilerAction: NativePostAction = postSpoiler
    ? 'unmark-spoiler'
    : 'mark-spoiler';
  const reportsAction: NativePostAction = postIgnoringReports
    ? 'unignore-reports'
    : 'ignore-reports';
  const hasPrimaryActions =
    controls.approvePosts ||
    controls.removePosts ||
    controls.markPostSpam ||
    canToggleLock ||
    controls.setPostFlair;
  const hasAdvancedActions =
    controls.stickyReminder ||
    controls.markPostNsfw ||
    controls.markPostSpoiler ||
    controls.ignoreReports ||
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
  const toggleLock = () => {
    if (postLocked) {
      void onAction(
        'post:unlock',
        `/api/incidents/${incident.postId}/post-action`,
        { action: 'unlock' }
      );
      return;
    }

    void onAction('lock', `/api/incidents/${incident.postId}/lock`);
  };
  const postStickyComment = () => {
    void onAction('cool-down', `/api/incidents/${incident.postId}/cool-down`, {
      reminderText: stickyText,
    }).then((updatedIncident) => {
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
    <section className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-semibold leading-5">Post tools</h3>
      </div>
      <div className="flex flex-col gap-3 p-3">
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
              {canToggleLock ? (
                <PlaybookButton
                  disabled={disabled || terminal}
                  icon={<RedditLockIcon data-icon="inline-start" />}
                  label={postLocked ? 'Unlock' : 'Lock'}
                  loading={busyAction === (postLocked ? 'post:unlock' : 'lock')}
                  variant={postLocked ? 'outline' : 'secondary'}
                  onClick={toggleLock}
                />
              ) : null}
              {controls.setPostFlair ? (
                <PlaybookButton
                  disabled={disabled}
                  icon={<RedditTagIcon data-icon="inline-start" />}
                  label={postState?.flair?.text ? 'Change flair' : 'Set flair'}
                  loading={busyAction === 'post:set-flair'}
                  variant="secondary"
                  onClick={() => setActivePrep('set-flair')}
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
                  label="Removal reason"
                  value={reason}
                  onChange={setReason}
                />
              </ActionPrepPanel>
            ) : null}
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
          </div>
        ) : null}

        {hasAdvancedActions ? (
          <div className="flex justify-start">
            <RedditOverflowMenu label="More post actions">
              {controls.stickyReminder ? (
                <RedditMenuItem
                  disabled={disabled || terminal || reminderAlreadyPosted}
                  icon={<RedditPinIcon />}
                  label={
                    reminderAlreadyPosted
                      ? 'Sticky comment posted'
                      : 'Add sticky comment'
                  }
                  onSelect={() => {
                    setStickyText(config.reminderText);
                    setActivePrep('sticky');
                  }}
                />
              ) : null}
              {controls.markPostNsfw ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditNsfwIcon />}
                  label={postNsfw ? 'Remove NSFW tag' : 'Add NSFW tag'}
                  onSelect={() => runPostAction(nsfwAction)}
                />
              ) : null}
              {controls.markPostSpoiler ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditCautionIcon />}
                  label={postSpoiler ? 'Remove spoiler tag' : 'Add spoiler tag'}
                  onSelect={() => runPostAction(spoilerAction)}
                />
              ) : null}
              {controls.ignoreReports ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditReportIcon />}
                  label={
                    postIgnoringReports
                      ? 'Unignore reports'
                      : 'Ignore reports'
                  }
                  onSelect={() => runPostAction(reportsAction)}
                />
              ) : null}
              {controls.crowdControl ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditCrowdControlIcon />}
                  label="Adjust Crowd Control"
                  onSelect={() => setActivePrep('crowd-control')}
                />
              ) : null}
            </RedditOverflowMenu>
          </div>
        ) : null}
        {activePrep === 'sticky' ? (
          <ActionPrepPanel
            busy={busyAction === 'cool-down'}
            disabled={stickyText.trim().length === 0}
            primaryIcon={<RedditPinIcon data-icon="inline-start" />}
            primaryLabel="Post sticky"
            title="Add sticky comment"
            variant="outline"
            onCancel={() => setActivePrep(undefined)}
            onSubmit={postStickyComment}
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

        {activePrep === 'crowd-control' ? (
          <ActionPrepPanel
            busy={busyAction === 'post:crowd-control'}
            primaryIcon={<RedditCrowdControlIcon data-icon="inline-start" />}
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
    </section>
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
      label: 'Actions taken',
      value: String(impact.actionsTaken),
      detail: `${impact.approvals} approved, ${impact.removals} removed, ${impact.bans} banned`,
    },
  ];

  return (
    <Card className="h-full" size="sm">
      <CardHeader>
        <CardTitle>Review progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="rounded-md border bg-background">
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
              <span className="shrink-0 text-lg font-semibold leading-none tabular-nums">
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
        <ScoreHistoryBlock className="mt-auto" incident={incident} />
      </CardContent>
    </Card>
  );
};

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

const ScoreHistoryBlock = ({
  className,
  incident,
}: {
  className?: string;
  incident: Incident;
}) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <p className="text-sm font-semibold leading-5">Review score history</p>
    {incident.trend.length === 0 ? (
      <EmptyText>No score history yet.</EmptyText>
    ) : (
      <div className="flex h-28 items-stretch gap-2 rounded-md border bg-background p-3">
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
  </div>
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
