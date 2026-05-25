import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PanelLabel, ScoreBadge, Skeleton } from '../common';
import { formatStatus, formatTime, formatUsername, pluralize } from '../format';
import {
  RedditCommentIcon,
  RedditLockIcon,
  RedditRemoveIcon,
} from '../reddit-icons';
import type { Incident } from '../../../shared/api';

export const MobileIncidentStrip = ({
  incidents,
  loading,
  selectedPostId,
  onSelectIncident,
}: {
  incidents: Incident[];
  loading: boolean;
  selectedPostId: string | undefined;
  onSelectIncident: (postId: string) => void;
}) => (
  <div className="lg:hidden">
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <PanelLabel>POSTS TO REVIEW</PanelLabel>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {loading
            ? 'Loading posts'
            : `${pluralize(incidents.length, 'post')} waiting`}
        </p>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-9 rounded-full" />
      ) : (
        <Badge variant="outline">{incidents.length}</Badge>
      )}
    </div>
    {loading ? (
      <div className="no-scrollbar -mx-2 overflow-x-auto overscroll-x-contain px-2 pb-2 sm:-mx-5 sm:px-5">
        <div
          aria-busy="true"
          aria-label="Loading posts to review"
          className="flex w-max max-w-none snap-x snap-mandatory gap-2"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <IncidentQueueItemSkeleton key={index} surface="light" />
          ))}
        </div>
      </div>
    ) : incidents.length ? (
      <div className="no-scrollbar -mx-2 overflow-x-auto overscroll-x-contain px-2 pb-2 sm:-mx-5 sm:px-5">
        <div className="flex w-max max-w-none snap-x snap-mandatory gap-2">
          {incidents.map((incident) => (
            <IncidentQueueItem
              key={incident.postId}
              incident={incident}
              selected={selectedPostId === incident.postId}
              surface="light"
              onSelect={() => onSelectIncident(incident.postId)}
            />
          ))}
        </div>
      </div>
    ) : null}
  </div>
);

export const IncidentQueueItemSkeleton = ({
  surface,
}: {
  surface: 'dark' | 'light';
}) => (
  <div
    className={cn(
      'content-visibility-list-item border',
      surface === 'dark'
        ? 'border-x-0 border-t-0 border-sidebar-border bg-transparent px-2 py-2.5'
        : 'w-[min(18.5rem,calc(100vw-1rem))] snap-start rounded-md border-border bg-card p-3'
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton
          className={cn(
            'h-4 w-full',
            surface === 'dark' ? 'bg-sidebar-accent' : undefined
          )}
        />
      </div>
      <Skeleton
        className={cn(
          'h-7 w-10 rounded-full',
          surface === 'dark' ? 'bg-sidebar-accent' : undefined
        )}
      />
    </div>
    <div className="mt-2 flex items-center gap-2">
      <Skeleton
        className={cn(
          'h-3.5 w-24',
          surface === 'dark' ? 'bg-sidebar-accent' : undefined
        )}
      />
    </div>
  </div>
);

export const IncidentQueueItem = ({
  incident,
  onSelect,
  selected,
  surface,
}: {
  incident: Incident;
  onSelect: () => void;
  selected: boolean;
  surface: 'dark' | 'light';
}) => {
  const unresolvedComments = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;
  const postState = incident.postState;
  const stateLabel = postState?.spam
    ? 'Spam'
    : postState?.removed
      ? 'Removed'
      : postState?.approved
        ? 'Approved'
        : postState?.locked
          ? 'Locked'
          : formatStatus(incident.status);
  const firstReason = incident.reasons[0]?.label;
  const secondReason = incident.reasons[1]?.label;
  const signalParts = [
    unresolvedComments > 0
      ? pluralize(unresolvedComments, 'comment')
      : undefined,
    incident.stats.reportSignals > 0
      ? pluralize(incident.stats.reportSignals, 'report')
      : undefined,
    incident.stats.suspiciousLinkHits > 0
      ? pluralize(incident.stats.suspiciousLinkHits, 'watched link')
      : undefined,
    incident.stats.keywordHits > 0
      ? pluralize(incident.stats.keywordHits, 'keyword hit')
      : undefined,
  ].filter(Boolean);

  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'ui-feedback relative w-full border text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none',
        'content-visibility-list-item',
        surface === 'dark'
          ? 'border-x-0 border-t-0 border-sidebar-border bg-transparent px-2 py-2.5 hover:bg-sidebar-accent'
          : 'w-[min(18.5rem,calc(100vw-1rem))] snap-start rounded-md border-border bg-card p-3 hover:bg-accent',
        selected &&
          (surface === 'dark'
            ? 'bg-sidebar-accent before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
            : 'border-border bg-accent')
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            'line-clamp-2 text-sm font-semibold leading-5',
            surface === 'dark' ? 'text-sidebar-foreground' : 'text-foreground'
          )}
        >
          {incident.title}
        </p>
        <ScoreBadge incident={incident} />
      </div>
      <div
        className={cn(
          'mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5',
          surface === 'dark'
            ? 'text-sidebar-foreground/60'
            : 'text-muted-foreground'
        )}
      >
        <span className="inline-flex items-center gap-1">
          {postState?.removed || postState?.spam ? (
            <RedditRemoveIcon className="size-3.5" />
          ) : postState?.locked ? (
            <RedditLockIcon className="size-3.5" />
          ) : (
            <RedditCommentIcon className="size-3.5" />
          )}
          {stateLabel}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatTime(incident.updatedAt)}</span>
      </div>
      {surface === 'light' && signalParts.length > 0 ? (
        <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
          {signalParts.join(' · ')}
        </p>
      ) : null}
      {surface === 'light' && firstReason ? (
        <p className="mt-1 line-clamp-1 text-xs font-semibold leading-5 text-foreground/80">
          {secondReason ? `${firstReason} · ${secondReason}` : firstReason}
        </p>
      ) : null}
      {surface === 'light' && incident.claim ? (
        <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
          Claimed by {formatUsername(incident.claim.username)}
        </p>
      ) : null}
    </button>
  );
};
