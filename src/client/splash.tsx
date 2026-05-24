import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RedditQueueIcon } from './firewatch/reddit-icons';

export const Splash = () => {
  const subredditName = context?.subredditName ?? 'firewatch17_dev';

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center gap-4 px-4 py-8 sm:px-5">
        <div className="flex items-center gap-3">
          <img
            src="/firewatch-icon.png"
            alt=""
            className="size-12 shrink-0 rounded-[14px] border border-border bg-card object-cover"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">
              Firewatch posts to review
            </h1>
            <p className="break-words text-sm font-semibold text-muted-foreground">
              Mod queue for r/{subredditName}
            </p>
          </div>
        </div>
        <p className="max-w-[560px] break-words text-sm leading-5 text-muted-foreground">
          Review posts that are picking up reports, watched words, watched
          links, repeated user comments, or post-menu sends.
        </p>
        <button
          type="button"
          className="ui-feedback inline-flex h-8 w-fit items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none"
          onClick={(event) =>
            requestExpandedMode(event.nativeEvent, 'dashboard')
          }
        >
          <RedditQueueIcon className="size-4" />
          Open mod queue
        </button>
      </main>
    </div>
  );
};

const root = document.getElementById('root');
if (!root) throw new Error('Missing Firewatch splash root element');

createRoot(root).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
