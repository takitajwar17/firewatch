import { Button } from '@/components/ui/button';
import { PlaybookButton } from '../common';
import {
  formatTime,
  formatUsername,
  isTerminalStatus,
  pluralize,
} from '../format';
import { openRedditUrlInNewTab } from '../navigation';
import {
  RedditApproveIcon,
  RedditCommentIcon,
  RedditLinkIcon,
  RedditShieldIcon,
  RedditUsersIcon,
} from '../reddit-icons';
import type { ActionRunner } from '../types';
import type { FirewatchConfig, Incident } from '../../../shared/api';

export const IncidentHero = ({
  busyAction,
  config,
  incident,
  onReviewComments,
  onAction,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  onReviewComments: () => void;
  onAction: ActionRunner;
}) => {
  const terminal = isTerminalStatus(incident.status);
  const permalink = incident.permalink;
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;
  const latestAction = incident.actions.find(
    (action) => action.type !== 'demo_seeded'
  );

  return (
    <section className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold leading-5">Mod actions</h2>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {permalink ? (
            <Button
              variant="secondary"
              onClick={() => openRedditUrlInNewTab(permalink)}
            >
              <RedditLinkIcon data-icon="inline-start" />
              Open on Reddit
            </Button>
          ) : null}
          {unresolvedCount > 0 ? (
            <Button variant="outline" onClick={onReviewComments}>
              <RedditCommentIcon data-icon="inline-start" />
              Review comments
            </Button>
          ) : null}
          <PlaybookButton
            disabled={Boolean(incident.claim) || Boolean(busyAction) || terminal}
            icon={<RedditUsersIcon data-icon="inline-start" />}
            label={incident.claim ? 'Claimed' : 'Claim'}
            loading={busyAction === 'claim'}
            onClick={() =>
              onAction('claim', `/api/incidents/${incident.postId}/claim`)
            }
          />
          <PlaybookButton
            disabled={Boolean(busyAction) || !config.actionControls.handoffNotes}
            icon={<RedditShieldIcon data-icon="inline-start" />}
            label="Save handoff note"
            loading={busyAction === 'escalate'}
            variant="secondary"
            onClick={() =>
              onAction(
                'escalate',
                `/api/incidents/${incident.postId}/escalate`
              )
            }
          />
          <PlaybookButton
            disabled={
              Boolean(busyAction) ||
              terminal ||
              unresolvedCount > 0 ||
              !config.actionControls.markHandled
            }
            icon={<RedditApproveIcon data-icon="inline-start" />}
            label={
              terminal
                ? 'Handled'
                : unresolvedCount > 0
                  ? 'Review comments first'
                  : 'Mark handled'
            }
            loading={busyAction === 'resolve'}
            variant="ghost"
            onClick={() =>
              onAction('resolve', `/api/incidents/${incident.postId}/resolve`)
            }
          />
        </div>
        {unresolvedCount > 0 && !terminal ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {pluralize(unresolvedCount, 'comment')} still needs a decision.
          </p>
        ) : null}
        {latestAction ? (
          <div className="rounded-md border bg-background px-3 py-2">
            <p className="text-xs font-semibold leading-5 text-muted-foreground">
              Latest action
            </p>
            <p className="break-words text-sm leading-5">
              {latestAction.detail}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {formatUsername(latestAction.actor)} ·{' '}
              {formatTime(latestAction.createdAt)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
};
