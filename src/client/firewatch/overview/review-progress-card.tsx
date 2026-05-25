import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EmptyText } from '../common';
import { clampScore, formatTime } from '../format';
import type { Incident } from '../../../shared/api';

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const ImpactSnapshotCard = ({ incident }: { incident: Incident }) => {
  const impact = incident.impact;
  const rows = [
    {
      label: 'Comments reviewed',
      value: String(impact.commentsReviewed),
      detail: `${impact.commentsAwaitingReview} waiting`,
    },
    {
      label: 'Users handled',
      value: String(impact.usersHandled),
      detail: `${impact.usersInReview} in review`,
    },
    {
      label: 'Actions taken',
      value: String(impact.actionsTaken),
      detail: `${impact.approvals} approved, ${impact.removals} removed, ${impact.bans} banned`,
    },
  ];

  return (
    <Card className="h-full" size="sm">
      <CardHeader>
        <CardTitle>Review progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="rounded-md border bg-background">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">{row.label}</p>
                <p className="truncate text-xs leading-5 text-muted-foreground">
                  {row.detail}
                </p>
              </div>
              <span className="shrink-0 text-lg font-semibold leading-none tabular-nums">
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">
            Open {formatDuration(impact.timeOpenMinutes)}
          </Badge>
          <Badge variant="outline">Peak score {impact.peakAttention}/100</Badge>
          {impact.handoffSaved ? (
            <Badge variant="secondary">Handoff saved</Badge>
          ) : null}
          {impact.finalNoteSaved ? (
            <Badge variant="secondary">Final note saved</Badge>
          ) : null}
        </div>
        <ScoreHistoryBlock className="mt-auto" incident={incident} />
      </CardContent>
    </Card>
  );
};

const ScoreHistoryBlock = ({
  className,
  incident,
}: {
  className?: string;
  incident: Incident;
}) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <p className="text-sm font-semibold leading-5">Review score history</p>
    {incident.trend.length === 0 ? (
      <EmptyText>No score history yet.</EmptyText>
    ) : (
      <div className="flex h-28 items-stretch gap-2 rounded-md border bg-background p-3">
        {incident.trend.map((point) => (
          <div
            key={point.timestamp}
            className="flex min-w-0 flex-1 flex-col gap-2"
            title={`${formatTime(point.timestamp)} review score ${point.score}`}
          >
            <div className="flex min-h-0 flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-primary"
                style={{ height: `${Math.max(8, clampScore(point.score))}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold leading-none text-muted-foreground">
              {formatTime(point.timestamp)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);
