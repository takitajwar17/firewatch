import { useState, type ComponentProps } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  FIREWATCH_DEMO_SCENARIOS,
} from '../../shared/firewatch-presets';
import {
  CONFIG_ACTION_CONTROL_GROUPS,
  CONFIG_CORE_ACTION_FIELDS,
  CONFIG_SIGNAL_WEIGHT_FIELDS,
  type ConfigActionControlField,
} from '../../shared/firewatch-config';
import {
  RULE_MODE_LABELS,
  RULE_TARGET_LABELS,
  RULE_TRIGGER_LABELS,
  defaultRuleScope,
  summarizeRule,
} from '../../shared/automation-rules';
import {
  DisclosurePanel,
  FieldBlock,
  PlaybookButton,
  SectionHeader,
} from './common';
import { splitList } from './format';
import type {
  FirewatchConfig,
  FirewatchRule,
  FirewatchRuleInput,
  RuleExecutionLog,
  RuleAction,
  RuleMode,
  RuleTestResponse,
  RuleTrigger,
} from '../../shared/api';
import type {
  ConfigSaveHandler,
  DemoCreateHandler,
  RuleSaveHandler,
  RuleTestHandler,
} from './types';
import {
  RedditAddIcon,
  RedditApproveIcon,
  RedditChevronDownIcon,
  RedditRemoveIcon,
  RedditReportIcon,
} from './reddit-icons';

export const CommunitySettingsPage = ({
  busyAction,
  config,
  hasDemoIncidents,
  onCreateDemo,
  onResetDemos,
  onSaveConfig,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  hasDemoIncidents: boolean;
  onCreateDemo: DemoCreateHandler;
  onResetDemos: () => void;
  onSaveConfig: ConfigSaveHandler;
}) => {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <SectionHeader
        description="Subreddit-wide filters, scoring, sticky text, and action access."
        title="Settings"
      />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CommunityFiltersCard
          key={[
            config.keywords.join('|'),
            config.suspiciousDomains.join('|'),
            config.heatThreshold,
            config.fireThreshold,
            config.wildfireThreshold,
            config.reminderText,
            Object.values(config.actionControls).join('|'),
            Object.values(config.signalWeights).join('|'),
          ].join(':')}
          busy={busyAction === 'config'}
          config={config}
          onSave={onSaveConfig}
        />
        <CommunityToolsCard
          busyAction={busyAction}
          hasDemoIncidents={hasDemoIncidents}
          onCreateDemo={onCreateDemo}
          onResetDemos={onResetDemos}
        />
      </div>
    </div>
  );
};

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
    <Card>
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
  <article className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/35 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-5">
          {rule.enabled ? '✓ ' : ''}
          {rule.name}
        </p>
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
          {summarizeRule(rule)}
        </p>
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

type BuilderConditionType =
  | 'incident_score'
  | 'post_reports'
  | 'text_contains'
  | 'user_strikes'
  | 'user_removed_comments'
  | 'watched_domain_hit'
  | 'watched_word_hit';

type BuilderActionType =
  | 'add_native_mod_note'
  | 'generate_handoff'
  | 'remove_comment'
  | 'sticky_reminder'
  | 'strike_and_note'
  | 'temp_ban';

const RULE_TRIGGER_OPTIONS: {
  label: string;
  value: RuleTrigger['type'];
}[] = [
  { label: RULE_TRIGGER_LABELS.new_comment, value: 'new_comment' },
  { label: RULE_TRIGGER_LABELS.new_post, value: 'new_post' },
  { label: RULE_TRIGGER_LABELS.comment_report, value: 'comment_report' },
  { label: RULE_TRIGGER_LABELS.post_report, value: 'post_report' },
  { label: RULE_TRIGGER_LABELS.comment_removed, value: 'comment_removed' },
  { label: RULE_TRIGGER_LABELS.post_removed, value: 'post_removed' },
  {
    label: RULE_TRIGGER_LABELS.incident_score_changed,
    value: 'incident_score_changed',
  },
  {
    label: RULE_TRIGGER_LABELS.user_strike_count_changed,
    value: 'user_strike_count_changed',
  },
];

