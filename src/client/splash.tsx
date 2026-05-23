import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RedditQueueIcon } from './firewatch/reddit-icons';

export const Splash = () => {
  const subredditName = context?.subredditName ?? 'firewatch17_dev';

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center gap-4 px-5 py-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full border border-border bg-[#eef1f3] text-lg font-black text-[#0e1113]">
            r/
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Firewatch</h1>
            <p className="text-sm font-semibold text-muted-foreground">
              Mod queue for r/{subredditName}
            </p>
          </div>
        </div>
        <p className="max-w-[560px] text-sm leading-5 text-muted-foreground">
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
