import type { ComponentProps, ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Incident } from '../../shared/api';
import { levelBadgeVariant } from './format';
import {
  RedditChevronDownIcon,
  RedditOverflowIcon,
  RedditRefreshIcon,
} from './reddit-icons';

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
      <h2 className="text-base font-semibold leading-5 text-foreground">
        {title}
      </h2>
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

export const Skeleton = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn('animate-pulse rounded-md bg-muted', className)}
    data-slot="skeleton"
    {...props}
  />
);

export const Input = ({
  className,
  type,
  ...props
}: ComponentProps<'input'>) => (
  <input
    className={cn(
      'h-9 w-full min-w-0 rounded-full border border-transparent bg-secondary px-4 py-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
      className
    )}
    data-slot="input"
    type={type}
    {...props}
  />
);

export const SubredditAvatar = ({
  size = 'default',
}: {
  size?: 'default' | 'sm';
}) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full border border-border bg-[#eef1f3] font-black leading-none text-[#0e1113]',
      size === 'sm' ? 'size-8 text-lg' : 'size-9 text-xl'
    )}
  >
    r/
  </span>
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
    className="group overflow-hidden rounded-md border border-border bg-background"
    open={defaultOpen}
  >
    <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 hover:bg-accent/60 [&::-webkit-details-marker]:hidden">
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
    <div className="min-w-0 border-t border-border px-3 py-2.5">
      {children}
    </div>
  </details>
);

export const RedditOverflowMenu = ({
  align = 'end',
  children,
  label = 'More actions',
}: {
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
  label?: string;
}) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <Button size="sm" variant="ghost">
        <RedditOverflowIcon data-icon="inline-start" />
        {label}
      </Button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        className="z-50 max-h-[432px] min-w-64 max-w-[300px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/25"
        sideOffset={6}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

export const RedditMenuItem = ({
  description,
  destructive,
  disabled,
  icon,
  label,
  onSelect,
}: {
  description?: string | undefined;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
}) => (
  <DropdownMenu.Item
    className={cn(
      'flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm leading-5 outline-none hover:bg-accent focus:bg-accent data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
      destructive ? 'text-destructive' : 'text-popover-foreground'
    )}
    disabled={disabled === true}
    onSelect={onSelect}
  >
    {icon ? (
      <span className="flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">
        {icon}
      </span>
    ) : null}
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{label}</span>
      {description ? (
        <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </span>
  </DropdownMenu.Item>
);

export const RedditMenuSeparator = () => (
  <DropdownMenu.Separator className="my-1 h-px bg-border" />
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