const RULE_TARGET_OPTIONS: {
  label: string;
  value: FirewatchRule['scope']['target'];
}[] = [
  { label: RULE_TARGET_LABELS.comment, value: 'comment' },
  { label: RULE_TARGET_LABELS.post, value: 'post' },
  { label: RULE_TARGET_LABELS.user, value: 'user' },
  { label: RULE_TARGET_LABELS.incident, value: 'incident' },
];

const RULE_CONDITION_OPTIONS: {
  label: string;
  value: BuilderConditionType;
}[] = [
  { label: 'Watched domain hit', value: 'watched_domain_hit' },
  { label: 'Watched word hit', value: 'watched_word_hit' },
  { label: 'Text contains phrase', value: 'text_contains' },
  { label: 'Author has Firewatch strikes', value: 'user_strikes' },
  { label: 'Author has removed comments', value: 'user_removed_comments' },
  { label: 'Post has reports', value: 'post_reports' },
  { label: 'Review score is at least', value: 'incident_score' },
];

const RULE_ACTION_OPTIONS: {
  label: string;
  value: BuilderActionType;
}[] = [
  { label: 'Add strike and mod note', value: 'strike_and_note' },
  { label: 'Prepare comment removal', value: 'remove_comment' },
  { label: 'Add Reddit mod note', value: 'add_native_mod_note' },
  { label: 'Prepare 1-day ban', value: 'temp_ban' },
  { label: 'Save handoff draft', value: 'generate_handoff' },
  { label: 'Draft sticky comment', value: 'sticky_reminder' },
];

const RULE_MODE_OPTIONS: {
  label: string;
  value: RuleMode;
}[] = [
  { label: RULE_MODE_LABELS.suggest_only, value: 'suggest_only' },
  {
    label: RULE_MODE_LABELS.prepare_for_approval,
    value: 'prepare_for_approval',
  },
  {
    label: RULE_MODE_LABELS.auto_run_safe_actions,
    value: 'auto_run_safe_actions',
  },
  {
    label: RULE_MODE_LABELS.auto_run_all_selected_actions,
    value: 'auto_run_all_selected_actions',
  },
];

const firstBuilderCondition = (
  rule: FirewatchRule | undefined
): BuilderConditionType => {
  const type = rule?.conditions[0]?.type;
  if (
    type === 'incident_score' ||
    type === 'post_reports' ||
    type === 'text_contains' ||
    type === 'user_strikes' ||
    type === 'user_removed_comments' ||
    type === 'watched_domain_hit' ||
    type === 'watched_word_hit'
  ) {
    return type;
  }
  return 'watched_domain_hit';
};

const firstBuilderAction = (
  rule: FirewatchRule | undefined
): BuilderActionType => {
  const actionTypes = rule?.actions.map((action) => action.type) ?? [];
  if (actionTypes.includes('prepare_temp_ban')) return 'temp_ban';
  if (
    actionTypes.includes('add_firewatch_strike') &&
    actionTypes.includes('add_native_mod_note')
  ) {
    return 'strike_and_note';
  }
  const firstAction = actionTypes[0];
  if (
    firstAction === 'add_native_mod_note' ||
    firstAction === 'generate_handoff' ||
    firstAction === 'remove_comment' ||
    firstAction === 'sticky_reminder'
  ) {
    return firstAction;
  }
  return 'strike_and_note';
};

