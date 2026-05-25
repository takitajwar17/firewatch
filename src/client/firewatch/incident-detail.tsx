import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ActionLogCard,
  HandoffActionCard,
  LatestSignalsCard,
  SummariesCard,
} from './incident-activity';
import { FlaggedCommentsCard, RepeatedPhrasesCard } from './incident-comments';
import {
  ImpactSnapshotCard,
  IncidentHero,
  IncidentIntro,
  NativePostControlsCard,
  ParticipantsCard,
  ResponseCard,
  RiskReasonsCard,
} from './incident-overview';
import { MatchedRulesCard } from './incident-rules';
import type { ActionRunner } from './types';
import type {
  FirewatchConfig,
  Incident,
  PostFlairOption,
} from '../../shared/api';

export const IncidentDetail = ({
  busyAction,
  config,
  incident,
  postFlairOptions,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  postFlairOptions: PostFlairOption[];
  onAction: ActionRunner;
}) => {
  const unresolvedComments = useMemo(
    () =>
      incident.flaggedComments.filter(
        (comment) => !comment.removed && !comment.reviewed
      ),
    [incident.flaggedComments]
  );
  const [activeTab, setActiveTab] = useState('overview');

  const runModAction: ActionRunner = useCallback(
    async (action, endpoint, body) => {
      const updatedIncident = await onAction(action, endpoint, body);
      if (!updatedIncident) return undefined;

      if (action === 'escalate' || action === 'resolve') {
        setActiveTab('notes');
      }
      if (action.startsWith('rule:') || action.startsWith('clear-strikes:')) {
        setActiveTab('overview');
      }

      if (
        action.startsWith('t1_') ||
        action.startsWith('comment:') ||
        action.startsWith('user:') ||
        action.startsWith('remove:') ||
        action.startsWith('approve:') ||
        action.startsWith('ban:')
      ) {
        setActiveTab('comments');
      }

      return updatedIncident;
    },
    [onAction]
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <IncidentIntro incident={incident} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          aria-label="Post review sections"
          className="no-scrollbar w-full max-w-full justify-start gap-1 overflow-x-auto overscroll-x-contain border-b border-border pb-2"
        >
          <TabsTrigger className="flex-none" value="overview">
            Post review
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
          <TabsTrigger className="flex-none" value="notes">
            Handoff
          </TabsTrigger>
        </TabsList>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"
          value="overview"
        >
          <div className="flex flex-col gap-3">
            <IncidentHero
              busyAction={busyAction}
              config={config}
              incident={incident}
              onReviewComments={() => setActiveTab('comments')}
              onAction={runModAction}
            />
            <NativePostControlsCard
              busyAction={busyAction}
              config={config}
              incident={incident}
              postFlairOptions={postFlairOptions}
              onAction={runModAction}
            />
            <MatchedRulesCard
              busyAction={busyAction}
              incident={incident}
              onAction={runModAction}
            />
            <RiskReasonsCard incident={incident} />
          </div>
          <div className="flex flex-col gap-3">
            <ResponseCard incident={incident} />
            <ParticipantsCard
              busyAction={busyAction}
              incident={incident}
              onAction={runModAction}
            />
          </div>
        </TabsContent>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
          value="comments"
        >
          <FlaggedCommentsCard
            busyAction={busyAction}
            config={config}
            incident={incident}
            onAction={runModAction}
          />
          <RepeatedPhrasesCard incident={incident} />
        </TabsContent>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-2"
          value="signals"
        >
          <LatestSignalsCard incident={incident} />
          <ImpactSnapshotCard incident={incident} />
          <ActionLogCard incident={incident} />
        </TabsContent>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4"
          value="notes"
        >
          <HandoffActionCard
            busyAction={busyAction}
            canSaveHandoff={config.actionControls.handoffNotes}
            incident={incident}
            onAction={runModAction}
          />
          <SummariesCard incident={incident} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
