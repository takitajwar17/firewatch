import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Incident } from '../../shared/api';
import { PanelLabel, ScoreBadge } from './common';
import { formatStatus, formatTime, formatUsername, pluralize } from './format';
import {
  RedditApproveIcon,
  RedditListIcon,
  RedditQueueIcon,
  RedditRefreshIcon,
  RedditReportIcon,
  RedditSettingsIcon,
} from './reddit-icons';
import type { FirewatchView, Notice } from './types';

export const FirewatchShell = ({
  activeView,
  children,
  incidents,
  notice,
  selectedPostId,
  subredditName,
  username,
  onRefresh,
  onSelectIncident,
  onViewChange,
}: {
  activeView: FirewatchView;
  children: ReactNode;
  incidents: Incident[];
  notice: Notice | undefined;
  selectedPostId: string | undefined;
  subredditName: string;
  username: string;
  onRefresh: () => void;
  onSelectIncident: (postId: string) => void;
  onViewChange: (view: FirewatchView) => void;
}) => (
  <div className="h-dvh overflow-hidden bg-background font-sans text-foreground">
    {notice ? <NoticeToast notice={notice} /> : null}
    <div className="flex h-full w-full overflow-hidden">
      <CommandPanel
        activeView={activeView}
        incidents={incidents}
        selectedPostId={selectedPostId}
        subredditName={subredditName}
        username={username}
        onSelectIncident={onSelectIncident}
        onViewChange={onViewChange}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader
          activeView={activeView}
          onRefresh={onRefresh}
          onViewChange={onViewChange}
          subredditName={subredditName}
        />
        <main className="flex min-h-0 min-w-0 flex-1 justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-background px-2 py-0 sm:px-5 lg:px-6">
          <div className="flex min-w-0 w-full max-w-[1520px] flex-col gap-3 py-3 sm:gap-4 sm:py-4 lg:py-5">
            {activeView === 'queue' ? (
              <MobileIncidentStrip
                incidents={incidents}
                selectedPostId={selectedPostId}
                onSelectIncident={onSelectIncident}
              />
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  </div>
);

const CommandPanel = ({
  activeView,
  incidents,
  selectedPostId,
  subredditName,
  username,
  onSelectIncident,
  onViewChange,
}: {
  activeView: FirewatchView;
  incidents: Incident[];
  selectedPostId: string | undefined;
  subredditName: string;
  username: string;
  onSelectIncident: (postId: string) => void;
  onViewChange: (view: FirewatchView) => void;
}) => (
  <aside className="relative hidden h-full w-[292px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5">
      <button
        className="ui-feedback flex h-10 items-center gap-3 text-left text-sidebar-foreground transition-colors hover:text-sidebar-foreground/80 focus-visible:ring-2 focus-visible:ring-sidebar-ring/35 focus-visible:outline-none"
        type="button"
        onClick={() => onViewChange('queue')}
      >
        <SubredditAvatar />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-5">
            r/{subredditName || 'subreddit'}
          </p>
          <p className="truncate text-xs leading-4 text-sidebar-foreground/60">
            Mod tools
          </p>
        </div>
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <PanelLabel surface="sidebar">POSTS TO REVIEW</PanelLabel>
          <span className="text-xs font-semibold tabular-nums text-sidebar-foreground/60">
            {incidents.length}
          </span>
        </div>
        {incidents.length === 0 ? (
          <p className="rounded-lg border border-sidebar-border bg-transparent p-3 text-xs leading-5 text-sidebar-foreground/70">
            No posts need review.
          </p>
        ) : (
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="flex flex-col gap-1">
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
    <div className="flex flex-col gap-3 px-4 pb-4">
      <SidebarNavButton
        active={activeView === 'automations'}
        icon={<RedditListIcon />}
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
      'ui-feedback flex h-10 items-center justify-between gap-3 rounded-md border px-3 text-left text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/35 focus-visible:outline-none',
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
    <section
      aria-label="Current moderator"
      className="border-t border-sidebar-border pt-3"
    >
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

const WorkspaceHeader = ({
  activeView,
  onRefresh,
  onViewChange,
  subredditName,
}: {
  activeView: FirewatchView;
  onRefresh: () => void;
  onViewChange: (view: FirewatchView) => void;
  subredditName: string;
}) => {
  const isSettings = activeView === 'settings';
  const isAutomations = activeView === 'automations';
  const headerIcon = isSettings ? (
    <RedditSettingsIcon />
  ) : isAutomations ? (
    <RedditListIcon />
  ) : (
    <RedditQueueIcon />
  );
  const headerTitle = isSettings
    ? 'Settings'
    : isAutomations
      ? 'Automations'
      : 'Posts to review';
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== undefined) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    []
  );

  const handleRefresh = () => {
    if (refreshTimerRef.current !== undefined) {
      window.clearTimeout(refreshTimerRef.current);
    }
    setRefreshing(true);
    onRefresh();
    refreshTimerRef.current = window.setTimeout(() => {
      setRefreshing(false);
      refreshTimerRef.current = undefined;
    }, 700);
  };

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background px-3 py-2 sm:gap-4 sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-3 lg:hidden">
        <SubredditAvatar size="sm" />
        <div className="min-w-0">
          <p className="truncate text-base font-bold">Firewatch</p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            r/{subredditName || 'subreddit'}
          </p>
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground [&_svg]:size-5">
            {headerIcon}
          </span>
          <h1 className="text-xl font-bold leading-7 tracking-normal">
            {headerTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          className="lg:hidden"
          size="icon-sm"
          variant={isAutomations ? 'secondary' : 'ghost'}
          onClick={() => onViewChange(isAutomations ? 'queue' : 'automations')}
        >
          <RedditListIcon />
          <span className="sr-only">Automations</span>
        </Button>
        <Button
          className="lg:hidden"
          size="icon-sm"
          variant={isSettings ? 'secondary' : 'ghost'}
          onClick={() => onViewChange(isSettings ? 'queue' : 'settings')}
        >
          <RedditSettingsIcon />
          <span className="sr-only">Settings</span>
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={handleRefresh}>
          <RedditRefreshIcon
            className={refreshing ? 'animate-spin' : undefined}
          />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>
    </header>
  );
};

const NoticeToast = ({ notice }: { notice: Notice }) => (
  <div
    aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
    className="pointer-events-none fixed right-4 bottom-4 z-50 sm:right-5 sm:bottom-5"
  >
    <div
      role={notice.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex min-h-14 w-[min(22rem,calc(100vw-2rem))] items-center gap-3 overflow-hidden rounded-lg border bg-popover px-4 py-3 text-foreground shadow-lg shadow-black/30',
        'animate-in fade-in-0 slide-in-from-right-8 duration-200',
        notice.type === 'error' ? 'border-destructive/35' : 'border-border'
      )}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full',
          notice.type === 'error'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary'
        )}
      >
        {notice.type === 'error' ? (
          <RedditReportIcon className="size-3.5" />
        ) : (
          <RedditApproveIcon className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-semibold leading-5">
          {notice.type === 'error' ? 'Needs attention' : 'Done'}
        </p>
        <p className="mt-0.5 truncate text-sm leading-5 text-muted-foreground">
          {notice.message}
        </p>
      </div>
    </div>
  </div>
);

const SubredditAvatar = ({ size = 'default' }: { size?: 'default' | 'sm' }) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full border border-border bg-[#eef1f3] font-black leading-none text-[#0e1113]',
      size === 'sm' ? 'size-8 text-lg' : 'size-9 text-xl'
    )}
  >
    r/
  </span>
);

