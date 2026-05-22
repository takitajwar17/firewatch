import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Incident } from '../../shared/api';
import { levelBadgeVariant } from './format';

export const PanelLabel = ({
  children,
  surface = 'main',
}: {
  children: ReactNode;
  surface?: 'main' | 'sidebar';
}) => (
  <p
    className={cn(
      'text-xs font-medium leading-5',
      surface === 'sidebar'
        ? 'text-sidebar-foreground/55'
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
  description: string;
  title: string;
}) => (
  <div
    className={cn(
      'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
      className
    )}
  >
    <div className="min-w-0">
      <h2 className="text-base font-medium leading-6 text-foreground">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export const ScoreBadge = ({ incident }: { incident: Incident }) => (
  <Badge
    aria-label={`Current attention ${incident.score} out of 100`}
    className="shrink-0 font-medium tabular-nums"
    title={`Current attention ${incident.score}/100`}
    variant={levelBadgeVariant[incident.level]}
  >
    {incident.score}
  </Badge>
);

export const EmptyText = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-6 text-muted-foreground">{children}</p>
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
      className="text-[13px] font-medium leading-none text-foreground/90"
      htmlFor={htmlFor}
    >
      {label}
    </label>
    {children}
    {description ? (
      <p className="text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    ) : null}
  </div>
);

export const PlaybookButton = ({
  disabled,
  icon,
  label,
  loading,
  onClick,
  variant = 'default',
}: {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost';
}) => (
  <Button
    className="h-10 justify-center text-sm font-medium"
    disabled={disabled}
    variant={variant}
    onClick={onClick}
  >
    {loading ? <RefreshCw className="animate-spin" data-icon="inline-start" /> : icon}
    {loading ? 'Working' : label}
  </Button>
);

export const MetricCard = ({
  description,
  icon,
  label,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <Card size="sm">
    <CardHeader className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <CardDescription>{label}</CardDescription>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <CardTitle className="text-2xl font-medium tabular-nums">{value}</CardTitle>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </CardHeader>
  </Card>
);
