import type {
  FirewatchRule,
  PreparedRuleAction,
  RuleAction,
  RuleCondition,
  RuleMode,
  RuleScope,
  RuleTrigger,
} from './api';

export const defaultRuleScope = (
  subredditId: string,
  target: RuleScope['target']
): RuleScope => ({
  target,
  subredditId,
  excludeModerators: true,
  excludeApprovedUsers: false,
  excludeFirewatchNotices: true,
  excludeAutoModerator: true,
});

export const RULE_MODE_LABELS: Record<RuleMode, string> = {
  suggest_only: 'Suggest only',
  prepare_for_approval: 'Prepare for mod approval',
  auto_run_safe_actions: 'Auto-run safe actions',
  auto_run_all_selected_actions: 'Auto-run all selected actions',
};

export const RULE_TRIGGER_LABELS: Record<RuleTrigger['type'], string> = {
  new_post: 'New post',
  new_comment: 'New comment',
  post_report: 'Post report',
  comment_report: 'Comment report',
  comment_removed: 'Comment is removed',
  post_removed: 'Post is removed',
  incident_score_changed: 'Review score changes',
  user_strike_count_changed: 'User strike count changes',
};

export const RULE_TARGET_LABELS: Record<RuleScope['target'], string> = {
  comment: 'Comments',
  incident: 'Posts in review',
  post: 'Posts',
  user: 'Users',
};

export const triggerLabel = (trigger: RuleTrigger) =>
  RULE_TRIGGER_LABELS[trigger.type];

export const conditionLabel = (condition: RuleCondition) => {
  switch (condition.type) {
    case 'text_contains':
      return `text ${condition.match} "${condition.value}"`;
    case 'watched_word_hit':
      return `${condition.minHits}+ watched word hit${
        condition.minHits === 1 ? '' : 's'
      }`;
    case 'watched_domain_hit':
      return `${condition.minHits}+ watched domain hit${
        condition.minHits === 1 ? '' : 's'
      }`;
    case 'has_link':
      return `${condition.minLinks}+ link${condition.minLinks === 1 ? '' : 's'}`;
    case 'user_strikes':
      return `user strikes ${condition.operator} ${condition.value}`;
    case 'user_removed_comments':
      return `removed comments ${condition.operator} ${condition.value} in ${condition.windowMinutes}m`;
    case 'post_reports':
      return `post reports ${condition.operator} ${condition.value}`;
    case 'incident_score':
      return `review score ${condition.operator} ${condition.value}`;
    case 'repeated_phrase':
      return `${condition.minMatches}+ repeated phrase matches`;
    case 'reply_cluster':
      return `${condition.minComments}+ comments in a reply cluster`;
  }
};

export const ruleActionLabel = (action: RuleAction) => {
  switch (action.type) {
    case 'queue_incident':
      return 'Send to review';
    case 'add_firewatch_strike':
      return 'Add Firewatch strike';
    case 'save_firewatch_log':
      return 'Save log entry';
    case 'generate_handoff':
      return 'Draft handoff note';
    case 'add_native_mod_note':
      return 'Add Reddit mod note';
    case 'remove_comment':
      return 'Remove current comment';
    case 'remove_post':
      return 'Remove post';
    case 'approve_comment':
      return 'Approve comment';
    case 'approve_post':
      return 'Approve post';
    case 'mark_spam':
      return `Mark ${action.target} as spam`;
    case 'sticky_reminder':
      return 'Draft sticky comment';
    case 'lock_post':
      return 'Lock post';
    case 'set_post_flair':
      return `Set post flair to ${action.flairText}`;
    case 'ignore_reports':
      return `Ignore reports on ${action.target}`;
    case 'prepare_temp_ban':
      return `Prepare ${action.durationDays}-day ban`;
    case 'prepare_permanent_ban':
      return 'Prepare permanent ban';
    case 'mute_user':
      return 'Mute user';
    case 'mark_resolved':
      return 'Mark post resolved';
  }
};

export const isRestrictedRuleAction = (action: RuleAction) =>
  action.type === 'add_native_mod_note' ||
  action.type === 'approve_comment' ||
  action.type === 'approve_post' ||
  action.type === 'prepare_temp_ban' ||
  action.type === 'prepare_permanent_ban' ||
  action.type === 'mute_user' ||
  action.type === 'remove_post' ||
  action.type === 'lock_post' ||
  action.type === 'mark_spam' ||
  action.type === 'set_post_flair' ||
  action.type === 'ignore_reports';

export const isDestructiveRuleAction = (action: RuleAction) =>
  action.type === 'remove_comment' ||
  action.type === 'remove_post' ||
  action.type === 'lock_post' ||
  action.type === 'mark_spam' ||
  action.type === 'ignore_reports' ||
  action.type === 'mute_user' ||
  action.type === 'prepare_temp_ban' ||
  action.type === 'prepare_permanent_ban';

export const preparedRuleAction = ({
  action,
  id,
  targetId,
  targetType,
  username,
}: {
  action: RuleAction;
  id: string;
  targetId?: string;
  targetType: PreparedRuleAction['targetType'];
  username?: string;
}): PreparedRuleAction => ({
  id,
  action,
  label: ruleActionLabel(action),
  risk: isRestrictedRuleAction(action)
    ? 'restricted'
    : isDestructiveRuleAction(action)
      ? 'destructive'
      : 'safe',
  targetId,
  targetType,
  username,
});

