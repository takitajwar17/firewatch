import './index.css';

import { navigateTo } from '@devvit/web/client';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Flame,
  Gauge,
  Lock,
  RadioTower,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  ConfigResponse,
  DashboardInitResponse,
  ErrorResponse,
  FirewatchConfig,
  Incident,
  IncidentLevel,
  IncidentSignal,
} from '../shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardInitResponse }
  | { status: 'error'; message: string };

type ActionRunner = (
  action: string,
  endpoint: string,
  body?: Record<string, unknown>
) => Promise<Incident | undefined>;

type Notice = {
  type: 'success' | 'error';
  message: string;
};

const statusBadgeVariant: Record<
  string,
  'secondary' | 'outline' | 'destructive'
> = {
  open: 'outline',
  watching: 'outline',
  review: 'destructive',
  claimed: 'outline',
  cooldown: 'outline',
  locked: 'destructive',
  handled: 'secondary',
  resolved: 'secondary',
};

const levelBadgeVariant: Record<
  IncidentLevel,
  'secondary' | 'outline' | 'destructive'
> = {
  watch: 'secondary',
  heat: 'outline',
  fire: 'destructive',
  wildfire: 'destructive',
};

const emptyConfig: FirewatchConfig = {
  keywords: [],
  suspiciousDomains: [],
  heatThreshold: 35,
  fireThreshold: 65,
  wildfireThreshold: 85,
};

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

const formatDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));

const formatStatus = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Open',
    watching: 'Watching',
    review: 'Review',
    claimed: 'Taken',
    cooldown: 'Reminder posted',
    locked: 'Locked',
    handled: 'Handled',
    resolved: 'Resolved',
    active: 'Open',
    monitoring: 'Watching',
  };

  return labels[status] ?? status;
};

