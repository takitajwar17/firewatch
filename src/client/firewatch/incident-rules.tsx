import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RULE_MODE_LABELS } from '../../shared/automation-rules';
import type { Incident, MatchedAutomationRule } from '../../shared/api';
import { PlaybookButton } from './common';
import { formatRating, formatRatingTitle } from './format';
import type { ActionRunner } from './types';
import {
  RedditApproveIcon,
  RedditReportIcon,
  RedditShieldIcon,
} from './reddit-icons';
import { UsernameHistoryTrigger } from './username-history';

export const MatchedRulesCard = ({
  actionLocked,
  actionLockReason,
  busyAction,
  incident,
  onAction,
}: {
  actionLocked: boolean;
  actionLockReason: string;
  busyAction: string | undefined;
  incident: Incident;
  onAction: ActionRunner;
}) => {
  const [dismissedRuleIds, setDismissedRuleIds] = useState<Set<string>>(
    () => new Set()
  );
  const matchedRules = (incident.matchedRules ?? []).filter(
    (rule) => !dismissedRuleIds.has(rule.id)
  );

  if (matchedRules.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Automations ready</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {matchedRules.map((rule) => (
          <MatchedRuleItem
            key={rule.id}
            actionLocked={actionLocked}
            actionLockReason={actionLockReason}
            busyAction={busyAction}
            incident={incident}
            rule={rule}
            onDismiss={() =>
              setDismissedRuleIds((current) => {
                const next = new Set(current);
                next.add(rule.id);
                return next;
              })
            }
            onRun={() =>
              onAction(
                `rule:${rule.ruleId}:${rule.targetId}`,
                `/api/incidents/${incident.postId}/rules/${rule.ruleId}/run`,
                { targetId: rule.targetId }
              )
            }
          />
        ))}
      </CardContent>
    </Card>
  );
};

const counterScopeLabels: Record<string, string> = {
  domain: 'this domain',
  post: 'this post',
  thread: 'this thread',
  user: 'this user',
};

const readableRuleReason = (reason: string) => {
  const counterMatch = /^(post|thread|user|domain) counter (\d+)\/(\d+)$/.exec(
    reason
  );

  if (!counterMatch) return reason;

  const scope = counterMatch[1];
  const count = counterMatch[2];
  const threshold = counterMatch[3];

  if (!scope || !count || !threshold) return reason;

  const scopeLabel = counterScopeLabels[scope] ?? 'this item';
  return `Matched ${count} times on ${scopeLabel} (threshold ${threshold})`;
};

const MatchedRuleItem = ({
  actionLocked,
  actionLockReason,
  busyAction,
  incident,
  rule,
  onDismiss,
  onRun,
}: {
  actionLocked: boolean;
  actionLockReason: string;
  busyAction: string | undefined;
  incident: Incident;
  rule: MatchedAutomationRule;
  onDismiss: () => void;
  onRun: () => void;
}) => {
  const actionId = `rule:${rule.ruleId}:${rule.targetId}`;
  const canRun = rule.mode !== 'suggest_only';
  const [confirmRun, setConfirmRun] = useState(false);
  const runActions = () => {
    if (!confirmRun) {
      setConfirmRun(true);
      return;
    }
    setConfirmRun(false);
    onRun();
  };

  return (
    <article className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold leading-5">
            <span>{rule.ruleName}</span>
            {rule.username ? (
              <>
                <span className="text-muted-foreground">for</span>
                <UsernameHistoryTrigger
                  className="text-sm"
                  incident={incident}
                  username={rule.username}
                />
              </>
            ) : null}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{RULE_MODE_LABELS[rule.mode]}</Badge>
            <Badge title={formatRatingTitle(incident.score)} variant="outline">
              {formatRating(incident.score)}
            </Badge>
          </div>
        </div>
        <RedditShieldIcon className="size-5 text-muted-foreground" />
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Why it matched
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rule.why.map((reason) => (
              <li key={reason} className="flex gap-2 text-sm leading-5">
                <RedditReportIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{readableRuleReason(reason)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Actions ready
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {rule.preparedActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{action.label}</span>
                <span className="shrink-0 text-[11px] font-bold uppercase text-muted-foreground">
                  {action.risk}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {confirmRun ? (
          <p className="w-full text-xs leading-5 text-muted-foreground">
            Confirm to run every action listed above.
          </p>
        ) : null}
        <PlaybookButton
          disabled={!canRun || Boolean(busyAction) || actionLocked}
          icon={<RedditApproveIcon data-icon="inline-start" />}
          label={
            canRun
              ? confirmRun
                ? 'Confirm run'
                : 'Run automation'
              : 'Suggestion only'
          }
          loading={busyAction === actionId}
          title={actionLocked ? actionLockReason : undefined}
          variant={confirmRun ? 'destructive' : 'default'}
          onClick={runActions}
        />
        <PlaybookButton
          label="Hide for now"
          variant="ghost"
          onClick={() => {
            setConfirmRun(false);
            onDismiss();
          }}
        />
      </div>
    </article>
  );
};
