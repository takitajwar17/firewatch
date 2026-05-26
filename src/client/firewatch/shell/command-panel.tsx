import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PanelLabel, Skeleton, SubredditAvatar } from '../common';
import { formatUsername } from '../format';
import { RedditAutomationIcon, RedditSettingsIcon } from '../reddit-icons';
import type { FirewatchView, QueueFilter, QueueFilterCounts } from '../types';
import type { Incident } from '../../../shared/api';
import {
  IncidentQueueItem,
  IncidentQueueItemSkeleton,
  QueueFilterTabs,
} from './incident-queue-item';

export const CommandPanel = ({
  activeView,
  incidents,
  loading,
  queueFilter,
  queueFilterCounts,
  selectedPostId,
  subredditName,
  username,
  onQueueFilterChange,
  onSelectIncident,
  onViewChange,
}: {
  activeView: FirewatchView;
  incidents: Incident[];
  loading: boolean;
  queueFilter: QueueFilter;
  queueFilterCounts: QueueFilterCounts;
  selectedPostId: string | undefined;
  subredditName: string;
  username: string;
  onQueueFilterChange: (filter: QueueFilter) => void;
  onSelectIncident: (postId: string) => void;
  onViewChange: (view: FirewatchView) => void;
}) => (
  <aside className="relative hidden h-full w-[272px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
    <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
      <button
        className="ui-feedback flex h-10 items-center gap-2.5 text-left text-sidebar-foreground transition-colors hover:text-sidebar-foreground/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring/35 focus-visible:outline-none"
        type="button"
        onClick={() => onViewChange('queue')}
      >
        <SubredditAvatar />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">
            r/{subredditName || 'subreddit'}
          </p>
          <p className="truncate text-xs leading-4 text-sidebar-foreground/60">
            Mod tools
          </p>
        </div>
      </button>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <div className="min-w-0">
            <PanelLabel surface="sidebar">POSTS TO REVIEW</PanelLabel>
          </div>
          {loading ? (
            <Skeleton className="h-4 w-5 bg-sidebar-accent" />
          ) : (
            <span className="text-xs font-semibold tabular-nums text-sidebar-foreground/60">
              {queueFilterCounts.all}
            </span>
          )}
        </div>
        <QueueFilterTabs
          counts={queueFilterCounts}
          disabled={loading}
          surface="dark"
          value={queueFilter}
          onChange={onQueueFilterChange}
        />
        {loading ? (
          <ScrollArea className="min-h-0 flex-1">
            <div
              aria-busy="true"
              aria-label="Loading posts to review"
              className="flex flex-col border-t border-sidebar-border"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <IncidentQueueItemSkeleton key={index} surface="dark" />
              ))}
            </div>
          </ScrollArea>
        ) : incidents.length === 0 ? (
          <p className="border-t border-sidebar-border px-1 py-3 text-xs leading-5 text-sidebar-foreground/70">
            No posts need review right now.
          </p>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col border-t border-sidebar-border">
              {incidents.map((incident) => (
                <IncidentQueueItem
                  key={incident.postId}
                  incident={incident}
                  selected={selectedPostId === incident.postId}
                  surface="dark"
                  onSelect={() => onSelectIncident(incident.postId)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
    <div className="flex flex-col gap-1 border-t border-sidebar-border px-3 py-3">
      <SidebarNavButton
        active={activeView === 'automations'}
        icon={<RedditAutomationIcon />}
        label="Automations"
        onClick={() => onViewChange('automations')}
      />
      <SidebarNavButton
        active={activeView === 'settings'}
        icon={<RedditSettingsIcon />}
        label="Settings"
        onClick={() => onViewChange('settings')}
      />
      <SidebarAccountCard username={username} />
    </div>
  </aside>
);

const SidebarNavButton = ({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={cn(
      'ui-feedback flex h-9 items-center justify-between gap-3 rounded-full border px-3 text-left text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/35 focus-visible:outline-none',
      active
        ? 'border-transparent bg-sidebar-accent text-sidebar-foreground'
        : 'border-transparent bg-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'
    )}
    onClick={onClick}
  >
    <span className="flex min-w-0 items-center gap-2">
      <span className="[&_svg]:size-4">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  </button>
);

const SidebarAccountCard = ({ username }: { username: string }) => {
  const displayName =
    username === 'moderator' || username === 'anonymous'
      ? 'Moderator'
      : formatUsername(username);
  const initial =
    displayName === 'unknown user' || displayName === 'Moderator'
      ? 'M'
      : displayName.replace(/^u\//, '').trim().charAt(0).toUpperCase() || 'M';

  return (
    <section aria-label="Current moderator" className="mt-2 pt-2">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-foreground">
          {initial}
        </div>
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-semibold leading-5">
            {displayName}
          </span>
          <span className="truncate text-xs leading-4 text-sidebar-foreground/60">
            Moderator
          </span>
        </div>
      </div>
    </section>
  );
};
