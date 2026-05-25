import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  FIREWATCH_DEMO_SCENARIOS,
} from '../../shared/firewatch-presets';
import { Skeleton } from './common';
import type { DemoCreateHandler } from './types';
import { RedditRefreshIcon, RedditReportIcon } from './reddit-icons';

export const LoadingBoard = () => (
  <div
    aria-busy="true"
    aria-label="Loading Firewatch review"
    className="flex min-w-0 flex-col gap-3 sm:gap-4"
  >
    <LoadingIncidentIntro />
    <div className="flex min-w-0 flex-col gap-3">
      <div className="no-scrollbar flex w-full max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-border pb-2">
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <LoadingPanel titleWidth="w-24" bodyHeight="h-16" />
          <LoadingPanel titleWidth="w-20" bodyHeight="h-20" />
          <LoadingPanel titleWidth="w-36" bodyHeight="h-28" />
          <LoadingPanel titleWidth="w-16" bodyHeight="h-32" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <LoadingPanel titleWidth="w-28" bodyHeight="h-32" />
          <LoadingPanel titleWidth="w-44" bodyHeight="h-44" />
        </div>
      </div>
    </div>
  </div>
);

const LoadingIncidentIntro = () => (
  <section className="overflow-hidden border-b border-border bg-background text-card-foreground">
    <div className="max-w-full py-3">
      <article className="min-w-0 max-w-full">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-14" />
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-2">
          <Skeleton className="h-7 w-full max-w-[38rem]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      </article>
    </div>
  </section>
);

const LoadingPanel = ({
  bodyHeight,
  titleWidth,
}: {
  bodyHeight: string;
  titleWidth: string;
}) => (
  <section className="rounded-md border border-border bg-background">
    <div className="border-b border-border px-3 py-2.5">
      <Skeleton className={`h-5 ${titleWidth}`} />
    </div>
    <div className="p-3">
      <Skeleton className={`w-full ${bodyHeight}`} />
    </div>
  </section>
);

export const ErrorBoard = ({
  message,
  onRefresh,
}: {
  message: string;
  onRefresh: () => void;
}) => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Alert variant="destructive" className="max-w-md">
      <RedditReportIcon />
      <AlertTitle>Could not load</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <Button className="mt-4 w-fit" variant="outline" onClick={onRefresh}>
        <RedditRefreshIcon data-icon="inline-start" />
        Retry
      </Button>
    </Alert>
  </div>
);

export const EmptyBoard = ({
  busy,
  onCreateDemo,
}: {
  busy: boolean;
  onCreateDemo: DemoCreateHandler;
}) => {
  const defaultScenario =
    FIREWATCH_DEMO_SCENARIOS.find(
      (scenario) => scenario.id === DEFAULT_DEMO_SCENARIO_ID
    ) ?? FIREWATCH_DEMO_SCENARIOS[0];
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    () => defaultScenario?.id
  );
  const selectedScenario = FIREWATCH_DEMO_SCENARIOS.find(
    (scenario) => scenario.id === selectedScenarioId
  );

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <h1 className="text-xl font-semibold leading-tight">
          No posts need review right now
        </h1>
        <p className="text-sm leading-5 text-muted-foreground">
          Start a clean demo thread to see reports, watched links, comment
          review, handoff, and handled state in one pass.
        </p>

        <div className="mt-1 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground">
            Choose one demo scenario
          </p>
          <div className="grid min-w-0 gap-2">
            {FIREWATCH_DEMO_SCENARIOS.map((scenario) => {
              const selected = scenario.id === selectedScenario?.id;

              return (
                <button
                  key={scenario.id}
                  aria-pressed={selected}
                  className={cn(
                    'group flex min-h-16 w-full min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-60',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  )}
                  disabled={busy}
                  type="button"
                  onClick={() => setSelectedScenarioId(scenario.id)}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                      selected
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/70'
                    )}
                  >
                    {selected ? (
                      <span className="size-1.5 rounded-full bg-primary-foreground" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold leading-5 text-foreground">
                      {scenario.label}
                    </span>
                    <span className="line-clamp-2 text-xs font-normal leading-4 text-muted-foreground">
                      {scenario.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">
            Firewatch will create one demo thread and open it in the review
            queue.
          </p>
          <Button
            className="w-full sm:w-fit"
            disabled={busy || !selectedScenario}
            variant="default"
            onClick={() => {
              if (selectedScenario) onCreateDemo(selectedScenario.id);
            }}
          >
            {busy ? (
              <RedditRefreshIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : null}
            {busy ? 'Creating demo thread' : 'Create demo thread'}
          </Button>
        </div>
      </div>
    </div>
  );
};
