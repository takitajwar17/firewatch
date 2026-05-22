import { useState } from 'react';
import { EmptyBoard, ErrorBoard, LoadingBoard } from './board-states';
import { CommunitySettingsPage } from './community-settings';
import { IncidentDetail } from './incident-detail';
import { FirewatchShell } from './shell';
import type { FirewatchView } from './types';
import { useDashboard } from './use-dashboard';

export const App = () => {
  const [activeView, setActiveView] = useState<FirewatchView>('queue');
  const {
    busyAction,
    createDemoIncident,
    data,
    loadState,
    notice,
    refresh,
    resetDemoIncidents,
    runAction,
    saveDashboardConfig,
    selectedIncident,
    selectedPostId,
    setSelectedPostId,
  } = useDashboard();
  const hasDemoIncidents = data.incidents.some((incident) =>
    Boolean(incident.demo)
  );
  const selectIncident = (postId: string) => {
    setActiveView('queue');
    setSelectedPostId(postId);
  };

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
      onRefresh={refresh}
      onSelectIncident={selectIncident}
      onViewChange={setActiveView}
    >
      {loadState.status === 'loading' ? (
        <LoadingBoard />
      ) : activeView === 'settings' ? (
        <CommunitySettingsPage
          busyAction={busyAction}
          config={data.config}
          hasDemoIncidents={hasDemoIncidents}
          onCreateDemo={createDemoIncident}
          onResetDemos={resetDemoIncidents}
          onSaveConfig={saveDashboardConfig}
        />
      ) : selectedIncident ? (
        <IncidentDetail
          key={selectedIncident.postId}
          busyAction={busyAction}
          config={data.config}
          incident={selectedIncident}
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
