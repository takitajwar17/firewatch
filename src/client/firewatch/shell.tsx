import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Flame, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Incident } from '../../shared/api';
import { PanelLabel, ScoreBadge } from './common';
import { formatStatus, formatTime, formatUsername, pluralize } from './format';
import type { Notice } from './types';

export const FirewatchShell = ({
  busyAction,
  children,
  incidents,
  notice,
  selectedPostId,
  subredditName,
  username,
  onCreateDemo,
  onRefresh,
  onSelectIncident,
}: {
  busyAction: string | undefined;
  children: ReactNode;
  incidents: Incident[];
  notice: Notice | undefined;
  selectedPostId: string | undefined;
  subredditName: string;
  username: string;
  onCreateDemo: () => void;
  onRefresh: () => void;
  onSelectIncident: (postId: string) => void;
}) => (
  <div className="h-dvh overflow-hidden bg-background font-sans text-foreground">
    {notice ? <NoticeToast notice={notice} /> : null}
    <div className="flex h-full w-full overflow-hidden">
      <CommandPanel
        incidents={incidents}
        selectedPostId={selectedPostId}
        subredditName={subredditName}
        username={username}
        onSelectIncident={onSelectIncident}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader
          busyAction={busyAction}
          incidentCount={incidents.length}
          onCreateDemo={onCreateDemo}
          onRefresh={onRefresh}
          subredditName={subredditName}
        />
        <main className="flex min-h-0 flex-1 justify-center overflow-y-auto overscroll-contain px-4 py-6 sm:px-8 lg:px-10">
          <div className="flex w-full max-w-7xl flex-col gap-4">
            <MobileIncidentStrip
              incidents={incidents}
              selectedPostId={selectedPostId}
              onSelectIncident={onSelectIncident}
            />
            {children}
          </div>
        </main>
      </div>
    </div>
  </div>
);

const CommandPanel = ({
  incidents,
  selectedPostId,
  subredditName,
  username,
  onSelectIncident,
}: {
  incidents: Incident[];
  selectedPostId: string | undefined;
  subredditName: string;
  username: string;
  onSelectIncident: (postId: string) => void;
}) => (
  <aside className="relative hidden h-full w-[360px] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-8 text-sidebar-foreground lg:flex">
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Flame />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-medium leading-tight">Firewatch</p>
          <p className="truncate text-sm leading-6 text-sidebar-foreground/65">
            r/{subredditName || 'subreddit'} mod queue
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <PanelLabel surface="sidebar">Posts to review</PanelLabel>
        {incidents.length === 0 ? (
          <p className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/35 p-3 text-sm leading-6 text-sidebar-foreground/70">
            No posts need mod review. Create a demo post or use the post menu
            to send a post here.
          </p>
        ) : (
          <ScrollArea className="min-h-0 flex-1 pr-3">
            <div className="flex flex-col gap-3">
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
      className="mt-5 border-t border-sidebar-border/65 pt-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sm font-medium text-sidebar-foreground">
          {initial}
        </div>
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium leading-5">
            {displayName}
          </span>
        </div>
      </div>
    </section>
  );
};

const WorkspaceHeader = ({
  busyAction,
  incidentCount,
  onCreateDemo,
  onRefresh,
  subredditName,
}: {
  busyAction: string | undefined;
  incidentCount: number;
  onCreateDemo: () => void;
  onRefresh: () => void;
  subredditName: string;
}) => (
  <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-4 sm:px-8 lg:px-10 lg:py-5">
    <div className="flex min-w-0 items-center gap-3 lg:hidden">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Flame />
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-medium">Firewatch</p>
        <p className="truncate text-xs leading-5 text-muted-foreground">
          r/{subredditName || 'subreddit'}
        </p>
      </div>
    </div>
    <div className="hidden min-w-0 lg:block">
      <p className="text-sm font-medium leading-5">Incident board</p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        r/{subredditName || 'subreddit'} - {pluralize(incidentCount, 'post')} in
        review
      </p>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <Button variant="ghost" onClick={onRefresh}>
        <RefreshCw data-icon="inline-start" />
        <span className="hidden sm:inline">Refresh</span>
        <span className="sr-only sm:hidden">Refresh</span>
      </Button>
      <Button
        disabled={busyAction === 'demo'}
        variant="outline"
        onClick={onCreateDemo}
      >
        <Sparkles data-icon="inline-start" />
        <span className="hidden sm:inline">
          {busyAction === 'demo' ? 'Creating' : 'Create demo'}
        </span>
        <span className="sr-only sm:hidden">
          {busyAction === 'demo' ? 'Creating demo post' : 'Create demo post'}
        </span>
      </Button>
    </div>
  </header>
);

const NoticeToast = ({ notice }: { notice: Notice }) => (
  <div
    aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
    className="pointer-events-none fixed right-4 bottom-4 z-50 sm:right-5 sm:bottom-5"
  >
    <div
      role={notice.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex h-[76px] w-[min(20rem,calc(100vw-2rem))] items-center gap-3 overflow-hidden rounded-lg border bg-background px-4 text-foreground shadow-lg shadow-black/10 ring-1 ring-black/5',
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
        <p className="truncate text-sm font-medium leading-5">
          {notice.type === 'error' ? 'Needs attention' : 'Saved'}
        </p>
        <p className="mt-0.5 truncate text-sm leading-5 text-muted-foreground">
          {notice.message}
        </p>
      </div>
    </div>
  </div>
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
        <PanelLabel>Posts to review</PanelLabel>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {pluralize(incidents.length, 'post')} tracked
        </p>
      </div>
      <Badge variant="outline">{incidents.length}</Badge>
    </div>
    {incidents.length ? (
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        <div className="flex w-max gap-3">
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
      'ui-feedback w-full rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
      surface === 'dark'
        ? 'border-sidebar-border/70 bg-sidebar-accent/35 hover:bg-sidebar-accent/55'
        : 'w-[280px] border-border bg-card hover:bg-muted/50',
      selected &&
        (surface === 'dark'
          ? 'border-sidebar-foreground/45 bg-sidebar-accent/70'
          : 'border-primary/30 bg-card')
    )}
    onClick={onSelect}
  >
    <div className="flex items-start justify-between gap-3">
      <p
        className={cn(
          'line-clamp-2 text-sm font-medium leading-5',
          surface === 'dark' ? 'text-sidebar-foreground' : 'text-foreground'
        )}
      >
        {incident.title}
      </p>
      <ScoreBadge incident={incident} />
    </div>
    <div
      className={cn(
        'mt-3 flex items-center justify-between gap-3 text-xs leading-5',
        surface === 'dark' ? 'text-sidebar-foreground/60' : 'text-muted-foreground'
      )}
    >
      <span>{formatStatus(incident.status)}</span>
      <span>{formatTime(incident.updatedAt)}</span>
    </div>
  </button>
);
