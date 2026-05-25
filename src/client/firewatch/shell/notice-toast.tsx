import { cn } from '@/lib/utils';
import { RedditApproveIcon, RedditReportIcon } from '../reddit-icons';
import type { Notice } from '../types';

export const NoticeToast = ({ notice }: { notice: Notice }) => (
  <div
    aria-live={notice.type === 'error' ? 'assertive' : 'polite'}
    className="pointer-events-none fixed right-4 bottom-4 z-50 sm:right-5 sm:bottom-5"
  >
    <div
      role={notice.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex min-h-14 w-[min(22rem,calc(100vw-2rem))] items-center gap-3 overflow-hidden rounded-md border bg-popover px-4 py-3 text-foreground shadow-lg shadow-black/30',
        'animate-in fade-in-0 slide-in-from-right-8 duration-200',
        notice.type === 'error' ? 'border-destructive/35' : 'border-border'
      )}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full',
          notice.type === 'error'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-primary/10 text-primary'
        )}
      >
        {notice.type === 'error' ? (
          <RedditReportIcon className="size-3.5" />
        ) : (
          <RedditApproveIcon className="size-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-semibold leading-5">
          {notice.type === 'error' ? 'Needs attention' : 'Action complete'}
        </p>
        <p className="mt-0.5 truncate text-sm leading-5 text-muted-foreground">
          {notice.message}
        </p>
      </div>
    </div>
  </div>
);
