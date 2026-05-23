import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SectionHeader } from './common';
import {
  ActionLogCard,
  LatestSignalsCard,
  SummariesCard,
} from './incident-activity';
import { formatUsername } from './format';
import { FlaggedCommentsCard, RepeatedPhrasesCard } from './incident-comments';
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
import {
  RedditCommentIcon,
  RedditListIcon,
  RedditReportIcon,
  RedditUsersIcon,
} from './reddit-icons';

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
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <IncidentIntro incident={incident} />

      <IncidentHero
        busyAction={busyAction}
        config={config}
        incident={incident}
        onAction={runModAction}
      />

      <div className="grid overflow-hidden rounded-lg border border-border bg-background sm:grid-cols-2 xl:grid-cols-4">
        <InsightItem
          description="Reports attached here"
          icon={<RedditReportIcon />}
          label="Reports"
          value={String(incident.stats.reportSignals)}
        />
        <InsightItem
          description="Waiting for a mod decision"
          icon={<RedditCommentIcon />}
          label="Comments"
          value={String(unresolvedComments.length)}
        />
        <InsightItem
          description="Authors in review"
          icon={<RedditUsersIcon />}
          label="Users"
          value={String(unresolvedUsers.size)}
        />
        <InsightItem
          description="Dense reply chains"
          icon={<RedditListIcon />}
          label="Reply clusters"
          value={String(incident.stats.branchPileOns)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          aria-label="Incident sections"
          className="no-scrollbar w-full max-w-full justify-start gap-1 overflow-x-auto overscroll-x-contain border-b border-border pb-2"
        >
          <TabsTrigger className="flex-none" value="overview">
            Post
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="comments">
            Comments
            {unresolvedComments.length > 0
              ? ` (${unresolvedComments.length})`
              : ''}
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="signals">
            Activity
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="reports">
            Mod notes
          </TabsTrigger>
        </TabsList>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
          value="overview"
        >
          <SectionHeader
            className="xl:col-span-full"
            title="Post review"
            description="Signals, post tools, impact, and users."
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
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
          value="comments"
        >
          <SectionHeader
            className="xl:col-span-full"
            title="Comment review"
            description="Flagged comments and user actions."
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

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-2"
          value="signals"
        >
          <SectionHeader
            className="xl:col-span-full"
            title="Activity"
            description="Signals and mod actions in time order."
          />
          <LatestSignalsCard incident={incident} />
          <ActionLogCard incident={incident} />
        </TabsContent>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-2"
          value="reports"
        >
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

const InsightItem = ({
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
  <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border p-3 last:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0">
    <div className="min-w-0">
      <p className="text-xs font-semibold leading-4 text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground/85">
        {description}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
      <span className="[&_svg]:size-4">{icon}</span>
      <span className="text-base font-bold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  </div>
);
