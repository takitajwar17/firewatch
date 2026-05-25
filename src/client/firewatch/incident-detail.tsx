import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ActionLogCard,
  HandoffActionCard,
  LatestSignalsCard,
  SummariesCard,
} from './incident-activity';
import { PlaybookButton } from './common';
import { FlaggedCommentsCard } from './comments/flagged-comments-card';
import { RepeatedPhrasesCard } from './comments/repeated-phrases-card';
import { IncidentHero } from './overview/mod-actions-card';
import { IncidentIntro } from './overview/post-header';
import { NativePostControlsCard } from './overview/post-tools-card';
import { ImpactSnapshotCard } from './overview/review-progress-card';
import {
  EvidenceCapsuleCard,
  ParticipantsCard,
  ResponseCard,
  RiskReasonsCard,
  SafetyReviewCard,
} from './overview/review-sidecards';
import { MatchedRulesCard } from './incident-rules';
import {
  claimGateMessage,
  formatUsername,
  isIncidentClaimedByCurrentUser,
} from './format';
import { RedditUsersIcon } from './reddit-icons';
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
  username,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  postFlairOptions: PostFlairOption[];
  username: string;
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
  const actionLocked = !isIncidentClaimedByCurrentUser(incident, username);
  const actionLockReason = claimGateMessage(incident);
  const claimedByAnotherMod = Boolean(incident.claim) && actionLocked;

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

      {actionLocked ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-muted/25 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5">
              A moderator needs to claim this before actions.
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {claimedByAnotherMod
                ? `${formatUsername(incident.claim?.username)} has the claim. Only that moderator can perform actions.`
                : 'Claim this post to perform removals, approvals, automations, handoff, or undo.'}
            </p>
          </div>
          <PlaybookButton
            className="w-full shrink-0 sm:w-fit"
            disabled={Boolean(busyAction) || claimedByAnotherMod}
            icon={<RedditUsersIcon data-icon="inline-start" />}
            label={
              claimedByAnotherMod
                ? `Claimed by ${formatUsername(incident.claim?.username)}`
                : 'Claim post'
            }
            loading={busyAction === 'claim'}
            title={claimedByAnotherMod ? actionLockReason : undefined}
            onClick={() =>
              runModAction(
                'claim',
                `/api/incidents/${incident.postId}/claim`
              )
            }
          />
        </section>
      ) : null}

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
            <EvidenceCapsuleCard incident={incident} />
            <IncidentHero
              actionLocked={actionLocked}
              actionLockReason={actionLockReason}
              busyAction={busyAction}
              config={config}
              incident={incident}
              username={username}
              onReviewComments={() => setActiveTab('comments')}
              onAction={runModAction}
            />
            <NativePostControlsCard
              actionLocked={actionLocked}
              actionLockReason={actionLockReason}
              busyAction={busyAction}
              config={config}
              incident={incident}
              postFlairOptions={postFlairOptions}
              onAction={runModAction}
            />
            <MatchedRulesCard
              actionLocked={actionLocked}
              actionLockReason={actionLockReason}
              busyAction={busyAction}
              incident={incident}
              onAction={runModAction}
            />
            <RiskReasonsCard incident={incident} />
          </div>
          <div className="flex flex-col gap-3">
            <SafetyReviewCard incident={incident} />
            <ResponseCard incident={incident} />
            <ParticipantsCard
              actionLocked={actionLocked}
              actionLockReason={actionLockReason}
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
            actionLocked={actionLocked}
            actionLockReason={actionLockReason}
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
          <ActionLogCard
            actionLocked={actionLocked}
            actionLockReason={actionLockReason}
            busyAction={busyAction}
            incident={incident}
            onAction={runModAction}
          />
        </TabsContent>

        <TabsContent
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4"
          value="notes"
        >
          <HandoffActionCard
            actionLocked={actionLocked}
            actionLockReason={actionLockReason}
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
