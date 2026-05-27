import { useCallback, useMemo, useState } from 'react';
import { AutomationsPage } from './automations';
import {
  AccessDeniedBoard,
  EmptyBoard,
  ErrorBoard,
  FilteredQueueEmptyBoard,
  LoadingBoard,
} from './board-states';
import {
  isIncidentClaimedByCurrentUser,
  isTerminalStatus,
} from './format';
import { IncidentDetail } from './incident-detail';
import { CommunitySettingsPage } from './settings/community-settings-page';
import { FirewatchShell } from './shell/firewatch-shell';
import type { FirewatchView, QueueFilter } from './types';
import { useDashboard } from './use-dashboard';
import type {
  AccessDeniedResponse,
  FirewatchModeratorPermission,
} from '../../shared/api';
import { openCommentCount } from '../../shared/incidents';

const canConfigureFirewatch = (permissions: FirewatchModeratorPermission[]) =>
  permissions.includes('all') || permissions.includes('config');

export const App = () => {
  const [activeView, setActiveView] = useState<FirewatchView>('queue');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const {
    busyAction,
    createDemoIncident,
    data,
    disableAllRules,
    importRuleTemplates,
    loadState,
    notice,
    refresh,
    resetAppData,
    resetDemoIncidents,
    runAction,
    saveAutomation,
    saveDashboardConfig,
    selectedPostId,
    setSelectedPostId,
    testAutomation,
  } = useDashboard();
  const hasDemoIncidents = useMemo(
    () => data.incidents.some((incident) => Boolean(incident.demo)),
    [data.incidents]
  );
  const unresolvedIncidents = useMemo(
    () =>
      data.incidents.filter(
        (incident) =>
          openCommentCount(incident) > 0 || !isTerminalStatus(incident.status)
      ),
    [data.incidents]
  );
  const claimedUnresolvedIncidents = useMemo(
    () =>
      unresolvedIncidents.filter((incident) =>
        isIncidentClaimedByCurrentUser(incident, data.username)
      ),
    [data.username, unresolvedIncidents]
  );
  const resolvedIncidents = useMemo(
    () =>
      data.incidents.filter(
        (incident) =>
          isTerminalStatus(incident.status) && openCommentCount(incident) === 0
      ),
    [data.incidents]
  );
  const queueFilterCounts = useMemo(
    () => ({
      all: unresolvedIncidents.length,
      claimed: claimedUnresolvedIncidents.length,
      resolved: resolvedIncidents.length,
    }),
    [
      claimedUnresolvedIncidents.length,
      resolvedIncidents.length,
      unresolvedIncidents.length,
    ]
  );
  const filteredIncidents = useMemo(() => {
    if (queueFilter === 'claimed') {
      return claimedUnresolvedIncidents;
    }

    if (queueFilter === 'resolved') {
      return resolvedIncidents;
    }

    return unresolvedIncidents;
  }, [
    claimedUnresolvedIncidents,
    queueFilter,
    resolvedIncidents,
    unresolvedIncidents,
  ]);
  const queueSelectedIncident = useMemo(
    () =>
      filteredIncidents.find(
        (incident) => incident.postId === selectedPostId
      ) ?? filteredIncidents[0],
    [filteredIncidents, selectedPostId]
  );
  const configAccessDenied: AccessDeniedResponse | undefined =
    loadState.status === 'ready' &&
    !canConfigureFirewatch(data.moderatorPermissions)
      ? {
          type: 'access_denied',
          username: data.username,
          subredditName: data.subredditName,
          requiredPermissions: ['config'],
          grantedPermissions: data.moderatorPermissions,
          message: 'More mod access needed',
          detail:
            'Only mods who can change subreddit settings can open Firewatch settings and automations.',
        }
      : undefined;
  const selectIncident = useCallback((postId: string) => {
    setActiveView('queue');
    setSelectedPostId(postId);
  }, [setSelectedPostId]);

  if (loadState.status === 'error') {
    return (
      <FirewatchShell
        activeView={activeView}
        incidents={filteredIncidents}
        notice={undefined}
        queueFilter={queueFilter}
        queueFilterCounts={queueFilterCounts}
        selectedPostId={queueSelectedIncident?.postId}
        subredditName={data.subredditName}
        username={data.username}
        onQueueFilterChange={setQueueFilter}
        onRefresh={refresh}
        onSelectIncident={selectIncident}
        onViewChange={setActiveView}
      >
        <ErrorBoard message={loadState.message} onRefresh={refresh} />
      </FirewatchShell>
    );
  }

  if (loadState.status === 'access_denied') {
    return (
      <FirewatchShell
        activeView="queue"
        incidents={[]}
        notice={undefined}
        queueFilter={queueFilter}
        queueFilterCounts={{ all: 0, claimed: 0, resolved: 0 }}
        selectedPostId={undefined}
        subredditName={loadState.data.subredditName}
        username={loadState.data.username ?? 'anonymous'}
        onQueueFilterChange={setQueueFilter}
        onRefresh={refresh}
        onSelectIncident={selectIncident}
        onViewChange={setActiveView}
      >
        <AccessDeniedBoard access={loadState.data} onRefresh={refresh} />
      </FirewatchShell>
    );
  }

  return (
    <FirewatchShell
      activeView={activeView}
      incidents={filteredIncidents}
      notice={notice}
      queueFilter={queueFilter}
      queueFilterCounts={queueFilterCounts}
      selectedPostId={queueSelectedIncident?.postId}
      subredditName={data.subredditName}
      username={data.username}
      loading={loadState.status === 'loading'}
      onQueueFilterChange={setQueueFilter}
      onRefresh={refresh}
      onSelectIncident={selectIncident}
      onViewChange={setActiveView}
    >
      {loadState.status === 'loading' ? (
        <LoadingBoard />
      ) : configAccessDenied &&
        (activeView === 'automations' || activeView === 'settings') ? (
        <AccessDeniedBoard access={configAccessDenied} onRefresh={refresh} />
      ) : activeView === 'automations' ? (
        <AutomationsPage
          busyAction={busyAction}
          ruleLogs={data.ruleLogs}
          rules={data.rules}
          subredditName={data.subredditName}
          onDisableAllRules={disableAllRules}
          onImportRuleTemplates={importRuleTemplates}
          onSaveRule={saveAutomation}
          onTestRule={testAutomation}
        />
      ) : activeView === 'settings' ? (
        <CommunitySettingsPage
          busyAction={busyAction}
          config={data.config}
          hasDemoIncidents={hasDemoIncidents}
          onCreateDemo={createDemoIncident}
          onResetApp={resetAppData}
          onResetDemos={resetDemoIncidents}
          onSaveConfig={saveDashboardConfig}
        />
      ) : queueSelectedIncident ? (
        <IncidentDetail
          key={queueSelectedIncident.postId}
          busyAction={busyAction}
          config={data.config}
          incident={queueSelectedIncident}
          postFlairOptions={data.postFlairOptions}
          username={data.username}
          onAction={runAction}
        />
      ) : queueFilter !== 'all' ? (
        <FilteredQueueEmptyBoard filter={queueFilter} />
      ) : (
        <EmptyBoard
          busy={busyAction === 'demo'}
          onCreateDemo={createDemoIncident}
        />
      )}
    </FirewatchShell>
  );
};
