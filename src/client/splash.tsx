import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => (
  <div className="min-h-dvh bg-background text-foreground">
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col justify-center gap-4 px-5 py-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          F
        </span>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Firewatch</h1>
          <p className="text-sm font-semibold text-muted-foreground">
            Mod queue for r/{context.subredditName}
          </p>
        </div>
      </div>
      <p className="max-w-[560px] text-sm leading-5 text-muted-foreground">
        Review posts that are picking up reports, watched words, watched links,
        repeated user comments, or post-menu sends.
      </p>
      <button
        type="button"
        className="ui-feedback h-10 w-fit rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none"
        onClick={(event) => requestExpandedMode(event.nativeEvent, 'dashboard')}
      >
        Open mod queue
      </button>
    </main>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
