import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RULE_MODE_LABELS, summarizeRule } from '../../../shared/automation-rules';
import type {
  FirewatchRule,
  RuleExecutionLog,
  RuleTestResponse,
} from '../../../shared/api';
import type { RuleSaveHandler, RuleTestHandler } from '../types';
import { PlaybookButton } from '../common';
import {
  RedditAddIcon,
  RedditApproveIcon,
  RedditRemoveIcon,
  RedditReportIcon,
} from '../reddit-icons';
import { RuleBuilder } from './rule-builder';

export const AutomationsCard = ({
  busyAction,
  ruleLogs,
  rules,
  subredditId,
  onDisableAllRules,
  onImportTemplates,
  onSaveRule,
  onTestRule,
}: {
  busyAction: string | undefined;
  ruleLogs: RuleExecutionLog[];
  rules: FirewatchRule[];
  subredditId: string;
  onDisableAllRules: () => void;
  onImportTemplates: () => void;
  onSaveRule: RuleSaveHandler;
  onTestRule: RuleTestHandler;
}) => {
  const [editingRule, setEditingRule] = useState<FirewatchRule | undefined>();
  const [creating, setCreating] = useState(false);
  const [confirmDisableAll, setConfirmDisableAll] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [testResult, setTestResult] = useState<RuleTestResponse | undefined>();
  const showBuilder = creating || Boolean(editingRule);

  const testRule = async (ruleId: string) => {
    const result = await onTestRule(ruleId);
    if (result) {
      setTestResult(result);
      setShowLogs(true);
    }
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Automations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <PlaybookButton
            icon={<RedditAddIcon data-icon="inline-start" />}
            label="Create automation"
            variant="default"
            onClick={() => {
              setCreating(true);
              setEditingRule(undefined);
              setConfirmDisableAll(false);
            }}
          />
          <PlaybookButton
            disabled={busyAction === 'rule-import'}
            icon={<RedditAddIcon data-icon="inline-start" />}
            label="Import templates"
            loading={busyAction === 'rule-import'}
            loadingLabel="Importing"
            variant="outline"
            onClick={onImportTemplates}
          />
          <PlaybookButton
            disabled={busyAction === 'rule-disable-all' || rules.length === 0}
            icon={<RedditRemoveIcon data-icon="inline-start" />}
            label={confirmDisableAll ? 'Confirm disable all' : 'Disable all'}
            loading={busyAction === 'rule-disable-all'}
            loadingLabel="Disabling"
            variant={confirmDisableAll ? 'destructive' : 'ghost'}
            onClick={() => {
              if (!confirmDisableAll) {
                setConfirmDisableAll(true);
                return;
              }
              setConfirmDisableAll(false);
              onDisableAllRules();
            }}
          />
          <PlaybookButton
            icon={<RedditReportIcon data-icon="inline-start" />}
            label="Recent matches"
            variant={showLogs ? 'secondary' : 'ghost'}
            onClick={() => setShowLogs((current) => !current)}
          />
        </div>

        <Alert>
          <RedditApproveIcon />
          <AlertTitle>Moderator approval stays in front</AlertTitle>
          <AlertDescription>
            Templates prepare actions by default. Reddit actions only run when a
            mod confirms them, unless the team deliberately changes the safety
            mode.
          </AlertDescription>
        </Alert>

        {showBuilder ? (
          <RuleBuilder
            key={editingRule?.id ?? 'new'}
            busy={busyAction === 'rule-save'}
            rule={editingRule}
            subredditId={subredditId}
            onCancel={() => {
              setCreating(false);
              setEditingRule(undefined);
            }}
            onSave={async (input) => {
              await onSaveRule(input);
              setCreating(false);
              setEditingRule(undefined);
            }}
            onTestRule={testRule}
          />
        ) : null}

        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          {rules.map((rule) => (
            <RuleListItem
              key={rule.id}
              busyAction={busyAction}
              rule={rule}
              onEdit={() => {
                setEditingRule(rule);
                setCreating(false);
              }}
              onTest={() => testRule(rule.id)}
            />
          ))}
        </div>

        {testResult ? <RuleTestResultCard result={testResult} /> : null}
        {showLogs ? <RuleLogPreview logs={ruleLogs} /> : null}
      </CardContent>
    </Card>
  );
};

const RuleListItem = ({
  busyAction,
  rule,
  onEdit,
  onTest,
}: {
  busyAction: string | undefined;
  rule: FirewatchRule;
  onEdit: () => void;
  onTest: () => void;
}) => (
  <article className="flex min-w-0 flex-col gap-3 rounded-md border bg-background p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-5">
          {rule.enabled ? '✓ ' : ''}
          {rule.name}
        </p>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
          {summarizeRule(rule)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant={rule.enabled ? 'secondary' : 'outline'}>
            {RULE_MODE_LABELS[rule.mode]}
          </Badge>
          {rule.mode === 'auto_run_all_selected_actions' ? (
            <Badge variant="destructive">Runs selected actions</Badge>
          ) : rule.mode === 'auto_run_safe_actions' ? (
            <Badge variant="outline">Safe actions only</Badge>
          ) : (
            <Badge variant="outline">Mod confirms</Badge>
          )}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-1 text-[11px] font-bold leading-none',
          rule.enabled
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {rule.enabled ? 'On' : 'Off'}
      </span>
    </div>
    <div className="flex flex-wrap gap-2">
      <PlaybookButton
        className="h-7 text-xs"
        label="Edit"
        variant="outline"
        onClick={onEdit}
      />
      <PlaybookButton
        className="h-7 text-xs"
        disabled={busyAction === `rule-test:${rule.id}`}
        label="Test"
        loading={busyAction === `rule-test:${rule.id}`}
        loadingLabel="Testing"
        variant="ghost"
        onClick={onTest}
      />
    </div>
  </article>
);

const RuleTestResultCard = ({ result }: { result: RuleTestResponse }) => (
  <div className="rounded-md border bg-card p-3">
    <p className="text-sm font-semibold leading-5">
      Matched {result.matchedCount} item
      {result.matchedCount === 1 ? '' : 's'} in this queue.
    </p>
    {result.examples.length ? (
      <div className="mt-3 flex flex-col gap-2">
        {result.examples.map((example, index) => (
          <div key={`${example.label}:${index}`} className="text-sm leading-5">
            <span className="font-semibold">{index + 1}. </span>
            <span>{example.label}</span>
            <span className="text-muted-foreground"> - {example.detail}</span>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        No automation matches yet.
      </p>
    )}
    {result.preparedActions.length ? (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {result.preparedActions.map((action) => (
          <span
            key={action}
            className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold"
          >
            {action}
          </span>
        ))}
      </div>
    ) : null}
  </div>
);

const RuleLogPreview = ({ logs }: { logs: RuleExecutionLog[] }) => (
  <div className="rounded-md border bg-card p-3">
    <p className="text-sm font-semibold leading-5">Recent matches</p>
    {logs.length === 0 ? (
      <p className="mt-2 text-sm leading-5 text-muted-foreground">
        No automation matches yet.
      </p>
    ) : (
      <div className="mt-2 flex flex-col gap-2">
        {logs.slice(0, 5).map((log) => (
          <div key={log.id} className="rounded-md bg-muted/60 p-2">
            <p className="text-sm font-semibold leading-5">
              {log.ruleName} matched {log.targetType} {log.targetId}.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Actions: {log.preparedActions.join(', ') || 'none'}.
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);