export const summarizeRule = (rule: FirewatchRule) => {
  const conditionSummary = rule.conditions.map(conditionLabel).join(' + ');
  const actionSummary = rule.actions.map(ruleActionLabel).join(' + ');

  return `When ${triggerLabel(rule.trigger).toLowerCase()} -> ${
    conditionSummary || 'conditions match'
  } -> ${RULE_MODE_LABELS[rule.mode].toLowerCase()} ${actionSummary.toLowerCase()}`;
};

export const defaultRuleTemplates = ({
  createdAt,
  createdBy,
  subredditId,
}: {
  createdAt: string;
  createdBy: string;
  subredditId: string;
}): FirewatchRule[] => [
  {
    id: 'rule_repeat_offender_cleanup',
    name: 'Repeat offender cleanup',
    description:
      'Prepares a mod note, handoff, and temporary ban when a user has repeated Firewatch strikes.',
    enabled: true,
    trigger: { type: 'user_strike_count_changed' },
    scope: defaultRuleScope(subredditId, 'user'),
    conditions: [
      {
        type: 'user_strikes',
        operator: '>=',
        value: 2,
        windowMinutes: 7 * 24 * 60,
      },
    ],
    counter: {
      countBy: 'user',
      threshold: 2,
      windowMinutes: 7 * 24 * 60,
    },
    actions: [
      {
        type: 'add_native_mod_note',
        note: 'Firewatch repeat offender cleanup: repeated scam/link behavior in review.',
      },
      {
        type: 'prepare_temp_ban',
        durationDays: 1,
        reason: 'Repeated rule-breaking comments tracked by Firewatch',
      },
      {
        type: 'generate_handoff',
        template:
          'Repeat offender cleanup matched. Review strikes, removed comments, and prepared ban before closing.',
      },
    ],
    mode: 'prepare_for_approval',
    createdBy,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'rule_scam_link_response',
    name: 'Scam link response',
    description:
      'Prepares comment removal, a Firewatch strike, and a Reddit mod note for scam-link comments.',
    enabled: true,
    trigger: { type: 'new_comment' },
    scope: defaultRuleScope(subredditId, 'comment'),
    conditions: [
      { type: 'watched_domain_hit', minHits: 1 },
      { type: 'watched_word_hit', minHits: 2 },
    ],
    counter: {
      countBy: 'post',
      threshold: 1,
      windowMinutes: 60,
    },
    actions: [
      {
        type: 'remove_comment',
        reason: 'Scam link cleanup: watched domain and scam terms',
      },
      {
        type: 'add_firewatch_strike',
        reason: 'Scam link response matched',
        weight: 1,
      },
      {
        type: 'add_native_mod_note',
        note: 'Firewatch matched scam link response on this comment.',
      },
    ],
    mode: 'prepare_for_approval',
    createdBy,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'rule_heated_thread_cooldown',
    name: 'Crowded thread cooldown',
    description:
      'Prepares a sticky comment draft when the review score reaches action level.',
    enabled: true,
    trigger: { type: 'incident_score_changed' },
    scope: defaultRuleScope(subredditId, 'incident'),
    conditions: [
      { type: 'incident_score', operator: '>=', value: 65 },
      {
        type: 'reply_cluster',
        minComments: 3,
        windowMinutes: 30,
      },
    ],
    actions: [
      {
        type: 'sticky_reminder',
        text: 'Mod note: This thread is under active review. Keep discussion civil and avoid suspicious links.',
      },
      {
        type: 'generate_handoff',
        template:
          'Crowded thread cooldown matched. Review flagged comments, then decide whether to post the sticky comment.',
      },
    ],
    mode: 'prepare_for_approval',
    createdBy,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'rule_lock_escalating_thread',
    name: 'Lock escalating thread',
    description:
      'Suggests a lock and handoff when a post reaches lock-level review.',
    enabled: true,
    trigger: { type: 'incident_score_changed' },
    scope: defaultRuleScope(subredditId, 'incident'),
    conditions: [
      { type: 'incident_score', operator: '>=', value: 85 },
      { type: 'post_reports', operator: '>=', value: 3 },
    ],
    actions: [
      { type: 'lock_post', reason: 'Escalating Firewatch review' },
      {
        type: 'generate_handoff',
        template:
          'Lock recommendation matched. Confirm reports and unresolved comments before locking.',
      },
    ],
    mode: 'suggest_only',
    createdBy,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'rule_zero_tolerance_phrase',
    name: 'Zero-tolerance phrase',
    description:
      'A disabled template for high-confidence exact phrase cleanup. Enable after setting the phrase.',
    enabled: false,
    trigger: { type: 'new_comment' },
    scope: defaultRuleScope(subredditId, 'comment'),
    conditions: [
      {
        type: 'text_contains',
        value: 'send me your recovery code',
        match: 'exact',
        caseSensitive: false,
      },
    ],
    actions: [
      {
        type: 'remove_comment',
        reason: 'Zero-tolerance phrase matched',
      },
      {
        type: 'add_firewatch_strike',
        reason: 'Zero-tolerance phrase matched',
        weight: 2,
      },
      {
        type: 'queue_incident',
        reason: 'Zero-tolerance phrase matched',
      },
    ],
    mode: 'prepare_for_approval',
    createdBy,
    createdAt,
    updatedAt: createdAt,
  },
];
