import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FIREWATCH_DEMO_SCENARIOS } from '../../shared/firewatch-presets';
import type { DemoCreateHandler } from './types';
import {
  RedditAddIcon,
  RedditRefreshIcon,
  RedditReportIcon,
} from './reddit-icons';

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
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <LoadingPanel
            titleWidth="w-24"
            rows={[
              ['w-32', 'w-36', 'w-20', 'w-40'],
              ['w-48'],
            ]}
          />
          <LoadingPanel
            titleWidth="w-20"
            rows={[
              ['w-20', 'w-24', 'w-20', 'w-20', 'w-24'],
              ['w-28'],
            ]}
          />
          <LoadingPanel
            titleWidth="w-36"
            rows={[
              ['w-full'],
              ['w-3/4'],
              ['w-32', 'w-40', 'w-28'],
            ]}
          />
          <LoadingSignalList />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <LoadingStepsPanel />
          <LoadingAuthorsPanel />
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
          <Skeleton className="h-7 w-3/5 max-w-[28rem]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </article>
    </div>
  </section>
);

const LoadingPanel = ({
  rows,
  titleWidth,
}: {
  rows: string[][];
  titleWidth: string;
}) => (
  <section className="rounded-md border border-border bg-background">
    <div className="border-b border-border px-3 py-2.5">
      <Skeleton className={`h-5 ${titleWidth}`} />
    </div>
    <div className="flex flex-col gap-3 p-3">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-wrap items-center gap-2"
        >
          {row.map((width, widthIndex) => (
            <Skeleton
              key={`${index}-${widthIndex}`}
              className={`h-9 rounded-full ${width}`}
            />
          ))}
        </div>
      ))}
    </div>
  </section>
);

const LoadingSignalList = () => (
  <section className="rounded-md border border-border bg-background">
    <div className="border-b border-border px-3 py-2.5">
      <Skeleton className="h-5 w-16" />
    </div>
    <div className="flex flex-col px-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="border-t border-border py-2.5 first:border-t-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="mt-2 h-3.5 w-full max-w-[34rem]" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </section>
);

const LoadingStepsPanel = () => (
  <section className="rounded-md border border-border bg-card">
    <div className="px-3 pt-2.5 pb-2">
      <Skeleton className="h-5 w-28" />
    </div>
    <div className="px-3 pb-2.5">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex gap-2 border-t border-border py-2 first:border-t-0 first:pt-0 last:pb-0"
        >
          <Skeleton className="mt-0.5 size-5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-full" />
            {index === 0 ? <Skeleton className="mt-1.5 h-4 w-4/5" /> : null}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const LoadingAuthorsPanel = () => (
  <section className="rounded-md border border-border bg-card">
    <div className="px-3 pt-2.5 pb-2">
      <Skeleton className="h-5 w-44" />
    </div>
    <div className="flex flex-col px-3 pb-2.5">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="border-t border-border py-2 first:border-t-0 first:pt-0"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3.5 w-48 max-w-full" />
            </div>
            <Skeleton className="h-7 w-9 rounded-full" />
          </div>
        </div>
      ))}
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
}) => (
  <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-6 sm:py-8">
    <div className="flex flex-col gap-2.5">
      <h1 className="text-xl font-semibold leading-tight">
        No posts need review right now
      </h1>
    </div>
    <div className="flex flex-col gap-2">
      {FIREWATCH_DEMO_SCENARIOS.map((scenario) => (
        <Button
          key={scenario.id}
          className="h-auto min-h-9 justify-start px-3 py-2 text-left text-sm font-semibold"
          disabled={busy}
          variant="outline"
          onClick={() => onCreateDemo(scenario.id)}
        >
          <RedditAddIcon className="size-4 shrink-0" data-icon="inline-start" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>{busy ? 'Creating demo thread' : scenario.label}</span>
          </span>
        </Button>
      ))}
    </div>
  </div>
);
