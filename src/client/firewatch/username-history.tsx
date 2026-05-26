import { useMemo, type ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '@/lib/utils';
import {
  formatRating,
  formatSignalType,
  formatTime,
  formatUsername,
} from './format';
import type {
  FlaggedComment,
  Incident,
  IncidentAction,
  IncidentSignal,
  MatchedAutomationRule,
  UserStrike,
  UserStrikeSummary,
} from '../../shared/api';

type UsernameHistoryTriggerProps = {
  align?: 'start' | 'center' | 'end';
  children?: ReactNode;
  className?: string;
  incident: Incident;
  username: string | undefined;
};

type UserHistory = {
  actions: IncidentAction[];
  automations: MatchedAutomationRule[];
  comments: FlaggedComment[];
  displayName: string;
  key: string | undefined;
  lastSeenAt: number | undefined;
  participant: Incident['involvedUsers'][number] | undefined;
  signals: IncidentSignal[];
  strikeSummary: UserStrikeSummary | undefined;
};

type HistorySummaryRow = [label: string, value: string];

const normalizeUsername = (username: string | undefined) => {
  const normalized = username?.trim().replace(/^u\//i, '');
  if (
    !normalized ||
    normalized.startsWith('t2_') ||
    normalized === 'unknown user'
  ) {
    return undefined;
  }

  return normalized;
};

const usernameKey = (username: string | undefined) =>
  normalizeUsername(username)?.toLowerCase();

const sameUser = (left: string | undefined, rightKey: string | undefined) =>
  usernameKey(left) === rightKey;

const numberAtStart = (value: string) => {
  const match = value.trim().match(/^(\d+)/);
  if (!match) return 1;

  const parsed = Number.parseInt(match[1] ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const reasonCount = (reasons: string[], pattern: RegExp) =>
  reasons.reduce(
    (total, reason) =>
      pattern.test(reason) ? total + numberAtStart(reason) : total,
    0
  );

const reportCountFrom = (comment: FlaggedComment) =>
  comment.numReports ??
  comment.reasons.filter((reason) => /^reported:/i.test(reason)).length;

const isOpenComment = (comment: FlaggedComment) =>
  !comment.removed && !comment.reviewed && !comment.approved && !comment.spam;

const newestFirst = (
  left: { createdAt: number },
  right: { createdAt: number }
) => right.createdAt - left.createdAt;

const newestStrikeFirst = (left: UserStrike, right: UserStrike) =>
  Date.parse(right.createdAt) - Date.parse(left.createdAt);

const commentBelongsToUser = (
  comment: FlaggedComment,
  key: string | undefined
) => sameUser(comment.author, key);

const actionInvolvesUser = ({
  action,
  commentIds,
  key,
}: {
  action: IncidentAction;
  commentIds: Set<string>;
  key: string | undefined;
}) =>
  (action.targetIds ?? []).some(
    (targetId) => commentIds.has(targetId) || usernameKey(targetId) === key
  );

const automationInvolvesUser = ({
  commentIds,
  key,
  rule,
}: {
  commentIds: Set<string>;
  key: string | undefined;
  rule: MatchedAutomationRule;
}) => {
  if (sameUser(rule.username, key) || commentIds.has(rule.targetId)) {
    return true;
  }

  return rule.preparedActions.some(
    (action) =>
      sameUser(action.username, key) ||
      (action.targetId ? commentIds.has(action.targetId) : false)
  );
};

const latestTimestampFrom = (history: Omit<UserHistory, 'lastSeenAt'>) => {
  const strikeTimes =
    history.strikeSummary?.strikes
      .map((strike) => Date.parse(strike.createdAt))
      .filter(Number.isFinite) ?? [];

  const timestamps = [
    history.participant?.lastSeenAt,
    ...history.comments.map((comment) => comment.createdAt),
    ...history.signals.map((signal) => signal.createdAt),
    ...history.actions.map((action) => action.createdAt),
    ...strikeTimes,
  ].filter((timestamp): timestamp is number => typeof timestamp === 'number');

  if (timestamps.length === 0) return undefined;
  return Math.max(...timestamps);
};

const buildUserHistory = ({
  incident,
  username,
}: {
  incident: Incident;
  username: string | undefined;
}): UserHistory => {
  const normalized = normalizeUsername(username);
  const key = usernameKey(username);
  const displayName = formatUsername(normalized);
  const comments = incident.flaggedComments
    .filter((comment) => commentBelongsToUser(comment, key))
    .sort(newestFirst);
  const commentIds = new Set(comments.map((comment) => comment.id));
  const participant = incident.involvedUsers.find((user) =>
    sameUser(user.username, key)
  );
  const signals = incident.recentSignals
    .filter((signal) => sameUser(signal.author, key))
    .sort(newestFirst);
  const actions = incident.actions
    .filter((action) => actionInvolvesUser({ action, commentIds, key }))
    .sort(newestFirst);
  const automations = (incident.matchedRules ?? [])
    .filter((rule) => automationInvolvesUser({ commentIds, key, rule }))
    .sort(
      (left, right) => Date.parse(right.matchedAt) - Date.parse(left.matchedAt)
    );
  const strikeSummary = incident.userStrikeSummaries?.find((summary) =>
    sameUser(summary.username, key)
  );
  const baseHistory = {
    actions,
    automations,
    comments,
    displayName,
    key,
    participant,
    signals,
    strikeSummary,
  };

  return {
    ...baseHistory,
    lastSeenAt: latestTimestampFrom(baseHistory),
  };
};

const strikeSourceLabel: Record<UserStrike['source'], string> = {
  comment_removed: 'comment removal',
  manual_mod_action: 'manual mod action',
  post_removed: 'post removal',
  report: 'report',
  rule_match: 'automation match',
  watched_domain: 'watched domain',
  watched_word: 'watched word',
};

const formatIsoTime = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? formatTime(timestamp) : value;
};

const summaryRowsFrom = (history: UserHistory) => {
  const openComments = history.comments.filter(isOpenComment).length;
  const reviewedComments = history.comments.length - openComments;
  const reports = history.comments.reduce(
    (total, comment) => total + reportCountFrom(comment),
    0
  );
  const watchedDomains = history.comments.reduce(
    (total, comment) => total + reasonCount(comment.reasons, /watched domain/i),
    0
  );
  const watchedWords = history.comments.reduce(
    (total, comment) =>
      total + reasonCount(comment.reasons, /watched word|keyword/i),
    0
  );

  return [
    openComments > 0 ? ['Open comments', String(openComments)] : undefined,
    reviewedComments > 0
      ? ['Reviewed comments', String(reviewedComments)]
      : undefined,
    reports > 0 ? ['Reports', String(reports)] : undefined,
    watchedDomains + watchedWords > 0
      ? ['Watched hits', String(watchedDomains + watchedWords)]
      : undefined,
    history.participant && history.participant.branchCount > 0
      ? ['Reply branches', String(history.participant.branchCount)]
      : undefined,
    history.strikeSummary && history.strikeSummary.strikeCount > 0
      ? [
          `Strikes in ${history.strikeSummary.recentWindowDays}d`,
          String(history.strikeSummary.strikeCount),
        ]
      : undefined,
    history.actions.length > 0
      ? ['Mod actions', String(history.actions.length)]
      : undefined,
    history.automations.length > 0
      ? ['Automations', String(history.automations.length)]
      : undefined,
  ].filter((row): row is HistorySummaryRow => Boolean(row));
};

const hasHistory = (history: UserHistory) =>
  history.comments.length > 0 ||
  history.signals.length > 0 ||
  history.actions.length > 0 ||
  history.automations.length > 0 ||
  Boolean(history.strikeSummary?.strikeCount);

const UserHistorySection = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <section className="border-t border-border px-3 py-2.5 first:border-t-0">
    <p className="mb-1.5 text-xs font-semibold leading-4 tracking-[0.08em] text-muted-foreground">
      {title}
    </p>
    {children}
  </section>
);

export const UsernameHistoryTrigger = ({
  align = 'start',
  children,
  className,
  incident,
  username,
}: UsernameHistoryTriggerProps) => {
  const history = useMemo(
    () => buildUserHistory({ incident, username }),
    [incident, username]
  );

  if (!history.key) {
    return (
      <span className={className}>{children ?? formatUsername(username)}</span>
    );
  }

  const summaryRows = summaryRowsFrom(history);
  const label = children ?? history.displayName;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`Open Firewatch history for ${history.displayName}`}
          className={cn(
            'inline-flex max-w-full items-center rounded-sm font-semibold leading-5 text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            className
          )}
          type="button"
        >
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          className="z-50 max-h-[min(58vh,380px)] w-[min(92vw,380px)] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg shadow-black/25"
          sideOffset={6}
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold leading-5">
              {history.displayName}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Firewatch facts for this thread and recent strikes.
              {history.lastSeenAt
                ? ` Last seen ${formatTime(history.lastSeenAt)}.`
                : ''}
            </p>
          </div>

          {summaryRows.length > 0 ? (
            <UserHistorySection title="Snapshot">
              <div className="grid grid-cols-2 gap-1.5">
                {summaryRows.map(([labelText, value]) => (
                  <div
                    key={labelText}
                    className="rounded-sm bg-muted/45 px-2 py-1.5"
                  >
                    <p className="text-[11px] font-semibold leading-4 text-muted-foreground">
                      {labelText}
                    </p>
                    <p className="text-sm font-semibold leading-5">{value}</p>
                  </div>
                ))}
              </div>
            </UserHistorySection>
          ) : null}

          {history.strikeSummary?.strikes.length ? (
            <UserHistorySection title="Firewatch strike history">
              <div className="flex flex-col gap-2">
                {[...history.strikeSummary.strikes]
                  .sort(newestStrikeFirst)
                  .map((strike) => (
                    <div key={strike.id} className="min-w-0">
                      <p className="line-clamp-2 break-words text-sm leading-5">
                        {strike.reason}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {strikeSourceLabel[strike.source]} · +{strike.weight} ·{' '}
                        {formatIsoTime(strike.createdAt)}
                      </p>
                    </div>
                  ))}
              </div>
            </UserHistorySection>
          ) : null}

          {history.automations.length > 0 ? (
            <UserHistorySection title="Prepared automations">
              <div className="flex flex-col gap-2">
                {history.automations.map((rule) => (
                  <div key={rule.id} className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-5">
                      {rule.ruleName}
                    </p>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {rule.why.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </UserHistorySection>
          ) : null}

          {history.actions.length > 0 ? (
            <UserHistorySection title="Mod actions involving this user">
              <div className="flex flex-col gap-2">
                {history.actions.map((action) => (
                  <div key={action.id} className="min-w-0">
                    <p className="line-clamp-2 break-words text-sm leading-5">
                      {action.detail}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {formatUsername(action.actor)} ·{' '}
                      {formatTime(action.createdAt)}
                      {action.status ? ` · ${action.status}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </UserHistorySection>
          ) : null}

          {history.comments.length > 0 ? (
            <UserHistorySection title="Comments in this thread">
              <div className="flex flex-col gap-2">
                {history.comments.map((comment) => (
                  <div key={comment.id} className="min-w-0">
                    <p className="line-clamp-2 break-words text-sm leading-5">
                      {comment.body}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {formatRating(comment.score)} ·{' '}
                      {formatTime(comment.createdAt)}
                      {isOpenComment(comment) ? ' · open' : ' · reviewed'}
                    </p>
                  </div>
                ))}
              </div>
            </UserHistorySection>
          ) : null}

          {history.signals.length > 0 ? (
            <UserHistorySection title="Recent activity">
              <div className="flex flex-col gap-2">
                {history.signals.map((signal) => (
                  <div key={signal.id} className="min-w-0">
                    <p className="text-sm font-semibold leading-5">
                      {formatSignalType(signal)}
                    </p>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {signal.reason ?? signal.body ?? 'No details'} ·{' '}
                      {formatTime(signal.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </UserHistorySection>
          ) : null}

          {!hasHistory(history) ? (
            <UserHistorySection title="History">
              <p className="text-sm leading-5 text-muted-foreground">
                No Firewatch history for this user yet.
              </p>
            </UserHistorySection>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
