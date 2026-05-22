import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export const LoadingBoard = () => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2.5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
    <div className="grid gap-3 md:grid-cols-4">
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Skeleton className="h-[520px] rounded-lg" />
      <Skeleton className="h-[520px] rounded-lg" />
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
      <AlertTriangle />
      <AlertTitle>Could not load your mod view</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <Button className="mt-4 w-fit" variant="outline" onClick={onRefresh}>
        <RefreshCw data-icon="inline-start" />
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
  onCreateDemo: () => void;
}) => (
  <div className="mx-auto flex w-full max-w-md flex-col gap-5 py-8">
    <div className="flex flex-col gap-2.5">
      <h1 className="text-2xl font-medium leading-tight sm:text-3xl">
        No posts need review
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Firewatch will list posts here when reports, watched words, watched
        domains, repeated user wording, reply clusters, or post-menu sends need
        a mod look.
      </p>
    </div>
    <Button
      className="h-10 w-full text-sm font-medium"
      disabled={busy}
      onClick={onCreateDemo}
    >
      <Sparkles data-icon="inline-start" />
      {busy ? 'Creating demo post' : 'Create demo post'}
    </Button>
    <p className="text-xs leading-5 text-muted-foreground">
      Use Filters when mods want to change what gets queued.
    </p>
  </div>
);
