import { useState } from 'react';
import {
  RULE_MODE_LABELS,
  defaultRuleScope,
} from '../../../shared/automation-rules';
import type {
  FirewatchRule,
  FirewatchRuleInput,
  RuleMode,
  RuleTrigger,
} from '../../../shared/api';
import {
  FIREWATCH_THRESHOLD_RATINGS,
  firewatchRatingFromScore,
  firewatchRatingInfo,
  firewatchRatingMinScore,
  firewatchRatingStars,
  type FirewatchRating,
} from '../../../shared/firewatch-rating.js';
import { FieldBlock, Input, PlaybookButton } from '../common';
import { RedditApproveIcon, RedditChevronDownIcon } from '../reddit-icons';
import {
  RULE_ACTION_OPTIONS,
  RULE_CONDITION_OPTIONS,
  RULE_MODE_OPTIONS,
  RULE_TARGET_OPTIONS,
  RULE_TRIGGER_OPTIONS,
  firstBuilderAction,
  firstBuilderCondition,
  firstConditionDefaults,
  mergeExistingActions,
  safetyModeDetail,
  type BuilderActionType,
  type BuilderConditionType,
} from './rule-builder-model';

export const RuleBuilder = ({
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
    <div className="rounded-md border bg-muted/40 p-3">
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
        ) : conditionType === 'incident_score' ? (
          <RatingConditionSelect
            score={Number(threshold) || 1}
            onChangeScore={(score) => setThreshold(String(score))}
          />
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
      <SafetyModeNote mode={mode} />
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

const ratingFromSelectValue = (value: string): FirewatchRating | undefined => {
  switch (value) {
    case '1':
      return 1;
    case '2':
      return 2;
    case '3':
      return 3;
    case '4':
      return 4;
    case '5':
      return 5;
    default:
      return undefined;
  }
};

const RatingConditionSelect = ({
  onChangeScore,
  score,
}: {
  onChangeScore: (score: number) => void;
  score: number;
}) => {
  const rating = firewatchRatingFromScore(score);

  return (
    <FieldBlock
      description={`Automation stores this as signal score ${score}/100.`}
      htmlFor="fw-rule-rating"
      label="Rating"
    >
      <div className="relative min-w-0">
        <select
          id="fw-rule-rating"
          className="h-9 w-full min-w-0 appearance-none rounded-full border border-transparent bg-secondary py-0 pr-11 pl-4 text-sm outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          value={String(rating)}
          onChange={(event) => {
            const nextRating = ratingFromSelectValue(event.target.value);
            if (nextRating) onChangeScore(firewatchRatingMinScore(nextRating));
          }}
        >
          {FIREWATCH_THRESHOLD_RATINGS.map((optionRating) => {
            const info = firewatchRatingInfo(
              firewatchRatingMinScore(optionRating)
            );

            return (
              <option key={optionRating} value={optionRating}>
                {firewatchRatingStars(optionRating)} {info.rating}/5{' '}
                {info.label}
              </option>
            );
          })}
        </select>
        <RedditChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </FieldBlock>
  );
};

const SafetyModeNote = ({ mode }: { mode: RuleMode }) => (
  <div className="mt-3 rounded-md border bg-background px-3 py-2">
    <p className="text-sm font-semibold leading-5">{RULE_MODE_LABELS[mode]}</p>
    <p className="text-xs leading-5 text-muted-foreground">
      {safetyModeDetail[mode]}
    </p>
  </div>
);
