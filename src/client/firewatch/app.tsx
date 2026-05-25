import { useCallback, useMemo, useState } from 'react';
import { AutomationsPage } from './automations';
import { EmptyBoard, ErrorBoard, LoadingBoard } from './board-states';
import { IncidentDetail } from './incident-detail';
import { CommunitySettingsPage } from './settings/community-settings-page';
import { FirewatchShell } from './shell/firewatch-shell';
import type { FirewatchView } from './types';
import { useDashboard } from './use-dashboard';

export const App = () => {
  const [activeView, setActiveView] = useState<FirewatchView>('queue');
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
    selectedIncident,
    selectedPostId,
    setSelectedPostId,
    testAutomation,
  } = useDashboard();
  const hasDemoIncidents = useMemo(
    () => data.incidents.some((incident) => Boolean(incident.demo)),
    [data.incidents]
  );
  const selectIncident = useCallback((postId: string) => {
    setActiveView('queue');
    setSelectedPostId(postId);
  }, [setSelectedPostId]);

  if (loadState.status === 'error') {
    return (
      <FirewatchShell
        activeView={activeView}
        incidents={data.incidents}
        notice={undefined}
        selectedPostId={selectedIncident?.postId}
        subredditName={data.subredditName}
        username={data.username}
        onRefresh={refresh}
        onSelectIncident={selectIncident}
        onViewChange={setActiveView}
      >
        <ErrorBoard message={loadState.message} onRefresh={refresh} />
      </FirewatchShell>
    );
  }

  return (
    <FirewatchShell
      activeView={activeView}
      incidents={data.incidents}
      notice={notice}
      selectedPostId={selectedIncident?.postId ?? selectedPostId}
      subredditName={data.subredditName}
      username={data.username}
      loading={loadState.status === 'loading'}
      onRefresh={refresh}
      onSelectIncident={selectIncident}
      onViewChange={setActiveView}
    >
      {loadState.status === 'loading' ? (
        <LoadingBoard />
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
      ) : selectedIncident ? (
        <IncidentDetail
          key={selectedIncident.postId}
          busyAction={busyAction}
          config={data.config}
          incident={selectedIncident}
          postFlairOptions={data.postFlairOptions}
          username={data.username}
          onAction={runAction}
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