const firstConditionDefaults = (rule: FirewatchRule | undefined) => {
  const condition = rule?.conditions[0];
  if (!condition) {
    return {
      phrase: 'recovery agent',
      threshold: '2',
      windowHours: '24',
    };
  }

  if (condition.type === 'text_contains') {
    return {
      phrase: condition.value,
      threshold: '2',
      windowHours: '24',
    };
  }

  if (
    condition.type === 'watched_word_hit' ||
    condition.type === 'watched_domain_hit'
  ) {
    return {
      phrase: 'recovery agent',
      threshold: String(condition.minHits),
      windowHours: '24',
    };
  }

  if (
    condition.type === 'user_strikes' ||
    condition.type === 'user_removed_comments' ||
    condition.type === 'post_reports'
  ) {
    return {
      phrase: 'recovery agent',
      threshold: String(condition.value),
      windowHours: String(
        Math.max(1, Math.round((condition.windowMinutes ?? 24 * 60) / 60))
      ),
    };
  }

  if (condition.type === 'incident_score') {
    return {
      phrase: 'recovery agent',
      threshold: String(condition.value),
      windowHours: '24',
    };
  }

  return {
    phrase: 'recovery agent',
    threshold: '2',
    windowHours: '24',
  };
};

const actionSignature = (action: RuleAction) =>
  action.type === 'mark_spam' || action.type === 'ignore_reports'
    ? `${action.type}:${action.target}`
    : action.type;

const mergeExistingActions = (
  nextActions: FirewatchRuleInput['actions'],
  existingActions: FirewatchRule['actions']
) => {
  const seen = new Set(nextActions.map(actionSignature));
  const preserved = existingActions.filter((action) => {
    const signature = actionSignature(action);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });

  return [...nextActions, ...preserved];
};

