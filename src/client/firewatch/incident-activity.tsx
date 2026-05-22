import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EmptyText } from './common';
import {
  copyTextToClipboard,
  formatSignalDetail,
  formatSignalType,
  formatTime,
  formatUsername,
} from './format';
import type { Incident } from '../../shared/api';

export const LatestSignalsCard = ({ incident }: { incident: Incident }) => {
  const visibleSignals = incident.recentSignals;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Reports, user comments, post edits, and mod sends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visibleSignals.length === 0 ? (
          <EmptyText>No recent activity yet.</EmptyText>
        ) : (
          <ScrollArea className="max-h-[460px] pr-3">
            <div className="flex flex-col">
              {visibleSignals.slice(0, 16).map((signal, index) => (
                <div key={signal.id}>
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize leading-5">
                        {formatSignalType(signal)}
                        {signal.author
                          ? ` - ${formatUsername(signal.author)}`
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
  <Card>
    <CardHeader>
      <CardTitle>Mod notes</CardTitle>
      <CardDescription>
        {incident.summary && incident.stats.flaggedCount > 0
          ? 'Final note saved earlier. Review remaining comments before closing again.'
          : incident.summary
            ? 'Final note saved. Copy it if this incident reopens.'
            : incident.escalationSummary
              ? 'Handoff saved. Mark handled after the review queue is clear.'
              : 'Handoff and final notes generated from this post.'}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {incident.escalationSummary || incident.summary ? (
        <div className="flex flex-col gap-3">
          {incident.escalationSummary ? (
            <SummaryBlock label="Handoff" value={incident.escalationSummary} />
          ) : null}
          {incident.summary ? (
            <SummaryBlock label="Final note" value={incident.summary} />
          ) : null}
        </div>
      ) : (
        <EmptyText>
          Save a handoff note for the mod team. Mark handled to save a final
          note after the review queue is clear.
        </EmptyText>
      )}
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
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{label}</Badge>
        <Button size="sm" variant="outline" onClick={onCopy}>
          <Copy data-icon="inline-start" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto rounded-lg border bg-background p-3 text-xs leading-6 text-foreground">
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
  <Card>
    <CardHeader>
      <CardTitle>Mod log</CardTitle>
      <CardDescription>Actions taken from this view.</CardDescription>
    </CardHeader>
    <CardContent>
      {incident.actions.length === 0 ? (
        <EmptyText>No mod actions yet.</EmptyText>
      ) : (
        <ScrollArea
          className={cn(compact ? 'max-h-[360px]' : 'max-h-[460px]', 'pr-3')}
        >
          <div className="flex flex-col">
            {incident.actions.map((action, index) => (
              <div key={action.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5">{action.detail}</p>
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
