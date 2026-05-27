import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EmptyText, PlaybookButton } from './common';
import {
  copyTextToClipboard,
  formatSignalDetail,
  formatSignalType,
  formatTime,
  formatUsername,
} from './format';
import type { ActionRunner } from './types';
import type { Incident } from '../../shared/api';
import {
  RedditCopyIcon,
  RedditRefreshIcon,
  RedditShieldIcon,
} from './reddit-icons';
import { UsernameHistoryTrigger } from './username-history';
import { actionCompleted, undoActionLabel } from '../../shared/reddit-actions';

export const LatestSignalsCard = ({ incident }: { incident: Incident }) => {
  const visibleSignals = incident.recentSignals;
  const shownSignals = visibleSignals.slice(0, 16);
  const hiddenSignals = Math.max(0, visibleSignals.length - shownSignals.length);
  const omittedSignals = incident.stats.signalsOmitted ?? 0;
  const hiddenSignalParts = [
    hiddenSignals > 0
      ? `${hiddenSignals} older activity item${hiddenSignals === 1 ? '' : 's'} hidden in this view`
      : undefined,
    omittedSignals > 0
      ? `${omittedSignals} older signal${omittedSignals === 1 ? '' : 's'} dropped from storage`
      : undefined,
  ].filter((part): part is string => Boolean(part));

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Reddit activity</CardTitle>
      </CardHeader>
      <CardContent>
        {visibleSignals.length === 0 ? (
          <EmptyText>No Reddit activity yet.</EmptyText>
        ) : (
          <ScrollArea className="pr-0 sm:max-h-[460px] sm:pr-3">
            <div className="flex flex-col">
              {shownSignals.map((signal, index) => (
                <div key={signal.id} className="content-visibility-list-item">
                  {index > 0 ? <Separator /> : null}
                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-1.5 break-words text-sm font-semibold leading-5">
                        {formatSignalType(signal)}
                        {signal.author ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="text-muted-foreground/70"
                            >
                              ·
                            </span>
                            <UsernameHistoryTrigger
                              className="text-sm"
                              incident={incident}
                              username={signal.author}
                            />
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {formatSignalDetail(signal)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                      {formatTime(signal.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
              {hiddenSignalParts.length > 0 ? (
                <>
                  <Separator />
                  <p className="py-3 text-xs leading-5 text-muted-foreground">
                    {hiddenSignalParts.join('. ')}.
                  </p>
                </>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export const SummariesCard = ({ incident }: { incident: Incident }) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Handoff notes</CardTitle>
    </CardHeader>
    <CardContent>
      {incident.escalationSummary || incident.summary ? (
        <div className="flex flex-col gap-3">
          {incident.escalationSummary ? (
            <SummaryBlock label="Handoff" value={incident.escalationSummary} />
          ) : null}
          {incident.summary ? (
            <SummaryBlock label="Closeout" value={incident.summary} />
          ) : null}
        </div>
      ) : (
        <EmptyText>No handoff saved yet.</EmptyText>
      )}
    </CardContent>
  </Card>
);

export const HandoffActionCard = ({
  actionLocked,
  actionLockReason,
  busyAction,
  canSaveHandoff,
  incident,
  onAction,
}: {
  actionLocked: boolean;
  actionLockReason: string;
  busyAction: string | undefined;
  canSaveHandoff: boolean;
  incident: Incident;
  onAction: ActionRunner;
}) => (
  <Card size="sm">
    <CardHeader>
      <CardTitle>Handoff</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <p className="text-sm leading-5 text-muted-foreground">
        Generate a mod note with the review reasons, open comments, matched
        automations, and recent actions.
      </p>
      <PlaybookButton
        className="w-full sm:w-fit"
        disabled={Boolean(busyAction) || actionLocked || !canSaveHandoff}
        icon={<RedditShieldIcon data-icon="inline-start" />}
        label={
          incident.escalationSummary ? 'Refresh handoff' : 'Generate handoff'
        }
        loading={busyAction === 'escalate'}
        loadingLabel="Generating"
        title={actionLocked ? actionLockReason : undefined}
        variant="secondary"
        onClick={() =>
          onAction('escalate', `/api/incidents/${incident.postId}/escalate`)
        }
      />
    </CardContent>
  </Card>
);

const SummaryBlock = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      const didCopy = await copyTextToClipboard(value);
      if (!didCopy) return;

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{label}</Badge>
        <Button size="sm" variant="outline" onClick={onCopy}>
          <RedditCopyIcon data-icon="inline-start" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto rounded-md border bg-card p-3 text-xs leading-6 text-foreground">
        {value}
      </pre>
    </div>
  );
};

export const ActionLogCard = ({
  actionLocked = false,
  actionLockReason,
  busyAction,
  compact,
  incident,
  onAction,
}: {
  actionLocked?: boolean;
  actionLockReason?: string;
  busyAction?: string | undefined;
  compact?: boolean;
  incident: Incident;
  onAction?: ActionRunner | undefined;
}) => {
  const [confirmUndoActionId, setConfirmUndoActionId] = useState<
    string | undefined
  >();
  const latestUndoableAction = incident.actions.find(
    (action) => actionCompleted(action) && undoActionLabel(action.type)
  );

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Mod log</CardTitle>
      </CardHeader>
      <CardContent>
        {incident.actions.length === 0 ? (
          <EmptyText>No mod actions yet.</EmptyText>
        ) : (
          <ScrollArea
            className={cn(
              compact ? 'sm:max-h-[360px]' : 'sm:max-h-[460px]',
              'pr-0 sm:pr-3'
            )}
          >
            <div className="flex flex-col">
              {incident.actions.map((action, index) => {
                const completed = actionCompleted(action);
                const undoLabel = completed
                  ? undoActionLabel(action.type)
                  : undefined;
                const canUndo =
                  Boolean(onAction) &&
                  Boolean(undoLabel) &&
                  latestUndoableAction?.id === action.id;
                const undoActionId = `undo:${action.id}`;
                const confirmUndo = confirmUndoActionId === action.id;

                return (
                  <div key={action.id} className="content-visibility-list-item">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-5">
                          {action.detail}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {formatUsername(action.actor)} ·{' '}
                          {formatTime(action.createdAt)}
                          {action.status === 'pending' ? ' · pending' : ''}
                          {action.status === 'failed' ? ' · failed' : ''}
                        </p>
                        {action.error ? (
                          <p className="mt-1 text-xs leading-5 text-destructive">
                            {action.error}
                          </p>
                        ) : null}
                      </div>
                      {canUndo && onAction ? (
                        <Button
                          className="shrink-0"
                          disabled={Boolean(busyAction) || actionLocked}
                          size="sm"
                          title={actionLocked ? actionLockReason : undoLabel}
                          variant={confirmUndo ? 'destructive' : 'ghost'}
                          onClick={() => {
                            if (!confirmUndo) {
                              setConfirmUndoActionId(action.id);
                              return;
                            }

                            setConfirmUndoActionId(undefined);
                            void onAction(
                              undoActionId,
                              `/api/incidents/${incident.postId}/actions/${action.id}/undo`
                            );
                          }}
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
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