const RuleBuilder = ({
  busy,
  rule,
  subredditId,
  onCancel,
  onSave,
  onTestRule,
}: {
  busy: boolean;
  rule: FirewatchRule | undefined;
  subredditId: string;
  onCancel: () => void;
  onSave: (input: FirewatchRuleInput) => Promise<void>;
  onTestRule: (ruleId: string) => void;
}) => {
  const [name, setName] = useState(rule?.name ?? 'Scam link response');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [triggerType, setTriggerType] = useState<RuleTrigger['type']>(
    rule?.trigger.type ?? 'new_comment'
  );
  const [target, setTarget] = useState(rule?.scope.target ?? 'comment');
  const [initialRuleState] = useState(() => ({
    actionType: firstBuilderAction(rule),
    conditionDefaults: firstConditionDefaults(rule),
    conditionType: firstBuilderCondition(rule),
  }));
  const [conditionType, setConditionType] = useState<BuilderConditionType>(
    initialRuleState.conditionType
  );
  const [phrase, setPhrase] = useState(
    initialRuleState.conditionDefaults.phrase
  );
  const [threshold, setThreshold] = useState(
    initialRuleState.conditionDefaults.threshold
  );
  const [windowHours, setWindowHours] = useState(
    initialRuleState.conditionDefaults.windowHours
  );
  const [actionType, setActionType] = useState<BuilderActionType>(
    initialRuleState.actionType
  );
  const [mode, setMode] = useState<RuleMode>(
    rule?.mode ?? 'prepare_for_approval'
  );
  const validName = name.trim().length > 0;

  const buildCondition = (): FirewatchRuleInput['conditions'] => {
    const numericThreshold = Math.max(1, Number(threshold) || 1);
    const windowMinutes = Math.max(1, Number(windowHours) || 1) * 60;

    if (conditionType === 'text_contains') {
      return [
        {
          type: 'text_contains',
          value: phrase,
          match: 'contains',
          caseSensitive: false,
        },
      ];
    }
    if (conditionType === 'watched_word_hit') {
      return [{ type: 'watched_word_hit', minHits: numericThreshold }];
    }
    if (conditionType === 'watched_domain_hit') {
      return [{ type: 'watched_domain_hit', minHits: numericThreshold }];
    }
    if (conditionType === 'user_strikes') {
      return [
        {
          type: 'user_strikes',
          operator: '>=',
          value: numericThreshold,
          windowMinutes,
        },
      ];
    }
    if (conditionType === 'user_removed_comments') {
      return [
        {
          type: 'user_removed_comments',
          operator: '>=',
          value: numericThreshold,
          windowMinutes,
        },
      ];
    }
    if (conditionType === 'post_reports') {
      return [
        {
          type: 'post_reports',
          operator: '>=',
          value: numericThreshold,
          windowMinutes,
        },
      ];
    }
    return [
      {
        type: 'incident_score',
        operator: '>=',
        value: Math.max(1, Math.min(100, numericThreshold)),
      },
    ];
  };

  const buildActions = (): FirewatchRuleInput['actions'] => {
    if (actionType === 'remove_comment') {
      return [
        {
          type: 'remove_comment',
          reason: 'Automation prepared comment removal',
        },
      ];
    }
    if (actionType === 'add_native_mod_note') {
      return [
        {
          type: 'add_native_mod_note',
          note: 'Firewatch automation matched this user.',
        },
      ];
    }
    if (actionType === 'generate_handoff') {
      return [
        {
          type: 'generate_handoff',
          template: 'Automation matched. Review prepared actions.',
        },
      ];
    }
    if (actionType === 'sticky_reminder') {
      return [
        {
          type: 'sticky_reminder',
          text: 'Mod note: This thread is under active review. Keep discussion civil and avoid suspicious links.',
        },
      ];
    }
    if (actionType === 'temp_ban') {
      return [
        {
          type: 'add_native_mod_note',
          note: 'Firewatch repeat offender automation matched.',
        },
        {
          type: 'prepare_temp_ban',
          durationDays: 1,
          reason: 'Repeated rule-breaking behavior tracked by Firewatch',
        },
      ];
    }
    return [
      {
        type: 'add_firewatch_strike',
        reason: 'Automation matched',
        weight: 1,
      },
      {
        type: 'add_native_mod_note',
        note: 'Firewatch automation matched this user.',
      },
    ];
  };

  const saveRule = () => {
    const builtConditions = buildCondition();
    const conditions =
      rule && conditionType === initialRuleState.conditionType
        ? [...builtConditions, ...rule.conditions.slice(1)]
        : builtConditions;
    const builtActions = buildActions();
    const actions =
      rule && actionType === initialRuleState.actionType
        ? mergeExistingActions(builtActions, rule.actions)
        : builtActions;
    const scope = {
      ...defaultRuleScope(subredditId, target),
      ...(rule?.scope ?? {}),
      target,
      subredditId,
    };

    return onSave({
      ...(rule ? { id: rule.id } : {}),
      name,
      ...(description.trim() ? { description: description.trim() } : {}),
      enabled,
      trigger: { type: triggerType },
      scope,
      conditions,
      ...(rule?.counter ? { counter: rule.counter } : {}),
      actions,
      mode,
    });
  };

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <FieldBlock htmlFor="fw-rule-name" label="Automation name">
          <Input
            id="fw-rule-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FieldBlock>
        <FieldBlock htmlFor="fw-rule-description" label="Description">
          <Input
            id="fw-rule-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FieldBlock>
        <RuleSelect
          id="fw-rule-trigger"
          label="When"
          options={RULE_TRIGGER_OPTIONS}
          value={triggerType}
          onChange={(value) => setTriggerType(value)}
        />
        <RuleSelect
          id="fw-rule-target"
          label="Apply to"
          options={RULE_TARGET_OPTIONS}
          value={target}
          onChange={(value) => setTarget(value)}
        />
        <RuleSelect
          id="fw-rule-condition"
          label="If"
          options={RULE_CONDITION_OPTIONS}
          value={conditionType}
          onChange={(value) => setConditionType(value)}
        />
        {conditionType === 'text_contains' ? (
          <FieldBlock htmlFor="fw-rule-phrase" label="Phrase">
            <Input
              id="fw-rule-phrase"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
            />
          </FieldBlock>
        ) : (
          <FieldBlock htmlFor="fw-rule-threshold" label="Threshold">
            <Input
              id="fw-rule-threshold"
              inputMode="numeric"
              type="number"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </FieldBlock>
        )}
        {(conditionType === 'user_removed_comments' ||
          conditionType === 'user_strikes' ||
          conditionType === 'post_reports') && (
          <FieldBlock htmlFor="fw-rule-window" label="Within hours">
            <Input
              id="fw-rule-window"
              inputMode="numeric"
              type="number"
              value={windowHours}
              onChange={(event) => setWindowHours(event.target.value)}
            />
          </FieldBlock>
        )}
        <RuleSelect
          id="fw-rule-action"
          label="Then"
          options={RULE_ACTION_OPTIONS}
          value={actionType}
          onChange={(value) => setActionType(value)}
        />
        <RuleSelect
          id="fw-rule-mode"
          label="Safety mode"
          options={RULE_MODE_OPTIONS}
          value={mode}
          onChange={(value) => setMode(value)}
        />
      </div>
      <label className="mt-3 flex w-fit items-center gap-2 text-sm font-semibold">
        <input
          checked={enabled}
          className="size-4 accent-primary"
          type="checkbox"
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Enabled
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <PlaybookButton
          disabled={busy || !validName}
          icon={<RedditApproveIcon data-icon="inline-start" />}
          label="Save automation"
          loading={busy}
          loadingLabel="Saving"
          variant="default"
          onClick={saveRule}
        />
        <PlaybookButton
          disabled={!rule}
          label="Test automation"
          title={rule ? undefined : 'Save the automation before testing it'}
          variant="outline"
          onClick={() => {
            if (rule) onTestRule(rule.id);
          }}
        />
        <PlaybookButton label="Cancel" variant="ghost" onClick={onCancel} />
      </div>
    </div>
  );
};

