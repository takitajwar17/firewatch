import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SubredditAvatar } from '../common';
import {
  RedditListIcon,
  RedditQueueIcon,
  RedditRefreshIcon,
  RedditSettingsIcon,
} from '../reddit-icons';
import type { FirewatchView } from '../types';

export const WorkspaceHeader = ({
  activeView,
  onRefresh,
  onViewChange,
  subredditName,
}: {
  activeView: FirewatchView;
  onRefresh: () => void;
  onViewChange: (view: FirewatchView) => void;
  subredditName: string;
}) => {
  const isSettings = activeView === 'settings';
  const isAutomations = activeView === 'automations';
  const headerIcon = isSettings ? (
    <RedditSettingsIcon />
  ) : isAutomations ? (
    <RedditListIcon />
  ) : (
    <RedditQueueIcon />
  );
  const headerTitle = isSettings
    ? 'Settings'
    : isAutomations
      ? 'Automations'
      : 'Posts to review';
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (refreshTimerRef.current !== undefined) {
        window.clearTimeout(refreshTimerRef.current);
      }
    },
    []
  );

  const handleRefresh = () => {
    if (refreshTimerRef.current !== undefined) {
      window.clearTimeout(refreshTimerRef.current);
    }
    setRefreshing(true);
    onRefresh();
    refreshTimerRef.current = window.setTimeout(() => {
      setRefreshing(false);
      refreshTimerRef.current = undefined;
    }, 700);
  };

  return (
    <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border bg-background px-3 py-2 sm:gap-4 sm:px-4 lg:px-5">
      <div className="flex min-w-0 items-center gap-3 lg:hidden">
        <SubredditAvatar size="sm" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">Firewatch</p>
          <p className="truncate text-xs leading-5 text-muted-foreground">
            r/{subredditName || 'subreddit'}
          </p>
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="text-muted-foreground [&_svg]:size-5">
            {headerIcon}
          </span>
          <h1 className="text-lg font-semibold leading-6 tracking-normal">
            {headerTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          className="lg:hidden"
          size="icon-sm"
          variant={isAutomations ? 'secondary' : 'ghost'}
          onClick={() => onViewChange(isAutomations ? 'queue' : 'automations')}
        >
          <RedditListIcon />
          <span className="sr-only">Automations</span>
        </Button>
        <Button
          className="lg:hidden"
          size="icon-sm"
          variant={isSettings ? 'secondary' : 'ghost'}
          onClick={() => onViewChange(isSettings ? 'queue' : 'settings')}
        >
          <RedditSettingsIcon />
          <span className="sr-only">Settings</span>
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={handleRefresh}>
          <RedditRefreshIcon
            className={refreshing ? 'animate-spin' : undefined}
          />
          <span className="sr-only">Refresh</span>
        </Button>
      </div>
    </header>
  );
};
