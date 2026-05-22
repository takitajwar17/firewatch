import { useState } from 'react';
import {
  ClipboardList,
  Gauge,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard, SectionHeader } from './common';
import {
  ActionLogCard,
  LatestSignalsCard,
  SummariesCard,
} from './incident-activity';
import { formatUsername } from './format';
import {
  FlaggedCommentsCard,
  RepeatedPhrasesCard,
} from './incident-comments';
import {
  ImpactSnapshotCard,
  IncidentHero,
  IncidentIntro,
  NativePostControlsCard,
  ParticipantsCard,
  ResponseCard,
  RiskReasonsCard,
  TrendCard,
} from './incident-overview';
import type { ActionRunner } from './types';
import type { FirewatchConfig, Incident } from '../../shared/api';

export const IncidentDetail = ({
  busyAction,
  config,
  incident,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  onAction: ActionRunner;
}) => {
  const unresolvedComments = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );
  const unresolvedUsers = new Set(
    unresolvedComments
      .map((comment) => formatUsername(comment.author))
      .filter((author) => author !== 'unknown user')
  );
  const [activeTab, setActiveTab] = useState(
    unresolvedComments.length > 0 ? 'comments' : 'overview'
  );
  const [cleanupReason, setCleanupReason] = useState('Rule-breaking comment');

  const runModAction: ActionRunner = async (action, endpoint, body) => {
    const updatedIncident = await onAction(action, endpoint, body);
    if (!updatedIncident) return undefined;

    if (action === 'escalate' || action === 'resolve') {
      setActiveTab('reports');
    }

    if (
      action.startsWith('t1_') ||
      action.startsWith('remove:') ||
      action.startsWith('approve:') ||
      action.startsWith('ban:')
    ) {
      setActiveTab('comments');
    }

    return updatedIncident;
  };

  return (
    <div className="flex flex-col gap-5">
      <IncidentIntro incident={incident} />

      <SectionHeader
        title="What needs attention"
        description="Reports, comments, users, and reply clusters for this post."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description="Post and comment reports attached here."
          icon={<ShieldAlert />}
          label="Reports"
          value={String(incident.stats.reportSignals)}
        />
        <MetricCard
          description="Waiting for approve, remove, or ban user."
          icon={<ClipboardList />}
          label="Comments"
          value={String(unresolvedComments.length)}
        />
        <MetricCard
          description="Authors with comments waiting for review."
          icon={<Users />}
          label="Users"
          value={String(unresolvedUsers.size)}
        />
        <MetricCard
          description="Dense reply chains that can heat up quickly."
          icon={<Gauge />}
          label="Reply clusters"
          value={String(incident.stats.branchPileOns)}
        />
      </div>

      <IncidentHero
        busyAction={busyAction}
        config={config}
        incident={incident}
        onAction={runModAction}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          aria-label="Incident sections"
          className="w-full justify-start overflow-x-auto"
        >
          <TabsTrigger value="overview">Post</TabsTrigger>
          <TabsTrigger value="comments">
            Comments
            {unresolvedComments.length > 0
              ? ` (${unresolvedComments.length})`
              : ''}
          </TabsTrigger>
          <TabsTrigger value="signals">Activity</TabsTrigger>
          <TabsTrigger value="reports">Mod notes</TabsTrigger>
        </TabsList>

        <TabsContent
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
          value="overview"
        >
          <SectionHeader
            className="xl:col-span-full"
            title="Post review"
            description="Signals, post tools, impact, and users still attached to review work."
          />
          <div className="flex flex-col gap-4">
            <RiskReasonsCard incident={incident} />
            <NativePostControlsCard
              busyAction={busyAction}
              config={config}
              incident={incident}
              onAction={runModAction}
            />
            <TrendCard incident={incident} />
          </div>
          <div className="flex flex-col gap-4">
            <ImpactSnapshotCard incident={incident} />
            <ResponseCard incident={incident} />
            <ParticipantsCard incident={incident} />
          </div>
        </TabsContent>

        <TabsContent
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
          value="comments"
        >
          <SectionHeader
            className="xl:col-span-full"
            title="Comment review"
            description="Review flagged comments and use user actions when needed."
          />
          <FlaggedCommentsCard
            busyAction={busyAction}
            config={config}
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
            description="Signals and mod actions in time order."
          />
          <LatestSignalsCard incident={incident} />
          <ActionLogCard incident={incident} />
        </TabsContent>

        <TabsContent className="grid gap-4 xl:grid-cols-2" value="reports">
          <SectionHeader
            className="xl:col-span-full"
            title="Mod notes"
            description="Handoff and final notes."
          />
          <SummariesCard incident={incident} />
          <ActionLogCard incident={incident} compact />
        </TabsContent>
      </Tabs>
    </div>
  );
};
