import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => (
  <div className="min-h-dvh bg-background text-foreground">
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center gap-5 px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-xl font-medium text-primary-foreground">
          F
        </span>
        <div>
          <h1 className="text-2xl font-medium leading-tight">Firewatch</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Mod queue for r/{context.subredditName}
          </p>
        </div>
      </div>
      <p className="max-w-[560px] text-base leading-7 text-muted-foreground">
        Review posts that are picking up reports, watched words, watched links,
        repeated user comments, or post-menu sends.
      </p>
      <button
        type="button"
        className="ui-feedback h-11 w-fit rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
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
