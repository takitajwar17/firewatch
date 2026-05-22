import './index.css';

import { navigateTo } from '@devvit/web/client';
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  DashboardInitResponse,
  FirewatchConfig,
  Incident,
  IncidentLevel,
} from '../shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardInitResponse }
  | { status: 'error'; message: string };

const levelLabel: Record<IncidentLevel, string> = {
  watch: 'Watch',
  heat: 'Heat',
  fire: 'Fire',
  wildfire: 'Wildfire',
};

const levelClass: Record<IncidentLevel, string> = {
  watch: 'bg-[#dbe9e5] text-[#1f6157]',
  heat: 'bg-[#f7df9e] text-[#6a4a07]',
  fire: 'bg-[#ffc7a8] text-[#8b2e0f]',
  wildfire: 'bg-[#e6402a] text-white',
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

const clampScore = (score: number) => `${Math.max(0, Math.min(100, score))}%`;

export const App = () => {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();

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

      return {
        status: 'ready',
        data: {
          ...current.data,
          incidents: current.data.incidents
            .map((incident) =>
              incident.postId === updatedIncident.postId ? updatedIncident : incident
            )
            .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt),
        },
      };
    });
    setSelectedPostId(updatedIncident.postId);
  };

  const runAction = async (
    action: string,
    endpoint: string,
    body?: Record<string, unknown>
  ) => {
    setBusyAction(action);
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
    } catch (error) {
      console.error(`Firewatch action failed: ${action}`, error);
    } finally {
      setBusyAction(undefined);
    }
  };

  const createDemoIncident = () => runAction('demo', '/api/demo/incident');

  if (loadState.status === 'error') {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md rounded-lg border border-[#f0b8a9] bg-white p-6 shadow-sm">
            <h1 className="text-xl font-black text-[#1d2525]">
              Firewatch failed to load
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#65706f]">
              {loadState.message}
            </p>
            <button
              className="mt-5 h-10 rounded-md bg-[#1d2525] px-4 text-sm font-bold text-white"
              onClick={refresh}
            >
              Retry
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-col gap-4 border-b border-[#dfd8cd] bg-[#f7f4ee] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e6402a] text-lg font-black text-white">
              F
            </span>
            <div>
              <h1 className="text-2xl font-black leading-tight text-[#1d2525]">
                Firewatch
              </h1>
              <p className="text-sm font-medium text-[#65706f]">
                r/{data.subredditName} incident command
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="h-10 rounded-md border border-[#c9c1b5] bg-white px-4 text-sm font-bold text-[#1d2525] transition hover:border-[#1d2525]"
              onClick={refresh}
            >
              Refresh
            </button>
            <button
              className="h-10 rounded-md border border-[#c9c1b5] bg-white px-4 text-sm font-bold text-[#1d2525] transition hover:border-[#1d2525] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={busyAction === 'demo'}
              onClick={createDemoIncident}
            >
              {busyAction === 'demo' ? 'Seeding...' : 'Demo incident'}
            </button>
            <button
              className="h-10 rounded-md bg-[#1d2525] px-4 text-sm font-bold text-white transition hover:bg-[#334140]"
              onClick={() => navigateTo('https://developers.reddit.com/docs')}
            >
              Devvit docs
            </button>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-0 md:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-[#dfd8cd] bg-[#fbfaf7] md:border-b-0 md:border-r">
            <div className="border-b border-[#e6ded2] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7b6760]">
                Active incidents
              </p>
              <p className="mt-1 text-sm text-[#65706f]">
                {data.incidents.length} thread{data.incidents.length === 1 ? '' : 's'} tracked
              </p>
            </div>
            <div className="max-h-[44vh] overflow-y-auto md:max-h-[calc(100vh-142px)]">
              {data.incidents.length === 0 ? (
                <div className="px-5 py-8 text-sm leading-6 text-[#65706f]">
                  No incidents yet. Use the post menu action on a thread or wait
                  for report/comment triggers.
                </div>
              ) : (
                data.incidents.map((incident) => (
                  <button
                    key={incident.postId}
                    className={`w-full border-b border-[#ece4d8] px-5 py-4 text-left transition hover:bg-white ${
                      selectedIncident?.postId === incident.postId ? 'bg-white' : ''
                    }`}
                    onClick={() => setSelectedPostId(incident.postId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-black leading-5 text-[#1d2525]">
                        {incident.title}
                      </p>
                      <ScorePill incident={incident} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#65706f]">
                      <span>{incident.status}</span>
                      <span>{formatTime(incident.updatedAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="bg-[#f7f4ee] px-5 py-5">
            {loadState.status === 'loading' ? (
              <Panel>
                <p className="text-sm font-semibold text-[#65706f]">
                  Loading Firewatch signals...
                </p>
              </Panel>
            ) : selectedIncident ? (
              <IncidentDetail
                key={selectedIncident.postId}
                busyAction={busyAction}
                incident={selectedIncident}
                onAction={runAction}
              />
            ) : (
              <EmptyBoard
                busy={busyAction === 'demo'}
                config={data.config}
                onCreateDemo={createDemoIncident}
              />
            )}
          </section>
        </main>
      </div>
    </Shell>
  );
};

const Shell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-[#f7f4ee] font-sans text-[#1d2525]">
    {children}
  </div>
);

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-[#dfd8cd] bg-white p-5 shadow-sm">
    {children}
  </div>
);

const ScorePill = ({ incident }: { incident: Incident }) => (
  <span
    className={`shrink-0 rounded px-2 py-1 text-xs font-black ${levelClass[incident.level]}`}
  >
    {incident.score}
  </span>
);

const IncidentDetail = ({
  incident,
  busyAction,
  onAction,
}: {
  incident: Incident;
  busyAction: string | undefined;
  onAction: (
    action: string,
    endpoint: string,
    body?: Record<string, unknown>
  ) => Promise<void>;
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

  const toggleComment = (commentId: string) => {
    setSelectedCommentIds((current) =>
      current.includes(commentId)
        ? current.filter((id) => id !== commentId)
        : [...current, commentId]
    );
  };

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2.5 py-1 text-xs font-black ${levelClass[incident.level]}`}
              >
                {levelLabel[incident.level]}
              </span>
              <span className="rounded bg-[#ece4d8] px-2.5 py-1 text-xs font-black text-[#64554d]">
                {incident.status}
              </span>
              {incident.demo ? (
                <span className="rounded bg-[#fde6df] px-2.5 py-1 text-xs font-black text-[#a83420]">
                  demo
                </span>
              ) : null}
              {incident.claim ? (
                <span className="rounded bg-[#dbe9e5] px-2.5 py-1 text-xs font-black text-[#1f6157]">
                  claimed by u/{incident.claim.username}
                </span>
              ) : null}
            </div>
            <h2 className="mt-4 max-w-[820px] text-2xl font-black leading-tight text-[#1d2525] md:text-3xl">
              {incident.title}
            </h2>
            <p className="mt-3 text-sm font-medium text-[#65706f]">
              Updated {formatTime(incident.updatedAt)} -{' '}
              {incident.stats?.signalCount ?? incident.recentSignals.length} recent
              signals - peak {incident.peakScore}/100
            </p>
          </div>
          <div className="w-full rounded-lg border border-[#dfd8cd] bg-[#fbfaf7] p-4 lg:w-[280px]">
            <div className="flex items-end justify-between">
              <span className="text-sm font-black text-[#65706f]">Risk score</span>
              <span className="text-4xl font-black text-[#1d2525]">
                {incident.score}
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#e6ded2]">
              <div
                className="h-full rounded-full bg-[#e6402a]"
                style={{ width: clampScore(incident.score) }}
              />
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-[#65706f]">
              {incident.responseSuggestion.detail}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton
            disabled={Boolean(incident.claim) || Boolean(busyAction)}
            label={incident.claim ? 'Claimed' : 'Claim incident'}
            loading={busyAction === 'claim'}
            onClick={() =>
              onAction('claim', `/api/incidents/${incident.postId}/claim`)
            }
          />
          <ActionButton
            disabled={Boolean(busyAction) || incident.status === 'resolved'}
            label="Cool down"
            loading={busyAction === 'cool-down'}
            onClick={() =>
              onAction('cool-down', `/api/incidents/${incident.postId}/cool-down`)
            }
          />
          <ActionButton
            disabled={Boolean(busyAction) || unresolvedComments.length === 0}
            label={`Clean up ${
              activeSelectedCommentIds.length || Math.min(3, unresolvedComments.length)
            }`}
            loading={busyAction === 'cleanup'}
            onClick={() =>
              onAction('cleanup', `/api/incidents/${incident.postId}/cleanup`, {
                commentIds: activeSelectedCommentIds,
                reason: cleanupReason,
              })
            }
          />
          <ActionButton
            disabled={Boolean(busyAction) || incident.status === 'resolved'}
            label="Lockdown"
            loading={busyAction === 'lockdown'}
            onClick={() =>
              onAction('lockdown', `/api/incidents/${incident.postId}/lockdown`)
            }
          />
          <ActionButton
            disabled={Boolean(busyAction)}
            label="Escalate"
            loading={busyAction === 'escalate'}
            variant="secondary"
            onClick={() =>
              onAction('escalate', `/api/incidents/${incident.postId}/escalate`)
            }
          />
          <button
            className="h-10 rounded-md border border-[#c9c1b5] bg-white px-4 text-sm font-bold text-[#1d2525] transition hover:border-[#1d2525]"
            onClick={() => incident.permalink && navigateTo(incident.permalink)}
          >
            Open source
          </button>
          <ActionButton
            disabled={Boolean(busyAction) || incident.status === 'resolved'}
            label="Resolve"
            loading={busyAction === 'resolve'}
            variant="secondary"
            onClick={() =>
              onAction('resolve', `/api/incidents/${incident.postId}/resolve`)
            }
          />
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Reports" value={String(incident.stats.reportSignals)} />
        <Metric label="Flagged" value={String(incident.stats.flaggedCount)} />
        <Metric label="Users" value={String(incident.stats.uniqueParticipants)} />
        <Metric label="Pile-ons" value={String(incident.stats.branchPileOns)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-black">Suggested response</h3>
              <p className="mt-2 text-sm leading-6 text-[#65706f]">
                {incident.responseSuggestion.label} -{' '}
                {incident.responseSuggestion.detail}
              </p>
            </div>
            <ScorePill incident={incident} />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {incident.responseSuggestion.steps.map((step) => (
              <div
                key={step}
                className="rounded-md border border-[#e6ded2] bg-[#fbfaf7] p-3 text-sm font-semibold leading-5 text-[#465150]"
              >
                {step}
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-base font-black">Risk trend</h3>
          <div className="mt-4 flex h-28 items-end gap-2">
            {incident.trend.length === 0 ? (
              <p className="self-center text-sm leading-6 text-[#65706f]">
                No trend points yet.
              </p>
            ) : (
              incident.trend.map((point) => (
                <div
                  key={point.timestamp}
                  className="flex flex-1 flex-col items-center gap-2"
                  title={`${formatTime(point.timestamp)} score ${point.score}`}
                >
                  <div
                    className="w-full rounded-t bg-[#e6402a]"
                    style={{ height: `${Math.max(8, point.score)}%` }}
                  />
                  <span className="text-[10px] font-bold text-[#7b6760]">
                    {formatTime(point.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <h3 className="text-base font-black">Why it was flagged</h3>
          <div className="mt-4 grid gap-3">
            {incident.reasons.length === 0 ? (
              <p className="text-sm leading-6 text-[#65706f]">
                No active risk reasons yet.
              </p>
            ) : (
              incident.reasons.map((reason) => (
                <div
                  key={reason.key}
                  className="rounded-md border border-[#e6ded2] bg-[#fbfaf7] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#1d2525]">
                        {reason.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#65706f]">
                        {reason.detail}
                      </p>
                      {reason.evidence?.length ? (
                        <p className="mt-2 text-xs font-semibold text-[#7b6760]">
                          {reason.evidence.join(', ')}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded bg-white px-2 py-1 text-xs font-black text-[#e6402a]">
                      +{reason.points}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-base font-black">Involved users</h3>
          <div className="mt-4 grid gap-3">
            {incident.involvedUsers.length === 0 ? (
              <p className="text-sm leading-6 text-[#65706f]">
                No users detected in the current signal window.
              </p>
            ) : (
              incident.involvedUsers.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center justify-between gap-3 border-b border-[#ece4d8] pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-black text-[#1d2525]">
                      u/{user.username}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#7b6760]">
                      {user.signals} signals - {user.flagged} flagged -{' '}
                      {user.branchCount} branches
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#7b6760]">
                    {formatTime(user.lastSeenAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-black">Flagged comments</h3>
              <p className="mt-1 text-sm text-[#65706f]">
                Select comments for the cleanup playbook.
              </p>
            </div>
            <input
              className="h-10 rounded-md border border-[#c9c1b5] bg-white px-3 text-sm font-semibold text-[#1d2525] outline-none focus:border-[#1d2525]"
              value={cleanupReason}
              onChange={(event) => setCleanupReason(event.target.value)}
            />
          </div>
          <div className="mt-4 grid gap-3">
            {incident.flaggedComments.length === 0 ? (
              <p className="text-sm leading-6 text-[#65706f]">
                No risky comments have crossed the threshold yet.
              </p>
            ) : (
              incident.flaggedComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-md border border-[#e6ded2] bg-[#fbfaf7] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <label className="flex items-start gap-3">
                        <input
                          className="mt-1 h-4 w-4 accent-[#e6402a]"
                          checked={activeSelectedCommentIds.includes(comment.id)}
                          disabled={comment.removed}
                          type="checkbox"
                          onChange={() => toggleComment(comment.id)}
                        />
                        <span>
                          <span className="block text-sm font-black text-[#1d2525]">
                            u/{comment.author} - score {comment.score}
                          </span>
                          <span className="mt-2 line-clamp-3 block text-sm leading-6 text-[#465150]">
                            {comment.body}
                          </span>
                          <span className="mt-2 block text-xs font-semibold text-[#7b6760]">
                            {comment.removed ? 'removed - ' : ''}
                            {comment.reasons.join(', ')}
                          </span>
                        </span>
                      </label>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="h-9 rounded-md border border-[#c9c1b5] bg-white px-3 text-xs font-bold text-[#1d2525] transition hover:border-[#1d2525] disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={!comment.permalink}
                        onClick={() =>
                          comment.permalink && navigateTo(comment.permalink)
                        }
                      >
                        Open
                      </button>
                      <ActionButton
                        compact
                        disabled={Boolean(comment.removed) || Boolean(busyAction)}
                        label={comment.removed ? 'Removed' : 'Remove'}
                        loading={busyAction === comment.id}
                        onClick={() =>
                          onAction(
                            comment.id,
                            `/api/incidents/${incident.postId}/comments/${comment.id}/remove`
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-base font-black">Repeated phrases</h3>
          <div className="mt-4 grid gap-3">
            {incident.repeatedPhrases.length === 0 ? (
              <p className="text-sm leading-6 text-[#65706f]">
                No repeated phrase clusters detected.
              </p>
            ) : (
              incident.repeatedPhrases.map((phrase) => (
                <div
                  key={phrase.phrase}
                  className="rounded-md border border-[#e6ded2] bg-[#fbfaf7] p-3"
                >
                  <p className="text-sm font-black text-[#1d2525]">
                    {phrase.phrase}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7b6760]">
                    {phrase.count} matches
                    {phrase.authors.length
                      ? ` - ${phrase.authors.map((author) => `u/${author}`).join(', ')}`
                      : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="text-base font-black">Latest signals</h3>
          <div className="mt-4 grid gap-3">
            {incident.recentSignals.slice(0, 8).map((signal) => (
              <div
                key={signal.id}
                className="flex items-start justify-between gap-3 border-b border-[#ece4d8] pb-3 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1d2525]">
                    {signal.type.replaceAll('_', ' ')}
                    {signal.author ? ` - u/${signal.author}` : ''}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#7b6760]">
                    {signal.reason ?? signal.body ?? 'No detail provided'}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[#7b6760]">
                  {formatTime(signal.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-base font-black">Action summaries</h3>
          {incident.escalationSummary ? (
            <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[#1d2525] p-4 text-xs leading-6 text-white">
              {incident.escalationSummary}
            </pre>
          ) : null}
          {incident.summary ? (
            <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-[#1d2525] p-4 text-xs leading-6 text-white">
              {incident.summary}
            </pre>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#65706f]">
              Escalate to generate a mod handoff. Resolve or lockdown to generate
              the after-action report.
            </p>
          )}
        </Panel>
      </div>

      <Panel>
        <h3 className="text-base font-black">Action log</h3>
        <div className="mt-4 grid gap-3">
          {incident.actions.length === 0 ? (
            <p className="text-sm leading-6 text-[#65706f]">
              No moderator actions recorded yet.
            </p>
          ) : (
            incident.actions.map((action) => (
              <div
                key={action.id}
                className="flex items-start justify-between gap-3 border-b border-[#ece4d8] pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-bold text-[#1d2525]">
                    {action.detail}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7b6760]">
                    u/{action.actor}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#7b6760]">
                  {formatTime(action.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
};

const ActionButton = ({
  label,
  disabled,
  loading,
  compact,
  variant = 'primary',
  onClick,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
}) => (
  <button
    className={`${compact ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-sm'} rounded-md font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${
      variant === 'primary'
        ? 'bg-[#e6402a] text-white hover:bg-[#c73322]'
        : 'border border-[#c9c1b5] bg-white text-[#1d2525] hover:border-[#1d2525]'
    }`}
    disabled={disabled}
    onClick={onClick}
  >
    {loading ? 'Working...' : label}
  </button>
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
  <Panel>
    <h2 className="text-2xl font-black">No active incidents</h2>
    <p className="mt-3 max-w-[680px] text-sm leading-6 text-[#65706f]">
      Firewatch is ready. It will score comment velocity, reports, keyword
      matches, suspicious domains, repeated phrases, branch pile-ons, removal
      clusters, and manual escalations.
    </p>
    <button
      className="mt-5 h-10 rounded-md bg-[#e6402a] px-4 text-sm font-bold text-white transition hover:bg-[#c73322] disabled:cursor-not-allowed disabled:opacity-55"
      disabled={busy}
      onClick={onCreateDemo}
    >
      {busy ? 'Seeding demo...' : 'Create demo incident'}
    </button>
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <Metric label="Heat" value={String(config.heatThreshold)} />
      <Metric label="Fire" value={String(config.fireThreshold)} />
      <Metric label="Wildfire" value={String(config.wildfireThreshold)} />
    </div>
  </Panel>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-[#e6ded2] bg-[#fbfaf7] p-4">
    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7b6760]">
      {label}
    </p>
    <p className="mt-2 text-3xl font-black text-[#1d2525]">{value}</p>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
