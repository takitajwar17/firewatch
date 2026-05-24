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
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 md:grid-cols-4">
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Skeleton className="h-[360px] rounded-lg sm:h-[520px]" />
      <Skeleton className="h-[320px] rounded-lg sm:h-[520px]" />
    </div>
  </div>
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
      <AlertTitle>Could not load Firewatch</AlertTitle>
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
        No posts need review
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Posts show up here when reports, watched words, watched domains,
        repeated user wording, reply clusters, or the post menu send them to
        Firewatch.
      </p>
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
            <span>{busy ? 'Creating demo post' : scenario.label}</span>
            <span className="text-xs font-normal leading-5 text-muted-foreground">
              {scenario.description}
            </span>
          </span>
        </Button>
      ))}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">
      Use Settings to edit watched words, domains, thresholds, and demo posts.
    </p>
  </div>
);