const formatUsername = (username: string | undefined) => {
  const normalized = username?.trim().replace(/^u\//i, '');
  if (!normalized || normalized.startsWith('t2_') || normalized === 'unknown user') {
    return 'unknown user';
  }
  return `u/${normalized}`;
};

const isHandledStatus = (status: string) =>
  status === 'handled' || status === 'resolved';

const isTerminalStatus = (status: string) =>
  isHandledStatus(status) || status === 'resolved';

const isFirewatchNotice = (signal: IncidentSignal) =>
  signal.source === 'firewatch_notice' ||
  signal.metadata?.firewatchNotice === true ||
  signal.body?.startsWith('Mod note: Please keep this discussion civil');

const formatSignalType = (signal: IncidentSignal) => {
  if (isFirewatchNotice(signal)) return 'Mod notice posted';

  const labels: Record<string, string> = {
    post_create: 'New post',
    post_update: 'Post edit',
    comment_create: 'New comment',
    comment_report: 'Comment report',
    post_report: 'Post report',
    manual_escalation: 'Sent by mod',
    mod_action: 'Mod action',
    automod_filter: 'AutoModerator',
  };

  return labels[signal.type] ?? signal.type.replaceAll('_', ' ');
};

const formatSignalDetail = (signal: IncidentSignal) => {
  if (isFirewatchNotice(signal)) {
    return 'Firewatch posted a distinguished sticky reminder.';
  }

  return signal.reason ?? signal.body ?? 'No details from Reddit';
};

const clampScore = (score: number) => Math.max(0, Math.min(100, score));

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const readErrorMessage = async (res: Response) => {
  try {
    const payload = (await res.json()) as Partial<ErrorResponse>;
    if (payload.message) return payload.message;
  } catch {
    // Fall back to status text below.
  }

  return res.statusText || `HTTP ${res.status}`;
};

const actionLabel = (action: string) => {
  if (action.startsWith('ban:')) return 'Ban user';
  if (action.startsWith('t1_')) return 'Remove comment';

  const labels: Record<string, string> = {
    claim: 'Take post',
    'cool-down': 'Sticky reminder',
    cleanup: 'Remove comments',
    lock: 'Lock post',
    escalate: 'Save handoff note',
    resolve: 'Mark handled',
    demo: 'Create demo post',
    config: 'Save settings',
  };

  return (
    labels[action] ??
    action
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
};

const actionSuccessMessage = (action: string) => {
  if (action.startsWith('ban:')) {
    return 'User banned after their review comments were removed.';
  }
  if (action.startsWith('t1_')) return 'Comment handled.';

  const messages: Record<string, string> = {
    claim: 'Post taken.',
    'cool-down': 'Sticky reminder posted.',
    cleanup: 'Selected comments handled.',
    lock: 'Post locked.',
    escalate: 'Handoff note saved in Mod notes.',
    resolve: 'Post marked handled. Final note saved.',
    demo: 'Demo post created.',
    config: 'Settings saved.',
  };

  return messages[action] ?? `${actionLabel(action)} done.`;
};

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const copyTextToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
};

export const App = () => {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();

  const applyDashboard = useCallback((data: DashboardInitResponse) => {
    setLoadState({ status: 'ready', data });
    setSelectedPostId(
      (current) => current ?? data.selectedPostId ?? data.incidents[0]?.postId
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/init');
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data = (await res.json()) as DashboardInitResponse;
      applyDashboard(data);
    } catch (error) {
      setLoadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load dashboard',
      });
    }
  }, [applyDashboard]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(await readErrorMessage(res));

        const data = (await res.json()) as DashboardInitResponse;
        if (!cancelled) applyDashboard(data);
      } catch (error) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'Failed to load dashboard',
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyDashboard]);

  useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(
      () =>
        setNotice((current) => (current === notice ? undefined : current)),
      notice.type === 'success' ? 2800 : 6000
    );

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const data =
    loadState.status === 'ready'
      ? loadState.data
      : {
          type: 'dashboard' as const,
          username: 'moderator',
          subredditName: '',
          incidents: [],
          config: emptyConfig,
        };

  const selectedIncident = useMemo(
    () =>
      data.incidents.find((incident) => incident.postId === selectedPostId) ??
      data.incidents[0],
    [data.incidents, selectedPostId]
  );

  const updateIncident = (updatedIncident: Incident) => {
    setLoadState((current) => {
      if (current.status !== 'ready') return current;

      const currentHasIncident = current.data.incidents.some(
        (incident) => incident.postId === updatedIncident.postId
      );
      const incidents = currentHasIncident
        ? current.data.incidents.map((incident) =>
            incident.postId === updatedIncident.postId ? updatedIncident : incident
          )
        : [updatedIncident, ...current.data.incidents];

      return {
        status: 'ready',
        data: {
          ...current.data,
          incidents: incidents.sort(
            (a, b) => b.score - a.score || b.updatedAt - a.updatedAt
          ),
        },
      };
    });
    setSelectedPostId(updatedIncident.postId);
  };

  const runAction: ActionRunner = async (action, endpoint, body) => {
    setBusyAction(action);
    setNotice(undefined);
    try {
      const requestInit: RequestInit = {
        method: 'POST',
      };
      if (body) {
        requestInit.headers = { 'content-type': 'application/json' };
        requestInit.body = JSON.stringify(body);
      }

      const res = await fetch(endpoint, requestInit);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const payload = (await res.json()) as { incident: Incident };
      updateIncident(payload.incident);
      setNotice({ type: 'success', message: actionSuccessMessage(action) });
      return payload.incident;
    } catch (error) {
      console.error(`Firewatch action failed: ${action}`, error);
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `${actionLabel(action)} failed: ${error.message}`
            : `${actionLabel(action)} failed.`,
      });
      return undefined;
    } finally {
      setBusyAction(undefined);
    }
  };

  const createDemoIncident = () => runAction('demo', '/api/demo/incident');

  const saveDashboardConfig = async (values: {
    keywords: string;
    suspiciousDomains: string;
    heatThreshold: number;
    fireThreshold: number;
    wildfireThreshold: number;
  }) => {
    setBusyAction('config');
    setNotice(undefined);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const payload = (await res.json()) as ConfigResponse;
      setLoadState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              data: {
                ...current.data,
                config: payload.config,
              },
            }
          : current
      );
      setNotice({ type: 'success', message: 'Settings saved.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not save settings: ${error.message}`
            : 'Could not save settings.',
      });
    } finally {
      setBusyAction(undefined);
    }
  };

  if (loadState.status === 'error') {
    return (
      <FirewatchShell
        busyAction={busyAction}
        incidents={data.incidents}
        notice={undefined}
        selectedPostId={selectedIncident?.postId}
        subredditName={data.subredditName}
        username={data.username}
        onCreateDemo={createDemoIncident}
        onRefresh={refresh}
        onSelectIncident={setSelectedPostId}
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle />
            <AlertTitle>Could not load your mod view</AlertTitle>
            <AlertDescription>{loadState.message}</AlertDescription>
            <Button className="mt-4 w-fit" variant="outline" onClick={refresh}>
              <RefreshCw data-icon="inline-start" />
              Retry
            </Button>
          </Alert>
        </div>
      </FirewatchShell>
    );
  }

  return (
    <FirewatchShell
      busyAction={busyAction}
      incidents={data.incidents}
      notice={notice}
      selectedPostId={selectedIncident?.postId}
      subredditName={data.subredditName}
      username={data.username}
      onCreateDemo={createDemoIncident}
      onRefresh={refresh}
      onSelectIncident={setSelectedPostId}
    >
      {loadState.status === 'loading' ? (
        <LoadingBoard />
      ) : selectedIncident ? (
        <IncidentDetail
          key={selectedIncident.postId}
          busyAction={busyAction}
          config={data.config}
          incident={selectedIncident}
          onAction={runAction}
          onSaveConfig={saveDashboardConfig}
        />
      ) : (
        <EmptyBoard
          busy={busyAction === 'demo'}
          onCreateDemo={createDemoIncident}
        />
      )}
    </FirewatchShell>
  );
};

