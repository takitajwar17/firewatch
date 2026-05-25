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
import { RedditCopyIcon, RedditShieldIcon } from './reddit-icons';

export const LatestSignalsCard = ({ incident }: { incident: Incident }) => {
  const visibleSignals = incident.recentSignals;

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
              {visibleSignals.slice(0, 16).map((signal, index) => (
                <div key={signal.id} className="content-visibility-list-item">
                  {index > 0 ? <Separator /> : null}
                  <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold capitalize leading-5">
                        {formatSignalType(signal)}
                        {signal.author
                          ? ` · ${formatUsername(signal.author)}`
                          : ''}
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
  busyAction,
  canSaveHandoff,
  incident,
  onAction,
}: {
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
        disabled={Boolean(busyAction) || !canSaveHandoff}
        icon={<RedditShieldIcon data-icon="inline-start" />}
        label={
          incident.escalationSummary ? 'Refresh handoff' : 'Generate handoff'
        }
        loading={busyAction === 'escalate'}
        loadingLabel="Generating"
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
  compact,
  incident,
}: {
  compact?: boolean;
  incident: Incident;
}) => (
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
            {incident.actions.map((action, index) => (
              <div key={action.id} className="content-visibility-list-item">
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-5">
                      {action.detail}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {formatUsername(action.actor)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs leading-5 text-muted-foreground">
                    {formatTime(action.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);
