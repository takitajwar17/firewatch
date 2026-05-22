import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => (
  <div className="min-h-screen bg-[#f7f4ee] text-[#1d2525]">
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center gap-5 px-6 py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#e6402a] text-xl font-black text-white">
          F
        </span>
        <div>
          <h1 className="text-2xl font-black leading-tight">Firewatch</h1>
          <p className="text-sm font-medium text-[#65706f]">
            Incident command for r/{context.subredditName}
          </p>
        </div>
      </div>
      <p className="max-w-[560px] text-base leading-7 text-[#465150]">
        Detect thread escalation, let one moderator claim ownership, apply a
        response playbook, and produce an after-action summary without leaving
        Reddit.
      </p>
      <button
        className="h-11 w-fit rounded-md bg-[#1d2525] px-5 text-sm font-bold text-white transition hover:bg-[#334140]"
        onClick={(event) => requestExpandedMode(event.nativeEvent, 'dashboard')}
      >
        Open incident board
      </button>
    </main>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
