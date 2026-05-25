import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { RedditChevronDownIcon, RedditRefreshIcon } from './reddit-icons';

type ActionPrepPanelProps = {
  busy?: boolean;
  children?: ReactNode;
  description?: string;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  primaryIcon?: ReactNode;
  primaryLabel: string;
  title: string;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
};

export const ActionPrepPanel = ({
  busy,
  children,
  description,
  disabled,
  onCancel,
  onSubmit,
  primaryIcon,
  primaryLabel,
  title,
  variant = 'secondary',
}: ActionPrepPanelProps) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || disabled) return;
    onSubmit();
  };

  return (
    <form
      className="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2.5"
      onSubmit={submit}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5 text-foreground">
          {title}
        </p>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="mt-2.5 flex flex-col gap-2.5">{children}</div>
      ) : null}
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button
          disabled={busy}
          size="sm"
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          disabled={busy || disabled}
          size="sm"
          type="submit"
          variant={variant}
        >
          {busy ? (
            <RedditRefreshIcon className="animate-spin" data-icon="inline-start" />
          ) : (
            primaryIcon
          )}
          {busy ? 'Working' : primaryLabel}
        </Button>
      </div>
    </form>
  );
};

export const ActionTextArea = ({
  description,
  id,
  label,
  onChange,
  placeholder,
  rows = 2,
  value,
}: {
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) => (
  <label className="flex min-w-0 flex-col gap-2" htmlFor={id}>
    <span className="text-xs font-semibold leading-none text-foreground/90">
      {label}
    </span>
    <textarea
      id={id}
      className={cn(
        'min-h-16 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-5 shadow-xs outline-none transition-[color,box-shadow]',
        'placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25'
      )}
      placeholder={placeholder}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    {description ? (
      <span className="text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    ) : null}
  </label>
);

export const ActionInput = ({
  description,
  id,
  label,
  onChange,
  placeholder,
  value,
}: {
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) => (
  <label className="flex min-w-0 flex-col gap-2" htmlFor={id}>
    <span className="text-xs font-semibold leading-none text-foreground/90">
      {label}
    </span>
    <Input
      id={id}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    {description ? (
      <span className="text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    ) : null}
  </label>
);

export const ActionSelect = ({
  children,
  description,
  id,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <label className="flex min-w-0 flex-col gap-2" htmlFor={id}>
    <span className="text-xs font-semibold leading-none text-foreground/90">
      {label}
    </span>
    <span className="relative min-w-0">
      <select
        id={id}
        className="h-9 w-full min-w-0 appearance-none rounded-full border border-transparent bg-secondary py-0 pr-11 pl-4 text-sm font-semibold outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <RedditChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
    {description ? (
      <span className="text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    ) : null}
  </label>
);
