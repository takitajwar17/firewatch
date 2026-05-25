import {
  RULE_MODE_LABELS,
  RULE_TARGET_LABELS,
  RULE_TRIGGER_LABELS,
} from '../../../shared/automation-rules';
import type {
  FirewatchRule,
  FirewatchRuleInput,
  RuleAction,
  RuleMode,
  RuleTrigger,
} from '../../../shared/api';

export type BuilderConditionType =
  | 'incident_score'
  | 'post_reports'
  | 'text_contains'
  | 'user_strikes'
  | 'user_removed_comments'
  | 'watched_domain_hit'
  | 'watched_word_hit';

export type BuilderActionType =
  | 'add_native_mod_note'
  | 'generate_handoff'
  | 'remove_comment'
  | 'sticky_reminder'
  | 'strike_and_note'
  | 'temp_ban';

export const RULE_TRIGGER_OPTIONS: {
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

export const RULE_TARGET_OPTIONS: {
  label: string;
  value: FirewatchRule['scope']['target'];
}[] = [
  { label: RULE_TARGET_LABELS.comment, value: 'comment' },
  { label: RULE_TARGET_LABELS.post, value: 'post' },
  { label: RULE_TARGET_LABELS.user, value: 'user' },
  { label: RULE_TARGET_LABELS.incident, value: 'incident' },
];

export const RULE_CONDITION_OPTIONS: {
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

export const RULE_ACTION_OPTIONS: {
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

export const RULE_MODE_OPTIONS: {
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

export const safetyModeDetail: Record<RuleMode, string> = {
  suggest_only: 'Shows the match and takes no action.',
  prepare_for_approval: 'Prepares actions. A mod reviews and runs them.',
  auto_run_safe_actions:
    'Runs Firewatch-only actions. Reddit actions still wait for a mod.',
  auto_run_all_selected_actions:
    'Runs selected actions automatically. Use only after testing the rule.',
};

export const firstBuilderCondition = (
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

export const firstBuilderAction = (
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

export const firstConditionDefaults = (rule: FirewatchRule | undefined) => {
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

export const mergeExistingActions = (
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
