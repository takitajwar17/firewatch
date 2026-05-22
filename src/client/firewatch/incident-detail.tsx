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
import {
  FlaggedCommentsCard,
  RepeatedPhrasesCard,
} from './incident-comments';
import {
  IncidentHero,
  IncidentIntro,
  ParticipantsCard,
  ResponseCard,
  RiskReasonsCard,
  TrendCard,
} from './incident-overview';
import { FilterHelpCard, SettingsCard } from './incident-settings';
import type {
  ActionRunner,
  ConfigSaveHandler,
} from './types';
import type { FirewatchConfig, Incident } from '../../shared/api';

export const IncidentDetail = ({
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
  onSaveConfig: ConfigSaveHandler;
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [cleanupReason, setCleanupReason] = useState('Rule-breaking comment');
  const unresolvedComments = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );

  const runModAction: ActionRunner = async (action, endpoint, body) => {
    const updatedIncident = await onAction(action, endpoint, body);
    if (!updatedIncident) return undefined;

    if (action === 'escalate' || action === 'resolve') {
      setActiveTab('reports');
    }

    if (
      action.startsWith('t1_') ||
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
          description="Comments that still need approval, removal, or a ban decision."
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
            description="Approve acceptable comments, remove rule-breaking comments, or ban users."
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
