import type { ReactNode } from 'react';
import type { Incident } from '../../../shared/api';
import type {
  FirewatchView,
  Notice,
  QueueFilter,
  QueueFilterCounts,
} from '../types';
import { CommandPanel } from './command-panel';
import { MobileIncidentStrip } from './incident-queue-item';
import { NoticeToast } from './notice-toast';
import { WorkspaceHeader } from './workspace-header';

export const FirewatchShell = ({
  activeView,
  children,
  incidents,
  loading = false,
  notice,
  queueFilter,
  queueFilterCounts,
  selectedPostId,
  subredditName,
  username,
  onQueueFilterChange,
  onRefresh,
  onSelectIncident,
  onViewChange,
}: {
  activeView: FirewatchView;
  children: ReactNode;
  incidents: Incident[];
  loading?: boolean;
  notice: Notice | undefined;
  queueFilter: QueueFilter;
  queueFilterCounts: QueueFilterCounts;
  selectedPostId: string | undefined;
  subredditName: string;
  username: string;
  onQueueFilterChange: (filter: QueueFilter) => void;
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
        loading={loading}
        queueFilter={queueFilter}
        queueFilterCounts={queueFilterCounts}
        selectedPostId={selectedPostId}
        subredditName={subredditName}
        username={username}
        onQueueFilterChange={onQueueFilterChange}
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
        <main className="flex min-h-0 min-w-0 flex-1 justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-background px-2 py-0 sm:px-4 lg:px-5">
          <div className="flex min-w-0 w-full max-w-[1440px] flex-col gap-3 py-3 sm:py-4">
            {activeView === 'queue' ? (
              <MobileIncidentStrip
                incidents={incidents}
                loading={loading}
                queueFilter={queueFilter}
                queueFilterCounts={queueFilterCounts}
                selectedPostId={selectedPostId}
                onQueueFilterChange={onQueueFilterChange}
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