const FirewatchShell = ({
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

const PanelLabel = ({
  children,
  surface = 'main',
}: {
  children: ReactNode;
  surface?: 'main' | 'sidebar';
}) => (
  <p
    className={cn(
      'text-[11px] font-medium uppercase leading-none',
      surface === 'sidebar'
        ? 'text-sidebar-foreground/55'
        : 'text-muted-foreground'
    )}
  >
    {children}
  </p>
);

const SectionHeader = ({
  className,
  description,
  title,
}: {
  className?: string;
  description: string;
  title: string;
}) => (
  <div className={cn('flex min-w-0 flex-col gap-1', className)}>
    <h2 className="text-base font-medium leading-6 text-foreground">{title}</h2>
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
      {description}
    </p>
  </div>
);

const LoadingBoard = () => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
    <div className="grid gap-3 md:grid-cols-4">
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Skeleton className="h-[520px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
    </div>
  </div>
);

const ScoreBadge = ({ incident }: { incident: Incident }) => (
  <Badge
    aria-label={`Current attention ${incident.score} out of 100`}
    className="shrink-0 font-medium tabular-nums"
    title={`Current attention ${incident.score}/100`}
    variant={levelBadgeVariant[incident.level]}
  >
    {incident.score}
  </Badge>
);

const IncidentDetail = ({
  incident,
  busyAction,
  config,
  onAction,
  onSaveConfig,
}: {
  incident: Incident;
  busyAction: string | undefined;
  config: FirewatchConfig;
  onAction: ActionRunner;
  onSaveConfig: (values: {
    keywords: string;
    suspiciousDomains: string;
    heatThreshold: number;
    fireThreshold: number;
    wildfireThreshold: number;
  }) => Promise<void>;
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [cleanupReason, setCleanupReason] = useState('Rule-breaking comment');
  const unresolvedComments = incident.flaggedComments.filter(
    (comment) => !comment.removed
  );

  const runModAction: ActionRunner = async (action, endpoint, body) => {
    const updatedIncident = await onAction(action, endpoint, body);
    if (!updatedIncident) return undefined;

    if (action === 'escalate' || action === 'resolve') {
      setActiveTab('reports');
    }

    if (action === 'cleanup' || action.startsWith('t1_') || action.startsWith('ban:')) {
      setActiveTab('comments');
    }

    return updatedIncident;
  };

  return (
    <div className="flex flex-col gap-5">
      <IncidentIntro incident={incident} />

      <SectionHeader
        title="Current review"
        description="Open review work separated from historical activity."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description="Report signals attached to the post or comments."
          icon={<ShieldAlert />}
          label="Reports filed"
          value={String(incident.stats.reportSignals)}
        />
        <MetricCard
          description="Unremoved comments that still need a mod decision."
          icon={<ClipboardList />}
          label="Comments to review"
          value={String(unresolvedComments.length)}
        />
        <MetricCard
          description="Authors attached to comments waiting for review."
          icon={<Users />}
          label="Users in review"
          value={String(incident.stats.uniqueParticipants)}
        />
        <MetricCard
          description="Dense reply chains that can escalate quickly."
          icon={<Gauge />}
          label="Reply clusters"
          value={String(incident.stats.branchPileOns)}
        />
      </div>

      <IncidentHero
        busyAction={busyAction}
        incident={incident}
        onAction={runModAction}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList aria-label="Incident sections" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Post</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="signals">Activity</TabsTrigger>
          <TabsTrigger value="reports">Mod notes</TabsTrigger>
          <TabsTrigger value="settings">Filters</TabsTrigger>
        </TabsList>

        <TabsContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" value="overview">
          <SectionHeader
            className="xl:col-span-full"
            title="Post review"
            description="Queue reasons, trend, suggested action, and involved users."
          />
          <div className="flex flex-col gap-4">
            <RiskReasonsCard incident={incident} />
            <TrendCard incident={incident} />
          </div>
          <div className="flex flex-col gap-4">
            <ResponseCard incident={incident} />
            <ParticipantsCard incident={incident} />
          </div>
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" value="comments">
          <SectionHeader
            className="xl:col-span-full"
            title="Comment review"
            description="Unremoved comments, removal reason, and actioned history."
          />
          <FlaggedCommentsCard
            busyAction={busyAction}
            cleanupReason={cleanupReason}
            incident={incident}
            onAction={runModAction}
            onCleanupReasonChange={setCleanupReason}
          />
          <RepeatedPhrasesCard incident={incident} />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-2" value="signals">
          <SectionHeader
            className="xl:col-span-full"
            title="Activity"
            description="Reddit signals and mod actions in chronological order."
          />
          <LatestSignalsCard incident={incident} />
          <ActionLogCard incident={incident} />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-2" value="reports">
          <SectionHeader
            className="xl:col-span-full"
            title="Mod notes"
            description="Handoff and final notes for the mod team."
          />
          <SummariesCard incident={incident} />
          <ActionLogCard incident={incident} compact />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" value="settings">
          <SectionHeader
            className="xl:col-span-full"
            title="Filters"
            description="Watched words, domains, and attention thresholds."
          />
          <SettingsCard
            key={`${config.keywords.join('|')}:${config.suspiciousDomains.join('|')}:${config.heatThreshold}:${config.fireThreshold}:${config.wildfireThreshold}`}
            busy={busyAction === 'config'}
            config={config}
            onSave={onSaveConfig}
          />
          <FilterHelpCard config={config} incident={incident} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const IncidentIntro = ({ incident }: { incident: Incident }) => (
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

const IncidentHero = ({
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
            {incident.permalink ? (
              <Button variant="ghost" onClick={() => navigateTo(incident.permalink!)}>
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

const PlaybookButton = ({
  disabled,
  icon,
  label,
  loading,
  onClick,
  variant = 'default',
}: {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
}) => (
  <Button
    className="h-10 justify-center text-sm font-medium"
    disabled={disabled}
    variant={variant}
    onClick={onClick}
  >
    {loading ? <RefreshCw className="animate-spin" data-icon="inline-start" /> : icon}
    {loading ? 'Working' : label}
  </Button>
);

const MetricCard = ({
  description,
  icon,
  label,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <Card size="sm">
    <CardHeader className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <CardDescription>{label}</CardDescription>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <CardTitle className="text-2xl font-medium tabular-nums">{value}</CardTitle>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </CardHeader>
  </Card>
);

const ResponseCard = ({ incident }: { incident: Incident }) => (
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

const RiskReasonsCard = ({ incident }: { incident: Incident }) => (
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

const TrendCard = ({ incident }: { incident: Incident }) => (
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

const ParticipantsCard = ({ incident }: { incident: Incident }) => (
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

const FlaggedCommentsCard = ({
  busyAction,
  cleanupReason,
  incident,
  onAction,
  onCleanupReasonChange,
}: {
  busyAction: string | undefined;
  cleanupReason: string;
  incident: Incident;
  onAction: ActionRunner;
  onCleanupReasonChange: (value: string) => void;
}) => {
  const needsReview = incident.flaggedComments.filter((comment) => !comment.removed);
  const alreadyActioned = incident.flaggedComments.filter(
    (comment) => comment.removed
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs review</CardTitle>
        <CardDescription>
          Unremoved comments that match reports, watched words, or watched domains.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {needsReview.length === 0 ? (
          <EmptyText>No unremoved comments need review.</EmptyText>
        ) : (
          <>
            <FieldBlock
              description="Saved in the mod log for this post."
              htmlFor="fw-cleanup-reason"
              label="Removal reason"
            >
              <Input
                id="fw-cleanup-reason"
                value={cleanupReason}
                onChange={(event) => onCleanupReasonChange(event.target.value)}
              />
            </FieldBlock>

            <ScrollArea className="max-h-[420px] pr-3">
              <div className="flex flex-col gap-3">
                {needsReview.map((comment) => {
                  const authorLabel = formatUsername(comment.author);
                  const canBanAuthor = authorLabel !== 'unknown user';
                  const banAction = `ban:${comment.author}`;

                  return (
                    <div key={comment.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-5">
                            {authorLabel} - attention {comment.score}
                          </p>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                            {comment.body}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {comment.reasons.join(', ')}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {comment.permalink ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateTo(comment.permalink!)}
                            >
                              <ExternalLink data-icon="inline-start" />
                              Open
                            </Button>
                          ) : null}
                          <Button
                            disabled={Boolean(busyAction)}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              onAction(
                                comment.id,
                                `/api/incidents/${incident.postId}/comments/${comment.id}/remove`,
                                { reason: cleanupReason }
                              )
                            }
                          >
                            {busyAction === comment.id ? (
                              <RefreshCw
                                className="animate-spin"
                                data-icon="inline-start"
                              />
                            ) : null}
                            {busyAction === comment.id ? 'Working' : 'Remove'}
                          </Button>
                          <Button
                            disabled={Boolean(busyAction) || !canBanAuthor}
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              onAction(
                                banAction,
                                `/api/incidents/${incident.postId}/users/${encodeURIComponent(comment.author)}/ban`,
                                { reason: cleanupReason }
                              )
                            }
                          >
                            {busyAction === banAction ? (
                              <RefreshCw
                                className="animate-spin"
                                data-icon="inline-start"
                              />
                            ) : null}
                            {busyAction === banAction ? 'Working' : 'Ban user'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        {alreadyActioned.length > 0 ? (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium leading-5">Already actioned</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Removed comments stay here for the handoff note, but no longer
                count as active review work.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {alreadyActioned.map((comment) => (
                <div key={comment.id} className="rounded-lg border bg-muted/25 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-5">
                        {formatUsername(comment.author)} - removed
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {comment.body}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {comment.reasons.join(', ')}
                      </p>
                    </div>
                    {comment.permalink ? (
                      <Button
                        className="shrink-0"
                        size="sm"
                        variant="outline"
                        onClick={() => navigateTo(comment.permalink!)}
                      >
                        <ExternalLink data-icon="inline-start" />
                        Open
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

const RepeatedPhrasesCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Repeated wording</CardTitle>
      <CardDescription>
        Repeated phrases across user comments can point to brigading.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.repeatedPhrases.length === 0 ? (
        <EmptyText>No repeated wording found.</EmptyText>
      ) : (
        <div className="flex flex-col gap-3">
          {incident.repeatedPhrases.map((phrase) => (
            <div key={phrase.phrase} className="rounded-lg border p-3">
              <p className="text-sm font-medium leading-5">{phrase.phrase}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {phrase.count} matches
                {phrase.authors.length
                  ? ` - ${phrase.authors.map(formatUsername).join(', ')}`
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const LatestSignalsCard = ({ incident }: { incident: Incident }) => {
  const visibleSignals = incident.recentSignals;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Reports, user comments, post edits, and mod sends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visibleSignals.length === 0 ? (
          <EmptyText>No recent activity yet.</EmptyText>
        ) : (
          <ScrollArea className="max-h-[460px] pr-3">
            <div className="flex flex-col">
              {visibleSignals.slice(0, 16).map((signal, index) => (
                <div key={signal.id}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize leading-5">
                        {formatSignalType(signal)}
                        {signal.author
                          ? ` - ${formatUsername(signal.author)}`
                          : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {formatSignalDetail(signal)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                      {formatTime(signal.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

const SummariesCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Mod notes</CardTitle>
      <CardDescription>
        {incident.summary && incident.stats.flaggedCount > 0
          ? 'Final note saved earlier. Review remaining comments before closing again.'
          : incident.summary
            ? 'Final note saved. Copy it if this incident reopens.'
          : incident.escalationSummary
            ? 'Handoff saved. Mark handled after the review queue is clear.'
            : 'Handoff and final notes generated from this post.'}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.escalationSummary || incident.summary ? (
        <div className="flex flex-col gap-3">
          {incident.escalationSummary ? (
            <SummaryBlock label="Handoff" value={incident.escalationSummary} />
          ) : null}
          {incident.summary ? (
            <SummaryBlock label="Final note" value={incident.summary} />
          ) : null}
        </div>
      ) : (
        <EmptyText>
          Save a handoff note for the mod team. Mark handled to save a final
          note after the review queue is clear.
        </EmptyText>
      )}
    </CardContent>
  </Card>
);

const SummaryBlock = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      const didCopy = await copyTextToClipboard(value);
      if (!didCopy) return;

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{label}</Badge>
        <Button size="sm" variant="outline" onClick={onCopy}>
          <Copy data-icon="inline-start" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto rounded-lg border bg-background p-3 text-xs leading-6 text-foreground">
        {value}
      </pre>
    </div>
  );
};

const ActionLogCard = ({
  compact,
  incident,
}: {
  compact?: boolean;
  incident: Incident;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Mod log</CardTitle>
      <CardDescription>Actions taken from this view.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.actions.length === 0 ? (
        <EmptyText>No mod actions yet.</EmptyText>
      ) : (
        <ScrollArea
          className={cn(compact ? 'max-h-[360px]' : 'max-h-[460px]', 'pr-3')}
        >
          <div className="flex flex-col">
            {incident.actions.map((action, index) => (
              <div key={action.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5">{action.detail}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {formatUsername(action.actor)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                    {formatTime(action.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

const SettingsCard = ({
  busy,
  config,
  onSave,
}: {
  busy: boolean;
  config: FirewatchConfig;
  onSave: (values: {
    keywords: string;
    suspiciousDomains: string;
    heatThreshold: number;
    fireThreshold: number;
    wildfireThreshold: number;
  }) => Promise<void>;
}) => {
  const [keywords, setKeywords] = useState(config.keywords.join(', '));
  const [suspiciousDomains, setSuspiciousDomains] = useState(
    config.suspiciousDomains.join(', ')
  );
  const [heatThreshold, setHeatThreshold] = useState(
    String(config.heatThreshold)
  );
  const [fireThreshold, setFireThreshold] = useState(
    String(config.fireThreshold)
  );
  const [wildfireThreshold, setWildfireThreshold] = useState(
    String(config.wildfireThreshold)
  );

  const parsedHeat = Number(heatThreshold);
  const parsedFire = Number(fireThreshold);
  const parsedWildfire = Number(wildfireThreshold);
  const invalidThresholds =
    !Number.isFinite(parsedHeat) ||
    !Number.isFinite(parsedFire) ||
    !Number.isFinite(parsedWildfire) ||
    parsedHeat < 1 ||
    parsedFire <= parsedHeat ||
    parsedWildfire <= parsedFire ||
    parsedWildfire > 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Community filters</CardTitle>
        <CardDescription>
          Choose what sends posts into this mod queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldBlock
          description={`${splitList(keywords).length} active terms. Comma-separated words or phrases that should raise mod attention.`}
          htmlFor="fw-keywords"
          label="Watched words"
        >
          <Input
            id="fw-keywords"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </FieldBlock>

        <FieldBlock
          description={`${splitList(suspiciousDomains).length} domains watched in posts, comments, and report reasons.`}
          htmlFor="fw-domains"
          label="Watched domains"
        >
          <Input
            id="fw-domains"
            value={suspiciousDomains}
            onChange={(event) => setSuspiciousDomains(event.target.value)}
          />
        </FieldBlock>

        <div className="grid gap-3 md:grid-cols-3">
          <ThresholdInput
            id="review"
            label="Review at"
            value={heatThreshold}
            onChange={setHeatThreshold}
          />
          <ThresholdInput
            id="act"
            label="Act at"
            value={fireThreshold}
            onChange={setFireThreshold}
          />
          <ThresholdInput
            id="lock"
            label="Lock at"
            value={wildfireThreshold}
            onChange={setWildfireThreshold}
          />
        </div>

        {invalidThresholds ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Scores need ordering</AlertTitle>
            <AlertDescription>
              Use numbers from 1 to 100 where Review is below Act and Act is
              below Lock.
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          className="h-10 w-fit text-sm font-medium"
          disabled={busy || invalidThresholds}
          onClick={() =>
            onSave({
              keywords,
              suspiciousDomains,
              heatThreshold: parsedHeat,
              fireThreshold: parsedFire,
              wildfireThreshold: parsedWildfire,
            })
          }
        >
          {busy ? (
            <RefreshCw className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {busy ? 'Saving' : 'Save settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

const FieldBlock = ({
  children,
  description,
  htmlFor,
  label,
}: {
  children: ReactNode;
  description?: string;
  htmlFor: string;
  label: string;
}) => (
  <div className="flex flex-col gap-2">
    <label
      className="text-[13px] font-medium leading-none text-foreground/90"
      htmlFor={htmlFor}
    >
      {label}
    </label>
    {children}
    {description ? (
      <p className="text-xs font-medium leading-5 text-muted-foreground">
        {description}
      </p>
    ) : null}
  </div>
);

const ThresholdInput = ({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <FieldBlock htmlFor={`fw-threshold-${id}`} label={label}>
    <Input
      id={`fw-threshold-${id}`}
      inputMode="numeric"
      max={100}
      min={1}
      step={1}
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </FieldBlock>
);

const FilterHelpCard = ({
  config,
  incident,
}: {
  config: FirewatchConfig;
  incident: Incident;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>How posts enter review</CardTitle>
      <CardDescription>
        Firewatch queues posts for mods, but actions stay manual.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          Posts appear here from reports, new comments, watched words, watched
          domains, repeated user wording, reply clusters, or the post menu.
        </p>
        <p>
          This community has {config.keywords.length} watched words and{' '}
          {config.suspiciousDomains.length} watched domains. The selected post
          has {incident.stats.signalCount} recent events and{' '}
          {incident.stats.flaggedCount} comments needing review.
        </p>
      </div>
      <Alert>
        <CheckCircle2 />
        <AlertTitle>No automatic removals</AlertTitle>
        <AlertDescription>
          Firewatch explains why a post needs review. It does not remove
          comments, lock posts, or mark anything handled until a mod clicks the
          action.
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
);

const EmptyBoard = ({
  busy,
  onCreateDemo,
}: {
  busy: boolean;
  onCreateDemo: () => void;
}) => (
  <div className="mx-auto flex w-full max-w-md flex-col gap-5 py-8">
    <div className="flex flex-col gap-2.5">
      <h1 className="text-2xl font-medium leading-tight sm:text-3xl">
        No posts need review
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Firewatch will list posts here when reports, watched words, watched
        domains, repeated user wording, reply clusters, or post-menu sends need
        a mod look.
      </p>
    </div>
    <Button className="h-10 w-full text-sm font-medium" disabled={busy} onClick={onCreateDemo}>
      <Sparkles data-icon="inline-start" />
      {busy ? 'Creating demo post' : 'Create demo post'}
    </Button>
    <p className="text-xs leading-5 text-muted-foreground">
      Use Filters when mods want to change what gets queued.
    </p>
  </div>
);

const EmptyText = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-6 text-muted-foreground">{children}</p>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
