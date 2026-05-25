import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlaybookButton } from '../common';
import {
  formatTime,
  formatUsername,
  isTerminalStatus,
} from '../format';
import { openRedditUrlInNewTab } from '../navigation';
import {
  RedditApproveIcon,
  RedditCommentIcon,
  RedditLinkIcon,
  RedditRefreshIcon,
  RedditShieldIcon,
  RedditUsersIcon,
} from '../reddit-icons';
import type { ActionRunner } from '../types';
import type { FirewatchConfig, Incident } from '../../../shared/api';
import { undoActionLabel } from '../../../shared/reddit-actions';

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
  const claimAction = incident.claim ? 'unclaim' : 'claim';
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;
  const latestAction = incident.actions.find(
    (action) => action.type !== 'demo_seeded'
  );
  const undoLabel = latestAction
    ? undoActionLabel(latestAction.type)
    : undefined;
  const [confirmUndoActionId, setConfirmUndoActionId] = useState<
    string | undefined
  >();
  const confirmUndo = Boolean(
    latestAction && confirmUndoActionId === latestAction.id
  );
  const undoActionId = latestAction ? `undo:${latestAction.id}` : undefined;
  const undoLatestAction = () => {
    if (!latestAction || !undoActionId) return;
    if (!confirmUndo) {
      setConfirmUndoActionId(latestAction.id);
      return;
    }

    setConfirmUndoActionId(undefined);
    void onAction(
      undoActionId,
      `/api/incidents/${incident.postId}/actions/${latestAction.id}/undo`
    );
  };

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
            disabled={Boolean(busyAction) || terminal}
            icon={<RedditUsersIcon data-icon="inline-start" />}
            label={incident.claim ? 'Unclaim' : 'Claim'}
            loading={busyAction === claimAction}
            onClick={() =>
              onAction(
                claimAction,
                `/api/incidents/${incident.postId}/${claimAction}`
              )
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
        {latestAction ? (
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
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
              {undoLabel && undoActionId ? (
                <Button
                  className="shrink-0"
                  disabled={Boolean(busyAction)}
                  size="sm"
                  title={undoLabel}
                  variant={confirmUndo ? 'destructive' : 'ghost'}
                  onClick={undoLatestAction}
                >
                  <RedditRefreshIcon data-icon="inline-start" />
                  {busyAction === undoActionId
                    ? 'Working'
                    : confirmUndo
                      ? 'Confirm undo'
                      : 'Undo'}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
