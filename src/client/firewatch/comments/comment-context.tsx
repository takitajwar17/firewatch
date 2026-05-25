import { formatUsername } from '../format';
import type { IncidentSignal } from '../../../shared/api';
import type { CommentThreadContext } from './comment-state';

export const CommentContextBlock = ({
  context,
}: {
  context: CommentThreadContext;
}) => (
  <div className="mt-2 border-l-2 border-border py-1 pl-3">
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      Thread context
    </p>
    <div className="mt-1.5 flex flex-col gap-1.5">
      {context.lines.map((line) => (
        <ContextLine key={line.id} label={line.label} signal={line.signal} />
      ))}
    </div>
  </div>
);

const ContextLine = ({
  label,
  signal,
}: {
  label: string;
  signal: IncidentSignal;
}) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold leading-5 text-muted-foreground">
      {label}
      {signal.author ? ` by ${formatUsername(signal.author)}` : ''}
    </p>
    <p className="line-clamp-2 break-words text-sm leading-5 text-foreground/85">
      {signal.body}
    </p>
  </div>
);
