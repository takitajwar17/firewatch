import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Incident } from '../../shared/api';
import { levelBadgeVariant } from './format';
import { RedditChevronDownIcon, RedditRefreshIcon } from './reddit-icons';

export const PanelLabel = ({
  children,
  surface = 'main',
}: {
  children: ReactNode;
  surface?: 'main' | 'sidebar';
}) => (
  <p
    className={cn(
      'text-xs font-semibold leading-4 tracking-[0.08em]',
      surface === 'sidebar'
        ? 'text-sidebar-foreground/60'
        : 'text-muted-foreground'
    )}
  >
    {children}
  </p>
);

export const SectionHeader = ({
  action,
  className,
  description,
  title,
}: {
  action?: ReactNode;
  className?: string;
  description?: string;
  title: string;
}) => (
  <div
    className={cn(
      'flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between',
      className
    )}
  >
    <div className="min-w-0">
      <h2 className="text-base font-bold leading-5 text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export const ScoreBadge = ({ incident }: { incident: Incident }) => (
  <Badge
    aria-label={`Review score ${incident.score} out of 100`}
    className="shrink-0 font-semibold tabular-nums"
    title={`Review score ${incident.score}/100`}
    variant={levelBadgeVariant[incident.level]}
  >
    {incident.score}
  </Badge>
);

export const EmptyText = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-5 text-muted-foreground">{children}</p>
);

export const DisclosurePanel = ({
  children,
  defaultOpen,
  description,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  description?: string;
  title: string;
}) => (
  <details
    className="group overflow-hidden rounded-lg border border-border bg-muted/45 open:bg-muted/70"
    open={defaultOpen}
  >
    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 hover:bg-accent/60 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <RedditChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <div className="min-w-0 border-t px-4 py-3">{children}</div>
  </details>
);

export const FieldBlock = ({
  children,
  description,
  htmlFor,
  label,
}: {
  children: ReactNode;
  description?: string;
  htmlFor: string;
  label: string;
}) => (
  <div className="flex flex-col gap-2">
    <label
      className="text-xs font-semibold leading-none text-foreground/90"
      htmlFor={htmlFor}
    >
      {label}
    </label>
    {children}
    {description ? (
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    ) : null}
  </div>
);

type PlaybookButtonProps = {
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onClick: () => void;
  title?: string | undefined;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
};

export const PlaybookButton = ({
  className,
  disabled,
  icon,
  label,
  loading,
  loadingLabel = 'Working',
  onClick,
  title,
  variant = 'secondary',
}: PlaybookButtonProps) => (
  <Button
    className={cn(
      'h-8 max-w-full justify-center text-sm font-semibold',
      className
    )}
    disabled={disabled}
    title={title}
    variant={variant}
    onClick={onClick}
  >
    {loading ? (
      <RedditRefreshIcon className="animate-spin" data-icon="inline-start" />
    ) : (
      icon
    )}
    {loading ? loadingLabel : label}
  </Button>
);

export const RedditActionButton = ({
  action,
  busyAction,
  disabled,
  ...props
}: {
  action: string;
  busyAction: string | undefined;
  disabled?: boolean;
} & Omit<PlaybookButtonProps, 'disabled' | 'loading'>) => (
  <PlaybookButton
    {...props}
    disabled={Boolean(busyAction) || Boolean(disabled)}
    loading={busyAction === action}
  />
);
