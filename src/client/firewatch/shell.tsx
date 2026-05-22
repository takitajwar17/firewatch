import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Incident } from '../../shared/api';
import { PanelLabel, ScoreBadge } from './common';
import {
  formatStatus,
  formatTime,
  formatUsername,
  pluralize,
} from './format';
import {
  RedditQueueIcon,
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
  <div className="dark h-dvh overflow-hidden bg-background font-sans text-foreground">
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
          incidentCount={incidents.length}
          onRefresh={onRefresh}
          onViewChange={onViewChange}
          subredditName={subredditName}
        />
        <main className="flex min-h-0 flex-1 justify-center overflow-y-auto overscroll-contain bg-background px-3 py-0 sm:px-5 lg:px-6">
          <div className="flex w-full max-w-[1280px] flex-col gap-4 py-4">
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-5">
      <button
        className="flex h-10 items-center gap-3 rounded-sm px-2 text-left transition-colors hover:bg-sidebar-accent"
        type="button"
        onClick={() => onViewChange('queue')}
      >
        <SubredditAvatar />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5">
            r/{subredditName || 'subreddit'}
          </p>
        </div>
      </button>

      <ModToolsNav activeView={activeView} onViewChange={onViewChange} />

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <PanelLabel surface="sidebar">POSTS TO REVIEW</PanelLabel>
        {incidents.length === 0 ? (
          <p className="rounded-md border border-sidebar-border bg-transparent p-3 text-xs leading-5 text-sidebar-foreground/70">
            No posts need mod review. Open Settings for demo tools or use the
            post menu to send a post here.
          </p>
        ) : (
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="flex flex-col gap-2">
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
    <SidebarAccountCard username={username} />
  </aside>
);

const ModToolsNav = ({
  activeView,
  onViewChange,
}: {
  activeView: FirewatchView;
  onViewChange: (view: FirewatchView) => void;
}) => (
  <nav aria-label="Moderator tools" className="grid gap-1">
    <PanelLabel surface="sidebar">FIREWATCH</PanelLabel>
    <SidebarNavButton
      active={activeView === 'queue'}
      icon={<RedditQueueIcon />}
      label="Queues"
      onClick={() => onViewChange('queue')}
    />
    <SidebarNavButton
      active={activeView === 'settings'}
      icon={<RedditSettingsIcon />}
      label="Firewatch Settings"
      onClick={() => onViewChange('settings')}
    />
  </nav>
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
      'ui-feedback flex h-10 items-center justify-between gap-3 rounded-sm border px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring/35 focus-visible:outline-none',
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
      className="mt-4 border-t border-sidebar-border pt-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-foreground">
          {initial}
        </div>
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-semibold leading-5">
            {displayName}
          </span>
        </div>
      </div>
    </section>
  );
};

const WorkspaceHeader = ({
  activeView,
  incidentCount,
  onRefresh,
  onViewChange,
  subredditName,
}: {
  activeView: FirewatchView;
  incidentCount: number;
  onRefresh: () => void;
  onViewChange: (view: FirewatchView) => void;
  subredditName: string;
}) => {
  const isSettings = activeView === 'settings';

  return (
    <header className="flex min-h-[86px] items-end justify-between gap-4 border-b border-border bg-background px-4 pb-3 sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-3 lg:hidden">
        <SubredditAvatar />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">Firewatch</p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            r/{subredditName || 'subreddit'}
          </p>
        </div>
      </div>
      <div className="hidden min-w-0 lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground [&_svg]:size-5">
            {isSettings ? <RedditSettingsIcon /> : <RedditQueueIcon />}
          </span>
          <h1 className="text-3xl font-bold leading-none tracking-normal">
            {isSettings ? 'Firewatch settings' : 'Queue'}
          </h1>
        </div>
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          {isSettings
            ? `r/${subredditName || 'subreddit'} configuration`
            : `${pluralize(incidentCount, 'post')} in review`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline">{pluralize(incidentCount, 'post')}</Badge>
        <Button
          className="lg:hidden"
          variant={isSettings ? 'secondary' : 'ghost'}
          onClick={() => onViewChange(isSettings ? 'queue' : 'settings')}
        >
          <RedditSettingsIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Settings</span>
          <span className="sr-only sm:hidden">Settings</span>
        </Button>
        <Button variant="ghost" onClick={onRefresh}>
          <RefreshCw data-icon="inline-start" />
          <span className="hidden sm:inline">Refresh</span>
          <span className="sr-only sm:hidden">Refresh</span>
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
        'pointer-events-auto flex h-[76px] w-[min(20rem,calc(100vw-2rem))] items-center gap-3 overflow-hidden rounded-md border bg-card px-4 text-foreground shadow-lg shadow-black/10',
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
          <AlertTriangle className="size-3.5" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-semibold leading-5">
          {notice.type === 'error' ? 'Needs attention' : 'Saved'}
        </p>
        <p className="mt-0.5 truncate text-sm leading-5 text-muted-foreground">
          {notice.message}
        </p>
      </div>
    </div>
  </div>
);

const SubredditAvatar = () => (
  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef2f4] text-xl font-black leading-none text-[#0b0f10]">
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
      <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:-mx-5 sm:px-5">
        <div className="flex w-max gap-2">
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
      'ui-feedback w-full rounded-sm border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none',
      surface === 'dark'
        ? 'border-transparent bg-transparent hover:bg-sidebar-accent'
        : 'w-[280px] border-border bg-card hover:bg-accent',
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
        'mt-2 flex items-center justify-between gap-3 text-xs leading-5',
        surface === 'dark' ? 'text-sidebar-foreground/60' : 'text-muted-foreground'
      )}
    >
      <span>{formatStatus(incident.status)}</span>
      <span>{formatTime(incident.updatedAt)}</span>
    </div>
  </button>
);