const MobileIncidentStrip = ({
  incidents,
  selectedPostId,
  onSelectIncident,
}: {
  incidents: Incident[];
  selectedPostId: string | undefined;
  onSelectIncident: (postId: string) => void;
}) => (
  <div className="lg:hidden">
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <PanelLabel>POSTS TO REVIEW</PanelLabel>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {pluralize(incidents.length, 'post')} tracked
        </p>
      </div>
      <Badge variant="outline">{incidents.length}</Badge>
    </div>
    {incidents.length ? (
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

const IncidentQueueItem = ({
  incident,
  onSelect,
  selected,
  surface,
}: {
  incident: Incident;
  onSelect: () => void;
  selected: boolean;
  surface: 'dark' | 'light';
}) => (
  <button
    type="button"
    aria-pressed={selected}
    className={cn(
      'ui-feedback w-full rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none',
      'content-visibility-list-item',
      surface === 'dark'
        ? 'border-transparent bg-transparent hover:bg-sidebar-accent'
        : 'w-[min(17.5rem,calc(100vw-1rem))] snap-start border-border bg-card hover:bg-accent',
      selected &&
        (surface === 'dark'
          ? 'border-sidebar-border bg-sidebar-accent'
          : 'border-border bg-accent')
    )}
    onClick={onSelect}
  >
    <div className="flex items-start justify-between gap-3">
      <p
        className={cn(
          'line-clamp-2 text-sm font-bold leading-5',
          surface === 'dark' ? 'text-sidebar-foreground' : 'text-foreground'
        )}
      >
        {incident.title}
      </p>
      <ScoreBadge incident={incident} />
    </div>
    <div
      className={cn(
        'mt-2 flex items-center justify-between gap-3 text-xs leading-5',
        surface === 'dark'
          ? 'text-sidebar-foreground/60'
          : 'text-muted-foreground'
      )}
    >
      <span>{formatStatus(incident.status)}</span>
      <span>{formatTime(incident.createdAt)}</span>
    </div>
  </button>
);
