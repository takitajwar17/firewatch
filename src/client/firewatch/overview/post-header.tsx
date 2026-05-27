import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RatingStars } from '../common';
import {
  formatRatingLabel,
  formatRatingTitle,
  formatStatus,
  formatTime,
  formatUsername,
  pluralize,
  ratingStarsColorClass,
} from '../format';
import {
  RedditCommentIcon,
  RedditDownvoteIcon,
  RedditUpvoteIcon,
} from '../reddit-icons';
import { UsernameHistoryTrigger } from '../username-history';
import type { Incident } from '../../../shared/api';
import { firewatchRatingInfo } from '../../../shared/firewatch-rating.js';

const ratingPillClass =
  'inline-flex h-7 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground sm:h-8 sm:text-sm';

export const IncidentIntro = ({ incident }: { incident: Incident }) => {
  const postScore = incident.postScore;
  const postCommentCount = incident.postCommentCount;
  const demoCommentCount =
    incident.demo?.commentModel === 'sample_review_signals';

  return (
    <section className="overflow-hidden border-b border-border bg-background text-card-foreground">
      <div className="max-w-full py-3">
        <article className="min-w-0 max-w-full">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <img
              alt=""
              className="size-8 shrink-0 rounded-full"
              src="/avatar-default.webp"
            />
            {incident.postAuthor ? (
              <UsernameHistoryTrigger
                className="text-sm"
                incident={incident}
                username={incident.postAuthor}
              />
            ) : (
              <span className="font-semibold text-foreground">
                r/{incident.subredditName}
              </span>
            )}
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
              ariaLabel={
                postScore === undefined
                  ? 'Reddit post score unavailable'
                  : `Post score ${postScore}`
              }
              icon={<RedditUpvoteIcon />}
              secondaryIcon={<RedditDownvoteIcon />}
              value={postScore === undefined ? '—' : String(postScore)}
            />
            <PostMetricPill
              ariaLabel={
                postCommentCount === undefined
                  ? 'Reddit comment count unavailable'
                  : demoCommentCount
                    ? `${pluralize(postCommentCount, 'sample review comment')} in Firewatch`
                    : `${pluralize(postCommentCount, 'comment')} on Reddit`
              }
              icon={<RedditCommentIcon />}
              {...(demoCommentCount
                ? {
                    title:
                      'Demo comments are sample review signals inside Firewatch.',
                  }
                : {})}
              value={
                postCommentCount === undefined
                  ? '—'
                  : String(postCommentCount)
              }
            />
            <RatingPills score={incident.score} />
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
            {incident.safetyReview ? (
              <InlineState variant="workflow">Safety review</InlineState>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
};

const RatingPills = ({ score }: { score: number }) => {
  const rating = firewatchRatingInfo(score);
  if (rating.rating === 0) return null;

  const title = formatRatingTitle(score);

  return (
    <>
      <span className={ratingPillClass} title={title}>
        <RatingStars score={score} showValue={false} />
      </span>
      <span className={ratingPillClass} title={title}>
        {rating.rating}/5
      </span>
      <span
        className={cn(ratingPillClass, ratingStarsColorClass(rating.rating))}
        title={title}
      >
        {formatRatingLabel(score)}
      </span>
    </>
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
  title,
  value,
}: {
  ariaLabel: string;
  icon: ReactNode;
  secondaryIcon?: ReactNode;
  title?: string;
  value: string;
}) => (
  <span
    aria-label={ariaLabel}
    className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground sm:h-8 sm:text-sm [&_svg]:size-4"
    role="img"
    title={title}
  >
    <span className="text-foreground">{icon}</span>
    <span className="tabular-nums">{value}</span>
    {secondaryIcon ? (
      <span className="text-foreground">{secondaryIcon}</span>
    ) : null}
  </span>
);
