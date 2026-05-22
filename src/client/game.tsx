import './index.css';

import { navigateTo } from '@devvit/web/client';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flame,
  Gauge,
  Lock,
  RadioTower,
  RefreshCw,
  Save,
  Settings,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  ConfigResponse,
  DashboardInitResponse,
  FirewatchConfig,
  Incident,
  IncidentLevel,
} from '../shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardInitResponse }
  | { status: 'error'; message: string };

type ActionRunner = (
  action: string,
  endpoint: string,
  body?: Record<string, unknown>
) => Promise<void>;

type Notice = {
  type: 'success' | 'error';
  message: string;
};

const levelLabel: Record<IncidentLevel, string> = {
  watch: 'Watch',
  heat: 'Heat',
  fire: 'Fire',
  wildfire: 'Wildfire',
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

const formatSignalType = (value: string) => value.replaceAll('_', ' ');

const clampScore = (score: number) => Math.max(0, Math.min(100, score));

const actionLabel = (action: string) =>
  action
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const payload = (await res.json()) as { incident: Incident };
      updateIncident(payload.incident);
      setNotice({ type: 'success', message: `${actionLabel(action)} completed.` });
    } catch (error) {
      console.error(`Firewatch action failed: ${action}`, error);
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `${actionLabel(action)} failed: ${error.message}`
            : `${actionLabel(action)} failed.`,
      });
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
      setNotice({ type: 'success', message: 'Firewatch settings saved.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Settings failed: ${error.message}`
            : 'Settings failed.',
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
            <AlertTitle>Firewatch failed to load</AlertTitle>
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
          config={data.config}
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
          onCreateDemo={onCreateDemo}
          onRefresh={onRefresh}
          subredditName={subredditName}
        />
        <main className="flex min-h-0 flex-1 justify-center overflow-y-auto overscroll-contain px-4 py-6 sm:px-8 lg:px-10">
          <div className="flex w-full max-w-7xl flex-col gap-4">
            {notice ? <NoticeBanner notice={notice} /> : null}
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
            r/{subredditName || 'subreddit'} review desk
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <PanelLabel>Incident queue</PanelLabel>
        {incidents.length === 0 ? (
          <p className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/35 p-3 text-sm leading-6 text-sidebar-foreground/70">
            No incidents yet. Seed a demo incident or use the post menu action on
            a thread.
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
  const displayName = username || 'moderator';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'M';

  return (
    <div className="mt-5 rounded-lg border border-sidebar-border/65 bg-sidebar-primary/10 px-2.5 py-2">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-primary/20 text-sm font-medium text-sidebar-foreground">
          {initial}
        </div>
        <div className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="text-2xs uppercase tracking-[0.12em] text-sidebar-foreground/55">
            Account
          </span>
          <span className="truncate text-sm font-medium">u/{displayName}</span>
        </div>
      </div>
    </div>
  );
};

const WorkspaceHeader = ({
  busyAction,
  onCreateDemo,
  onRefresh,
  subredditName,
}: {
  busyAction: string | undefined;
  onCreateDemo: () => void;
  onRefresh: () => void;
  subredditName: string;
}) => (
  <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-4 sm:px-8 lg:justify-end lg:px-10 lg:py-5">
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
          {busyAction === 'demo' ? 'Seeding' : 'Demo'}
        </span>
        <span className="sr-only sm:hidden">
          {busyAction === 'demo' ? 'Seeding demo incident' : 'Create demo incident'}
        </span>
      </Button>
    </div>
  </header>
);

const NoticeBanner = ({ notice }: { notice: Notice }) => (
  <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}>
    {notice.type === 'error' ? <AlertTriangle /> : <CheckCircle2 />}
    <AlertTitle>{notice.type === 'error' ? 'Needs attention' : 'Saved'}</AlertTitle>
    <AlertDescription>{notice.message}</AlertDescription>
  </Alert>
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
        <PanelLabel>Incident queue</PanelLabel>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {incidents.length} thread{incidents.length === 1 ? '' : 's'} tracked
        </p>
      </div>
      <Badge variant="outline">{incidents.length}</Badge>
    </div>
    {incidents.length ? (
      <ScrollArea className="w-full">
        <div className="flex w-max gap-3 pb-2">
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
      </ScrollArea>
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
    className={cn(
      'ui-feedback w-full rounded-lg border p-3 text-left transition-colors',
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
      <span className="capitalize">{incident.status}</span>
      <span>{formatTime(incident.updatedAt)}</span>
    </div>
  </button>
);

const PanelLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[11px] font-medium uppercase leading-none text-muted-foreground">
    {children}
  </p>
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
    className="shrink-0 font-medium tabular-nums"
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
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>(() =>
    incident.flaggedComments
      .filter((comment) => !comment.removed)
      .slice(0, 3)
      .map((comment) => comment.id)
  );
  const [cleanupReason, setCleanupReason] = useState('Rule-breaking cleanup');
  const unresolvedComments = incident.flaggedComments.filter(
    (comment) => !comment.removed
  );
  const activeSelectedCommentIds = selectedCommentIds.filter((commentId) =>
    unresolvedComments.some((comment) => comment.id === commentId)
  );

  const setCommentSelected = (commentId: string, selected: boolean) => {
    setSelectedCommentIds((current) => {
      if (selected) return Array.from(new Set([...current, commentId]));
      return current.filter((id) => id !== commentId);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <IncidentIntro incident={incident} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<ShieldAlert />}
          label="Reports"
          value={String(incident.stats.reportSignals)}
        />
        <MetricCard
          icon={<ClipboardList />}
          label="Flagged"
          value={String(incident.stats.flaggedCount)}
        />
        <MetricCard
          icon={<Users />}
          label="Participants"
          value={String(incident.stats.uniqueParticipants)}
        />
        <MetricCard
          icon={<Gauge />}
          label="Pile-ons"
          value={String(incident.stats.branchPileOns)}
        />
      </div>

      <IncidentHero
        busyAction={busyAction}
        cleanupReason={cleanupReason}
        incident={incident}
        selectedCommentIds={activeSelectedCommentIds}
        selectedCount={activeSelectedCommentIds.length}
        unresolvedCount={unresolvedComments.length}
        onAction={onAction}
      />

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="comments">Cleanup</TabsTrigger>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings data-icon="inline-start" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" value="overview">
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
          <FlaggedCommentsCard
            activeSelectedCommentIds={activeSelectedCommentIds}
            busyAction={busyAction}
            cleanupReason={cleanupReason}
            incident={incident}
            onAction={onAction}
            onCleanupReasonChange={setCleanupReason}
            onSelectComment={setCommentSelected}
          />
          <RepeatedPhrasesCard incident={incident} />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-2" value="signals">
          <LatestSignalsCard incident={incident} />
          <ActionLogCard incident={incident} />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-2" value="reports">
          <SummariesCard incident={incident} />
          <ActionLogCard incident={incident} compact />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]" value="settings">
          <SettingsCard
            key={`${config.keywords.join('|')}:${config.suspiciousDomains.join('|')}:${config.heatThreshold}:${config.fireThreshold}:${config.wildfireThreshold}`}
            busy={busyAction === 'config'}
            config={config}
            onSave={onSaveConfig}
          />
          <ReadinessCard config={config} incident={incident} />
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
          <Badge variant={levelBadgeVariant[incident.level]}>
            {levelLabel[incident.level]}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {incident.status}
          </Badge>
          {incident.demo ? <Badge variant="secondary">Demo</Badge> : null}
          {incident.claim ? (
            <Badge variant="outline">u/{incident.claim.username}</Badge>
          ) : null}
        </div>
        <h1 className="mt-4 max-w-4xl text-2xl font-medium leading-tight sm:text-3xl">
          {incident.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Updated {formatDateTime(incident.updatedAt)}. {incident.stats.signalCount}{' '}
          recent signals, peak score {incident.peakScore}/100.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-end justify-between gap-4">
          <span className="text-[13px] font-medium leading-5 text-muted-foreground">
            Risk score
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
        <p className="mt-3 text-xs font-medium leading-5 text-muted-foreground">
          {incident.responseSuggestion.label}
        </p>
      </div>
    </div>
  </section>
);

const IncidentHero = ({
  busyAction,
  cleanupReason,
  incident,
  selectedCommentIds,
  selectedCount,
  unresolvedCount,
  onAction,
}: {
  busyAction: string | undefined;
  cleanupReason: string;
  incident: Incident;
  selectedCommentIds: string[];
  selectedCount: number;
  unresolvedCount: number;
  onAction: ActionRunner;
}) => (
  <Card>
    <CardHeader className="gap-2">
      <div className="min-w-0">
        <CardTitle>Response playbook</CardTitle>
        <CardDescription className="mt-1 max-w-2xl">
          {incident.responseSuggestion.detail}
        </CardDescription>
      </div>
    </CardHeader>

    <CardContent className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <PlaybookButton
          disabled={Boolean(incident.claim) || Boolean(busyAction)}
          icon={<UserCheck data-icon="inline-start" />}
          label={incident.claim ? 'Claimed' : 'Claim'}
          loading={busyAction === 'claim'}
          onClick={() => onAction('claim', `/api/incidents/${incident.postId}/claim`)}
        />
        <PlaybookButton
          disabled={Boolean(busyAction) || incident.status === 'resolved'}
          icon={<RadioTower data-icon="inline-start" />}
          label="Cool down"
          loading={busyAction === 'cool-down'}
          variant="outline"
          onClick={() =>
            onAction('cool-down', `/api/incidents/${incident.postId}/cool-down`)
          }
        />
        <PlaybookButton
          disabled={Boolean(busyAction) || unresolvedCount === 0}
          icon={<ClipboardList data-icon="inline-start" />}
          label={`Clean up ${selectedCount || Math.min(3, unresolvedCount)}`}
          loading={busyAction === 'cleanup'}
          variant="outline"
          onClick={() =>
            onAction('cleanup', `/api/incidents/${incident.postId}/cleanup`, {
              commentIds: selectedCommentIds,
              reason: cleanupReason,
            })
          }
        />
        <PlaybookButton
          disabled={Boolean(busyAction) || incident.status === 'resolved'}
          icon={<Lock data-icon="inline-start" />}
          label="Lockdown"
          loading={busyAction === 'lockdown'}
          variant="destructive"
          onClick={() =>
            onAction('lockdown', `/api/incidents/${incident.postId}/lockdown`)
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <PlaybookButton
          disabled={Boolean(busyAction)}
          icon={<ShieldAlert data-icon="inline-start" />}
          label="Escalate"
          loading={busyAction === 'escalate'}
          variant="secondary"
          onClick={() =>
            onAction('escalate', `/api/incidents/${incident.postId}/escalate`)
          }
        />
        <Button
          disabled={!incident.permalink}
          variant="ghost"
          onClick={() => incident.permalink && navigateTo(incident.permalink)}
        >
          <ExternalLink data-icon="inline-start" />
          Open source
        </Button>
        <PlaybookButton
          disabled={Boolean(busyAction) || incident.status === 'resolved'}
          icon={<CheckCircle2 data-icon="inline-start" />}
          label="Resolve"
          loading={busyAction === 'resolve'}
          variant="ghost"
          onClick={() =>
            onAction('resolve', `/api/incidents/${incident.postId}/resolve`)
          }
        />
      </div>
    </CardContent>
  </Card>
);

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
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <Card size="sm">
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <CardDescription>{label}</CardDescription>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <CardTitle className="text-2xl font-medium tabular-nums">{value}</CardTitle>
    </CardHeader>
  </Card>
);

const ResponseCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Suggested response</CardTitle>
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
      <CardTitle>Why it was flagged</CardTitle>
      <CardDescription>
        Every score is built from visible moderator-facing signals.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.reasons.length === 0 ? (
        <EmptyText>No active risk reasons yet.</EmptyText>
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
      <CardTitle>Risk trend</CardTitle>
      <CardDescription>Recent score pressure by signal bucket.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.trend.length === 0 ? (
        <EmptyText>No trend points yet.</EmptyText>
      ) : (
        <div className="flex h-40 items-stretch gap-2 rounded-lg border bg-muted/20 p-3">
          {incident.trend.map((point) => (
            <div
              key={point.timestamp}
              className="flex min-w-0 flex-1 flex-col gap-2"
              title={`${formatTime(point.timestamp)} score ${point.score}`}
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
      <CardTitle>Involved users</CardTitle>
      <CardDescription>Participants most present in current signals.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.involvedUsers.length === 0 ? (
        <EmptyText>No users detected in the current signal window.</EmptyText>
      ) : (
        <div className="flex flex-col">
          {incident.involvedUsers.map((user, index) => (
            <div key={user.username}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-5">
                    u/{user.username}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {user.signals} signals - {user.flagged} flagged -{' '}
                    {user.branchCount} branches
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
  activeSelectedCommentIds,
  busyAction,
  cleanupReason,
  incident,
  onAction,
  onCleanupReasonChange,
  onSelectComment,
}: {
  activeSelectedCommentIds: string[];
  busyAction: string | undefined;
  cleanupReason: string;
  incident: Incident;
  onAction: ActionRunner;
  onCleanupReasonChange: (value: string) => void;
  onSelectComment: (commentId: string, selected: boolean) => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Flagged comments</CardTitle>
      <CardDescription>Select comments for the cleanup playbook.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <FieldBlock
        description="This reason is saved into Firewatch's action log."
        htmlFor="fw-cleanup-reason"
        label="Cleanup reason"
      >
        <Input
          id="fw-cleanup-reason"
          value={cleanupReason}
          onChange={(event) => onCleanupReasonChange(event.target.value)}
        />
      </FieldBlock>

      {incident.flaggedComments.length === 0 ? (
        <EmptyText>No risky comments have crossed the threshold yet.</EmptyText>
      ) : (
        <ScrollArea className="h-[520px] pr-3">
          <div className="flex flex-col gap-3">
            {incident.flaggedComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <label className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      checked={activeSelectedCommentIds.includes(comment.id)}
                      disabled={comment.removed}
                      onCheckedChange={(checked) =>
                        onSelectComment(comment.id, checked === true)
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-5">
                        u/{comment.author} - score {comment.score}
                      </span>
                      <span className="mt-2 line-clamp-3 block text-sm leading-6 text-muted-foreground">
                        {comment.body}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                        {comment.removed ? 'removed - ' : ''}
                        {comment.reasons.join(', ')}
                      </span>
                    </span>
                  </label>

                  <div className="flex shrink-0 gap-2">
                    <Button
                      disabled={!comment.permalink}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        comment.permalink && navigateTo(comment.permalink)
                      }
                    >
                      <ExternalLink data-icon="inline-start" />
                      Open
                    </Button>
                    <Button
                      disabled={Boolean(comment.removed) || Boolean(busyAction)}
                      size="sm"
                      variant={comment.removed ? 'secondary' : 'destructive'}
                      onClick={() =>
                        onAction(
                          comment.id,
                          `/api/incidents/${incident.postId}/comments/${comment.id}/remove`
                        )
                      }
                    >
                      {busyAction === comment.id ? (
                        <RefreshCw className="animate-spin" data-icon="inline-start" />
                      ) : null}
                      {comment.removed
                        ? 'Removed'
                        : busyAction === comment.id
                          ? 'Working'
                          : 'Remove'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

const RepeatedPhrasesCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Repeated phrases</CardTitle>
      <CardDescription>Phrase clusters that can indicate brigading.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.repeatedPhrases.length === 0 ? (
        <EmptyText>No repeated phrase clusters detected.</EmptyText>
      ) : (
        <div className="flex flex-col gap-3">
          {incident.repeatedPhrases.map((phrase) => (
            <div key={phrase.phrase} className="rounded-lg border p-3">
              <p className="text-sm font-medium leading-5">{phrase.phrase}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {phrase.count} matches
                {phrase.authors.length
                  ? ` - ${phrase.authors.map((author) => `u/${author}`).join(', ')}`
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const LatestSignalsCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Latest signals</CardTitle>
      <CardDescription>Newest trigger, report, and manual events.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.recentSignals.length === 0 ? (
        <EmptyText>No recent signals yet.</EmptyText>
      ) : (
        <ScrollArea className="h-[460px] pr-3">
          <div className="flex flex-col">
            {incident.recentSignals.slice(0, 16).map((signal, index) => (
              <div key={signal.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize leading-5">
                      {formatSignalType(signal.type)}
                      {signal.author ? ` - u/${signal.author}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {signal.reason ?? signal.body ?? 'No detail provided'}
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

const SummariesCard = ({ incident }: { incident: Incident }) => (
  <Card>
    <CardHeader>
      <CardTitle>Action summaries</CardTitle>
      <CardDescription>
        Escalation handoff and after-action report generated from incident state.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.escalationSummary || incident.summary ? (
        <div className="flex flex-col gap-3">
          {incident.escalationSummary ? (
            <SummaryBlock label="Escalation" value={incident.escalationSummary} />
          ) : null}
          {incident.summary ? (
            <SummaryBlock label="After-action" value={incident.summary} />
          ) : null}
        </div>
      ) : (
        <EmptyText>
          Escalate to generate a mod handoff. Resolve or lockdown to generate the
          after-action report.
        </EmptyText>
      )}
    </CardContent>
  </Card>
);

const SummaryBlock = ({ label, value }: { label: string; value: string }) => (
  <div>
    <Badge variant="outline">{label}</Badge>
    <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-primary p-3 text-xs leading-6 text-primary-foreground">
      {value}
    </pre>
  </div>
);

const ActionLogCard = ({
  compact,
  incident,
}: {
  compact?: boolean;
  incident: Incident;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Action log</CardTitle>
      <CardDescription>Moderator actions recorded by Firewatch.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.actions.length === 0 ? (
        <EmptyText>No moderator actions recorded yet.</EmptyText>
      ) : (
        <ScrollArea className={cn(compact ? 'h-[360px]' : 'h-[460px]', 'pr-3')}>
          <div className="flex flex-col">
            {incident.actions.map((action, index) => (
              <div key={action.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5">{action.detail}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      u/{action.actor}
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
        <CardTitle>Community settings</CardTitle>
        <CardDescription>
          Tune Firewatch without leaving the incident board.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldBlock
          description={`${splitList(keywords).length} active terms. Comma-separated terms raise incident risk when they appear in comments or reports.`}
          htmlFor="fw-keywords"
          label="Heated keywords"
        >
          <Input
            id="fw-keywords"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </FieldBlock>

        <FieldBlock
          description={`${splitList(suspiciousDomains).length} domains watched in comment bodies and report details.`}
          htmlFor="fw-domains"
          label="Suspicious domains"
        >
          <Input
            id="fw-domains"
            value={suspiciousDomains}
            onChange={(event) => setSuspiciousDomains(event.target.value)}
          />
        </FieldBlock>

        <div className="grid gap-3 md:grid-cols-3">
          <ThresholdInput
            label="Heat"
            value={heatThreshold}
            onChange={setHeatThreshold}
          />
          <ThresholdInput
            label="Fire"
            value={fireThreshold}
            onChange={setFireThreshold}
          />
          <ThresholdInput
            label="Wildfire"
            value={wildfireThreshold}
            onChange={setWildfireThreshold}
          />
        </div>

        {invalidThresholds ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Thresholds need ordering</AlertTitle>
            <AlertDescription>
              Use numbers from 1 to 100 where Heat is below Fire and Fire is
              below Wildfire.
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
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <FieldBlock htmlFor={`fw-threshold-${label}`} label={label}>
    <Input
      id={`fw-threshold-${label}`}
      inputMode="numeric"
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </FieldBlock>
);

const ReadinessCard = ({
  config,
  incident,
}: {
  config: FirewatchConfig;
  incident: Incident;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Launch readiness</CardTitle>
      <CardDescription>
        The checks a moderator expects before trusting the app.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <ReadinessRow
        label="Signal ingestion"
        value="Comment create, comment report, post report, and manual escalation"
      />
      <ReadinessRow
        label="Config coverage"
        value={`${config.keywords.length} keywords and ${config.suspiciousDomains.length} suspicious domains`}
      />
      <ReadinessRow
        label="Response playbooks"
        value="Claim, cooldown, cleanup, lockdown, escalation, and resolution"
      />
      <ReadinessRow
        label="Current incident"
        value={`${incident.stats.signalCount} signals, ${incident.stats.flaggedCount} flagged comments, ${incident.actions.length} actions`}
      />
      <Separator />
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Product posture</AlertTitle>
        <AlertDescription>
          Firewatch is deterministic, explainable, and mod-controlled. It does
          not auto-punish users from a hidden score.
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
);

const ReadinessRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border bg-muted/20 p-3">
    <p className="text-sm font-medium leading-5">{label}</p>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p>
  </div>
);

const EmptyBoard = ({
  busy,
  config,
  onCreateDemo,
}: {
  busy: boolean;
  config: FirewatchConfig;
  onCreateDemo: () => void;
}) => (
  <div className="mx-auto flex w-full max-w-md flex-col gap-5 py-8">
    <div className="flex flex-col gap-2.5">
      <h1 className="text-2xl font-medium leading-tight sm:text-3xl">
        No active incidents
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Firewatch is ready to score comment velocity, reports, keywords,
        suspicious domains, repeated phrases, branch pile-ons, removal clusters,
        and manual escalations.
      </p>
    </div>
    <Button className="h-10 w-full text-sm font-medium" disabled={busy} onClick={onCreateDemo}>
      <Sparkles data-icon="inline-start" />
      {busy ? 'Seeding demo' : 'Create demo incident'}
    </Button>
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard icon={<Gauge />} label="Heat" value={String(config.heatThreshold)} />
      <MetricCard icon={<Flame />} label="Fire" value={String(config.fireThreshold)} />
      <MetricCard icon={<ShieldAlert />} label="Wildfire" value={String(config.wildfireThreshold)} />
    </div>
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