const RuleSelect = <Value extends string>({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: Value) => void;
  options: {
    label: string;
    value: Value;
  }[];
  value: Value;
}) => (
  <FieldBlock htmlFor={id} label={label}>
    <div className="relative min-w-0">
      <select
        id={id}
        className="h-9 w-full min-w-0 appearance-none rounded-full border border-transparent bg-secondary py-0 pr-11 pl-4 text-sm outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
        value={value}
        onChange={(event) => {
          const option = options.find(
            (item) => item.value === event.target.value
          );
          if (option) onChange(option.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <RedditChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  </FieldBlock>
);

const RuleTestResultCard = ({ result }: { result: RuleTestResponse }) => (
  <div className="rounded-lg border bg-card p-3">
    <p className="text-sm font-bold leading-5">
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
  <div className="rounded-lg border bg-card p-3">
    <p className="text-sm font-bold leading-5">Recent matches</p>
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

const CommunityFiltersCard = ({
  busy,
  config,
  onSave,
}: {
  busy: boolean;
  config: FirewatchConfig;
  onSave: ConfigSaveHandler;
}) => {
  const [keywords, setKeywords] = useState(() => config.keywords.join(', '));
  const [suspiciousDomains, setSuspiciousDomains] = useState(() =>
    config.suspiciousDomains.join(', ')
  );
  const [heatThreshold, setHeatThreshold] = useState(() =>
    String(config.heatThreshold)
  );
  const [fireThreshold, setFireThreshold] = useState(() =>
    String(config.fireThreshold)
  );
  const [wildfireThreshold, setWildfireThreshold] = useState(() =>
    String(config.wildfireThreshold)
  );
  const [reminderText, setReminderText] = useState(() => config.reminderText);
  const [actionControls, setActionControls] = useState(
    () => config.actionControls
  );
  const [signalWeights, setSignalWeights] = useState(
    () => config.signalWeights
  );

  const parsedHeat = Number(heatThreshold);
  const parsedFire = Number(fireThreshold);
  const parsedWildfire = Number(wildfireThreshold);
  const invalidThresholds =
    !Number.isFinite(parsedHeat) ||
    !Number.isFinite(parsedFire) ||
    !Number.isFinite(parsedWildfire) ||
    parsedHeat < 1 ||
    parsedFire <= parsedHeat ||
    parsedWildfire <= parsedFire ||
    parsedWildfire > 100;

  const saveSettings = () =>
    onSave({
      keywords,
      suspiciousDomains,
      heatThreshold: parsedHeat,
      fireThreshold: parsedFire,
      wildfireThreshold: parsedWildfire,
      reminderText,
      actionControls,
      signalWeights,
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSaveBar
        busy={busy}
        disabled={invalidThresholds}
        onSave={saveSettings}
      />

      <Card>
        <CardHeader>
          <CardTitle>Subreddit filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldBlock
            htmlFor="fw-keywords"
            label={`Watched words (${splitList(keywords).length})`}
          >
            <SettingsTextarea
              id="fw-keywords"
              rows={4}
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
          </FieldBlock>

          <FieldBlock
            htmlFor="fw-domains"
            label={`Watched domains (${splitList(suspiciousDomains).length})`}
          >
            <SettingsTextarea
              id="fw-domains"
              rows={3}
              value={suspiciousDomains}
              onChange={(event) => setSuspiciousDomains(event.target.value)}
            />
          </FieldBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scoring</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold leading-5">
              When a post enters review
            </p>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <ThresholdInput
                id="review"
                label="Review at"
                value={heatThreshold}
                onChange={setHeatThreshold}
              />
              <ThresholdInput
                id="act"
                label="Priority at"
                value={fireThreshold}
                onChange={setFireThreshold}
              />
              <ThresholdInput
                id="lock"
                label="High priority at"
                value={wildfireThreshold}
                onChange={setWildfireThreshold}
              />
            </div>
          </div>

          <DisclosurePanel title="Signal weights">
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {CONFIG_SIGNAL_WEIGHT_FIELDS.map((field) => (
                <ThresholdInput
                  key={field.id}
                  id={`weight-${field.id}`}
                  label={field.label}
                  max={50}
                  min={0}
                  value={String(signalWeights[field.id])}
                  onChange={(value) =>
                    setSignalWeights((current) => ({
                      ...current,
                      [field.id]: parseNumberInput(value, current[field.id]),
                    }))
                  }
                />
              ))}
            </div>
          </DisclosurePanel>

          {invalidThresholds ? (
            <Alert variant="destructive">
              <RedditReportIcon />
              <AlertTitle>Scores need ordering</AlertTitle>
              <AlertDescription>
                Use numbers from 1 to 100 where Review is below Priority and
                Priority is below High priority.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sticky comment</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldBlock htmlFor="fw-reminder-text" label="Comment text">
            <SettingsTextarea
              id="fw-reminder-text"
              maxLength={800}
              rows={4}
              value={reminderText}
              onChange={(event) => setReminderText(event.target.value)}
            />
          </FieldBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available mod actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ActionPermissionsControl
            actionControls={actionControls}
            onChange={setActionControls}
          />
        </CardContent>
      </Card>
    </div>
  );
};

const SettingsSaveBar = ({
  busy,
  disabled,
  onSave,
}: {
  busy: boolean;
  disabled: boolean;
  onSave: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm leading-5 text-muted-foreground">
      These settings apply across the subreddit.
    </p>
    <PlaybookButton
      className="w-full sm:w-fit"
      disabled={busy || disabled}
      icon={<RedditApproveIcon data-icon="inline-start" />}
      label="Save settings"
      loading={busy}
      loadingLabel="Saving"
      variant="default"
      onClick={onSave}
    />
  </div>
);

const ActionPermissionsControl = ({
  actionControls,
  onChange,
}: {
  actionControls: FirewatchConfig['actionControls'];
  onChange: (value: FirewatchConfig['actionControls']) => void;
}) => {
  const toggleAction = (
    id: keyof FirewatchConfig['actionControls'],
    checked: boolean
  ) => {
    onChange({
      ...actionControls,
      [id]: checked,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ActionToggleGroup
        actionControls={actionControls}
        fields={CONFIG_CORE_ACTION_FIELDS}
        onChange={toggleAction}
      />

      <DisclosurePanel title="Post, comment, and user actions">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {CONFIG_ACTION_CONTROL_GROUPS.slice(1).map((group) => (
            <ActionToggleGroup
              key={
                group.title ?? group.fields.map((field) => field.id).join(':')
              }
              actionControls={actionControls}
              fields={group.fields}
              title={group.title ?? ''}
              onChange={toggleAction}
            />
          ))}
        </div>
      </DisclosurePanel>
    </div>
  );
};

const ActionToggleGroup = ({
  actionControls,
  fields,
  onChange,
  title,
}: {
  actionControls: FirewatchConfig['actionControls'];
  fields: ConfigActionControlField[];
  onChange: (
    id: keyof FirewatchConfig['actionControls'],
    checked: boolean
  ) => void;
  title?: string;
}) => (
  <div className="flex flex-col gap-2">
    {title ? (
      <p className="text-xs font-semibold leading-5 text-muted-foreground">
        {title}
      </p>
    ) : null}
    <div className="grid min-w-0 gap-2 md:grid-cols-2">
      {fields.map((field) => (
        <label
          key={field.id}
          className="group flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent"
        >
          <span className="min-w-0 truncate">{field.label}</span>
          <span className="relative inline-flex h-6 w-10 shrink-0 items-center">
            <input
              checked={actionControls[field.id]}
              className="peer sr-only"
              type="checkbox"
              onChange={(event) => onChange(field.id, event.target.checked)}
            />
            <span className="absolute inset-0 rounded-full bg-muted ring-1 ring-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/35" />
            <span className="absolute left-0.5 size-5 rounded-full bg-card shadow-sm transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
      ))}
    </div>
  </div>
);

const parseNumberInput = (value: string, fallback: number) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const SettingsTextarea = ({
  className,
  ...props
}: ComponentProps<'textarea'>) => (
  <textarea
    className={cn(
      'min-h-24 w-full min-w-0 resize-y rounded-lg border border-transparent bg-secondary px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const ThresholdInput = ({
  id,
  label,
  max = 100,
  min = 1,
  onChange,
  value,
}: {
  id: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  value: string;
}) => (
  <FieldBlock htmlFor={`fw-threshold-${id}`} label={label}>
    <Input
      id={`fw-threshold-${id}`}
      inputMode="numeric"
      max={max}
      min={min}
      step={1}
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </FieldBlock>
);

const CommunityToolsCard = ({
  busyAction,
  hasDemoIncidents,
  onCreateDemo,
  onResetDemos,
}: {
  busyAction: string | undefined;
  hasDemoIncidents: boolean;
  onCreateDemo: DemoCreateHandler;
  onResetDemos: () => void;
}) => {
  const [scenarioId, setScenarioId] = useState(DEFAULT_DEMO_SCENARIO_ID);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-5 text-muted-foreground">
          For testing the app. Does not change subreddit settings.
        </p>
        <FieldBlock htmlFor="fw-demo-scenario" label="Demo scenario">
          <div className="relative min-w-0">
            <select
              id="fw-demo-scenario"
              className="h-9 w-full min-w-0 appearance-none rounded-full border border-transparent bg-secondary py-0 pr-11 pl-4 text-sm outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
              value={scenarioId}
              onChange={(event) => {
                const nextScenario = FIREWATCH_DEMO_SCENARIOS.find(
                  (scenario) => scenario.id === event.target.value
                );
                if (nextScenario) setScenarioId(nextScenario.id);
              }}
            >
              {FIREWATCH_DEMO_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
            <RedditChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </FieldBlock>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <PlaybookButton
            disabled={busyAction === 'demo'}
            icon={<RedditAddIcon data-icon="inline-start" />}
            label="Create demo thread"
            loading={busyAction === 'demo'}
            loadingLabel="Creating"
            variant="outline"
            onClick={() => onCreateDemo(scenarioId)}
          />
          <PlaybookButton
            disabled={!hasDemoIncidents || busyAction === 'reset-demo'}
            icon={<RedditRemoveIcon data-icon="inline-start" />}
            label="Reset demos"
            loading={busyAction === 'reset-demo'}
            loadingLabel="Clearing"
            variant="ghost"
            onClick={onResetDemos}
          />
        </div>
      </CardContent>
    </Card>
  );
};
