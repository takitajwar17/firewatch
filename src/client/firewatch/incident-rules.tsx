import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RULE_MODE_LABELS } from '../../shared/automation-rules';
import type { Incident, MatchedAutomationRule } from '../../shared/api';
import { PlaybookButton } from './common';
import type { ActionRunner } from './types';
import {
  RedditApproveIcon,
  RedditReportIcon,
  RedditSettingsIcon,
  RedditShieldIcon,
} from './reddit-icons';

export const MatchedRulesCard = ({
  busyAction,
  incident,
  onAction,
  onEditRules,
}: {
  busyAction: string | undefined;
  incident: Incident;
  onAction: ActionRunner;
  onEditRules: () => void;
}) => {
  const [dismissedRuleIds, setDismissedRuleIds] = useState<Set<string>>(
    () => new Set()
  );
  const matchedRules = (incident.matchedRules ?? []).filter(
    (rule) => !dismissedRuleIds.has(rule.id)
  );

  if (matchedRules.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prepared automation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {matchedRules.map((rule) => (
          <MatchedRuleItem
            key={rule.id}
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
            onEditRules={onEditRules}
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

const MatchedRuleItem = ({
  busyAction,
  incident,
  rule,
  onDismiss,
  onEditRules,
  onRun,
}: {
  busyAction: string | undefined;
  incident: Incident;
  rule: MatchedAutomationRule;
  onDismiss: () => void;
  onEditRules: () => void;
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
    <article className="rounded-lg border bg-muted/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold leading-6">{rule.ruleName}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{RULE_MODE_LABELS[rule.mode]}</Badge>
            {rule.username ? (
              <Badge variant="outline">u/{rule.username}</Badge>
            ) : null}
            <Badge variant="outline">{incident.score}/100</Badge>
          </div>
        </div>
        <RedditShieldIcon className="size-5 text-muted-foreground" />
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Why it matched
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rule.why.map((reason) => (
              <li key={reason} className="flex gap-2 text-sm leading-5">
                <RedditReportIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
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
        {canRun ? (
          <p className="w-full text-xs leading-5 text-muted-foreground">
            {confirmRun
              ? 'Confirm to run every action listed above.'
              : 'Review the actions above before running them.'}
          </p>
        ) : null}
        <PlaybookButton
          disabled={!canRun || Boolean(busyAction)}
          icon={<RedditApproveIcon data-icon="inline-start" />}
          label={
            canRun
              ? confirmRun
                ? 'Confirm run'
                : 'Run automation'
              : 'Suggestion only'
          }
          loading={busyAction === actionId}
          variant={confirmRun ? 'destructive' : 'default'}
          onClick={runActions}
        />
        <PlaybookButton
          icon={<RedditSettingsIcon data-icon="inline-start" />}
          label="Edit automation"
          variant="outline"
          onClick={onEditRules}
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
