import { EmptyBoard, ErrorBoard, LoadingBoard } from './board-states';
import { IncidentDetail } from './incident-detail';
import { FirewatchShell } from './shell';
import { useDashboard } from './use-dashboard';

export const App = () => {
  const {
    busyAction,
    createDemoIncident,
    data,
    loadState,
    notice,
    refresh,
    runAction,
    saveDashboardConfig,
    selectedIncident,
    selectedPostId,
    setSelectedPostId,
  } = useDashboard();

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
        <ErrorBoard message={loadState.message} onRefresh={refresh} />
      </FirewatchShell>
    );
  }

  return (
    <FirewatchShell
      busyAction={busyAction}
      incidents={data.incidents}
      notice={notice}
      selectedPostId={selectedIncident?.postId ?? selectedPostId}
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
