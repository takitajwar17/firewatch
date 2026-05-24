import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DEFAULT_CONFIG,
  EMPTY_CONFIG,
  buildConfigFormFields,
  configUpdateFromFormValues,
} from '../dist/types/shared/firewatch-config.js';
import {
  CROWD_CONTROL_OPTIONS,
  commentActionControl,
  commentActionDetail,
  nativeCommentActionType,
  nativePostActionType,
  nativeUserActionType,
  parseCrowdControlLevel,
  postActionControl,
  postActionDetail,
  userActionControl,
  userActionDetail,
} from '../dist/types/shared/reddit-actions.js';
import {
  RULE_MODE_LABELS,
  defaultRuleTemplates,
  formatMatchedRuleLogLine,
  isDestructiveRuleAction,
  isRestrictedRuleAction,
  preparedRuleAction,
  ruleActionLabel,
  ruleActionRunDisposition,
  ruleInputFromTemplate,
  summarizeRule,
} from '../dist/types/shared/response-rules.js';

const configFormDefaults = {
  keywords: DEFAULT_CONFIG.keywords.join(', '),
  suspiciousDomains: DEFAULT_CONFIG.suspiciousDomains.join(', '),
  heatThreshold: DEFAULT_CONFIG.heatThreshold,
  fireThreshold: DEFAULT_CONFIG.fireThreshold,
  wildfireThreshold: DEFAULT_CONFIG.wildfireThreshold,
  reminderText: DEFAULT_CONFIG.reminderText,
  actionControls: DEFAULT_CONFIG.actionControls,
  signalWeights: DEFAULT_CONFIG.signalWeights,
};

const ruleActionTypesFromApi = () => {
  const source = readFileSync('src/shared/api.ts', 'utf8');
  const start = source.indexOf('export type RuleAction =');
  const end = source.indexOf('export type FirewatchRule', start);
  const ruleActionSource = source.slice(start, end);

  return Array.from(
    new Set(
      Array.from(ruleActionSource.matchAll(/type: '([^']+)'/g)).map(
        (match) => match[1]
      )
    )
  ).sort();
};

test('empty client config preserves numeric defaults but not watched lists', () => {
  assert.deepEqual(EMPTY_CONFIG.keywords, []);
  assert.deepEqual(EMPTY_CONFIG.suspiciousDomains, []);
  assert.equal(EMPTY_CONFIG.heatThreshold, DEFAULT_CONFIG.heatThreshold);
  assert.equal(EMPTY_CONFIG.fireThreshold, DEFAULT_CONFIG.fireThreshold);
  assert.equal(
    EMPTY_CONFIG.wildfireThreshold,
    DEFAULT_CONFIG.wildfireThreshold
  );
  assert.equal(
    EMPTY_CONFIG.actionControls.removeUserContent,
    DEFAULT_CONFIG.actionControls.removeUserContent
  );
});

test('config form field builder produces stable unique form names', () => {
  const fields = buildConfigFormFields(configFormDefaults);
  const names = fields.map((field) => field.name);

  assert.equal(names.length, new Set(names).size);
  assert.equal(fields.at(0)?.name, 'keywords');
  assert.equal(fields.at(1)?.name, 'suspiciousDomains');
  assert.ok(
    fields.some(
      (field) =>
        field.type === 'boolean' && field.name === 'allowRemoveUserContent'
    )
  );
  assert.ok(
    fields.some(
      (field) => field.type === 'number' && field.name === 'weightReports'
    )
  );
});

test('config form values map to nested update patches', () => {
  const update = configUpdateFromFormValues({
    allowApprovePosts: true,
    allowRemovePosts: false,
    heatThreshold: 42,
    keywords: 'scam, fraud',
    weightReports: 30,
  });

  assert.equal(update.keywords, 'scam, fraud');
  assert.equal(update.heatThreshold, 42);
  assert.equal(update.actionControls?.approvePosts, true);
  assert.equal(update.actionControls?.removePosts, false);
  assert.equal(update.actionControls?.markPostSpam, undefined);
  assert.equal(update.signalWeights?.reports, 30);
  assert.equal(update.signalWeights?.watchedWords, undefined);
});

test('crowd control parser accepts known Reddit values and defaults safely', () => {
  assert.deepEqual(
    CROWD_CONTROL_OPTIONS.map((option) => option.value),
    ['OFF', 'LENIENT', 'MEDIUM', 'STRICT']
  );
  assert.equal(parseCrowdControlLevel('STRICT'), 'STRICT');
  assert.equal(parseCrowdControlLevel('not-valid'), 'MEDIUM');
  assert.equal(parseCrowdControlLevel(undefined), 'MEDIUM');
});

test('post action helpers keep native post action behavior aligned', () => {
  assert.equal(postActionControl('spam'), 'markPostSpam');
  assert.equal(postActionControl('crowd-control'), 'crowdControl');
  assert.equal(nativePostActionType('set-flair'), 'post_flaired');
  assert.equal(
    nativePostActionType('unignore-reports'),
    'post_reports_unignored'
  );
  assert.equal(
    postActionDetail({ action: 'remove', reason: 'Rule 1' }),
    'Removed post: Rule 1'
  );
  assert.equal(
    postActionDetail({
      action: 'set-flair',
      flairText: 'Needs mod review',
    }),
    'Set post flair to "Needs mod review"'
  );
});

test('comment action helpers keep native comment action behavior aligned', () => {
  assert.equal(commentActionControl('remove-thread'), 'removeCommentThreads');
  assert.equal(commentActionControl('show-comment'), 'showComments');
  assert.equal(nativeCommentActionType('show-comment'), 'comment_shown');
  assert.equal(
    commentActionDetail({
      action: 'remove-thread',
      count: 2,
      reason: 'Spam cleanup',
    }),
    'Removed comment thread (2 comments): Spam cleanup'
  );
});

test('user action helpers keep native user action behavior aligned', () => {
  assert.equal(userActionControl('remove-recent-content'), 'removeUserContent');
  assert.equal(userActionControl('add-mod-note'), 'addModNotes');
  assert.equal(nativeUserActionType('add-mod-note'), 'mod_note_added');
  assert.equal(
    userActionDetail({
      action: 'mute',
      count: 1,
      note: 'Support scam wave',
      username: 'demoUser',
    }),
    'Muted u/demoUser from modmail: Support scam wave'
  );
});

test('runtime copy keeps automation and settings naming consistent', () => {
  const runtimeFiles = [
    'src/client/firewatch/automations.tsx',
    'src/client/firewatch/community-settings.tsx',
    'src/client/firewatch/format.ts',
    'src/client/firewatch/incident-rules.tsx',
    'src/client/firewatch/shell.tsx',
    'src/client/firewatch/use-dashboard.ts',
    'src/server/core/firewatch-rules.ts',
    'src/server/core/firewatch.ts',
    'src/server/routes/forms.ts',
    'src/server/routes/menu.ts',
    'src/shared/firewatch-presets.ts',
  ];
  const staleCopy =
    /Response Rules|response rules|response rule|Rule log|rule log|Create rule|Save rule|Test rule|Edit rule|View rule|dry runs|Firewatch Settings|Firewatch settings|matched rules|Rule prepared|Firewatch mod tools/;

  for (const file of runtimeFiles) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), staleCopy, file);
  }
});

test('automation templates default to approval-first incident workflow', () => {
  const rules = defaultRuleTemplates({
    createdAt: '2026-05-23T00:00:00.000Z',
    createdBy: 'firewatch',
    subredditId: 'firewatch17_dev',
  });
  const scamRule = rules.find((rule) => rule.id === 'rule_scam_link_response');
  const repeatRule = rules.find(
    (rule) => rule.id === 'rule_repeat_offender_cleanup'
  );
  const lockRule = rules.find(
    (rule) => rule.id === 'rule_lock_escalating_thread'
  );

  assert.equal(scamRule?.mode, 'prepare_for_approval');
  assert.equal(repeatRule?.mode, 'prepare_for_approval');
  assert.equal(lockRule?.mode, 'suggest_only');
  assert.equal(scamRule?.scope.excludeFirewatchNotices, true);
  assert.equal(repeatRule?.scope.excludeModerators, true);
  assert.ok(
    scamRule?.actions.some((action) => action.type === 'remove_comment')
  );
  assert.ok(
    repeatRule?.actions.some((action) => action.type === 'prepare_temp_ban')
  );
});

test('automation labels describe moderator-facing prepared actions', () => {
  const rules = defaultRuleTemplates({
    createdAt: '2026-05-23T00:00:00.000Z',
    createdBy: 'firewatch',
    subredditId: 'firewatch17_dev',
  });
  const scamRule = rules.find((rule) => rule.id === 'rule_scam_link_response');
  assert.ok(scamRule);

  assert.equal(
    ruleActionLabel({ type: 'prepare_temp_ban', durationDays: 1, reason: 'x' }),
    'Prepare 1-day ban'
  );
  assert.equal(
    RULE_MODE_LABELS.prepare_for_approval,
    'Prepare for mod approval'
  );
  assert.equal(
    ruleActionLabel({ type: 'mute_user', durationDays: 3, reason: 'x' }),
    'Mute user'
  );
  assert.match(summarizeRule(scamRule), /watched domain/i);
  assert.match(summarizeRule(scamRule), /prepare/i);
});

test('automation templates keep risky actions approval-first', () => {
  const rules = defaultRuleTemplates({
    createdAt: '2026-05-23T00:00:00.000Z',
    createdBy: 'firewatch',
    subredditId: 'firewatch17_dev',
  });

  for (const rule of rules) {
    const hasRiskyAction = rule.actions.some(
      (action) =>
        isRestrictedRuleAction(action) || isDestructiveRuleAction(action)
    );
    if (!hasRiskyAction) continue;

    assert.notEqual(
      rule.mode,
      'auto_run_all_selected_actions',
      `${rule.name} must not auto-run risky actions by default`
    );
  }
});

test('rule template imports preserve editable behavior without cloning identity', () => {
  const rules = defaultRuleTemplates({
    createdAt: '2026-05-23T00:00:00.000Z',
    createdBy: 'firewatch',
    subredditId: 'firewatch17_dev',
  });
  const scamRule = rules.find((rule) => rule.id === 'rule_scam_link_response');
  assert.ok(scamRule);

  const input = ruleInputFromTemplate(scamRule);
  assert.equal(input.name, scamRule.name);
  assert.equal(input.enabled, true);
  assert.deepEqual(input.scope, scamRule.scope);
  assert.deepEqual(input.conditions, scamRule.conditions);
  assert.deepEqual(input.actions, scamRule.actions);
  assert.equal(input.mode, 'prepare_for_approval');
  assert.equal(Object.hasOwn(input, 'id'), false);
});

test('prepared automation actions classify safety and preserve targets', () => {
  const safe = preparedRuleAction({
    action: {
      type: 'add_firewatch_strike',
      reason: 'Matched watched phrase',
      weight: 1,
    },
    id: 'prepared_safe',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'demoSpammer',
  });
  const destructive = preparedRuleAction({
    action: { type: 'remove_comment', reason: 'Scam link' },
    id: 'prepared_destructive',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'demoSpammer',
  });
  const restricted = preparedRuleAction({
    action: { type: 'prepare_temp_ban', durationDays: 1, reason: 'Repeat' },
    id: 'prepared_restricted',
    targetId: 'demoSpammer',
    targetType: 'user',
    username: 'demoSpammer',
  });

  assert.equal(safe.risk, 'safe');
  assert.equal(safe.username, 'demoSpammer');
  assert.equal(destructive.risk, 'destructive');
  assert.equal(restricted.risk, 'restricted');
});

test('auto-run safe mode is limited to Firewatch-internal actions', () => {
  const nativeModNote = preparedRuleAction({
    action: { type: 'add_native_mod_note', note: 'native note' },
    id: 'native_mod_note',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'demoSpammer',
  });
  const nativeApproval = preparedRuleAction({
    action: { type: 'approve_comment' },
    id: 'native_approval',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'demoSpammer',
  });
  const nativeFlair = preparedRuleAction({
    action: { type: 'set_post_flair', flairText: 'Needs review' },
    id: 'native_flair',
    targetId: 't3_post',
    targetType: 'post',
  });
  const firewatchLog = preparedRuleAction({
    action: { type: 'save_firewatch_log', message: 'internal log' },
    id: 'firewatch_log',
    targetId: 't3_post',
    targetType: 'incident',
  });

  assert.equal(nativeModNote.risk, 'restricted');
  assert.equal(nativeApproval.risk, 'restricted');
  assert.equal(nativeFlair.risk, 'restricted');
  assert.equal(firewatchLog.risk, 'safe');
});

test('matched automation log copy handles prepared action counts', () => {
  assert.equal(
    formatMatchedRuleLogLine({
      id: 'single',
      ruleId: 'rule_single',
      ruleName: 'Single action rule',
      mode: 'prepare_for_approval',
      matchedAt: '2026-05-23T00:00:00.000Z',
      targetId: 't1_a',
      targetType: 'comment',
      why: ['1 watched domain hit'],
      preparedActions: [
        preparedRuleAction({
          action: { type: 'add_firewatch_strike', reason: 'x' },
          id: 'prepared_one',
          targetId: 't1_a',
          targetType: 'comment',
        }),
      ],
    }),
    'Single action rule matched and prepared 1 action.'
  );
  assert.equal(
    formatMatchedRuleLogLine({
      id: 'multiple',
      ruleId: 'rule_multiple',
      ruleName: 'Multiple action rule',
      mode: 'prepare_for_approval',
      matchedAt: '2026-05-23T00:00:00.000Z',
      targetId: 't1_a',
      targetType: 'comment',
      why: ['1 watched domain hit'],
      preparedActions: [
        preparedRuleAction({
          action: { type: 'add_firewatch_strike', reason: 'x' },
          id: 'prepared_one',
          targetId: 't1_a',
          targetType: 'comment',
        }),
        preparedRuleAction({
          action: { type: 'add_native_mod_note', note: 'x' },
          id: 'prepared_two',
          targetId: 't1_a',
          targetType: 'comment',
        }),
      ],
    }),
    'Multiple action rule matched and prepared 2 actions.'
  );
});

test('all automation actions have explicit run disposition', () => {
  const executableActions = [
    { type: 'queue_incident', reason: 'queue' },
    { type: 'add_firewatch_strike', reason: 'strike' },
    { type: 'save_firewatch_log', message: 'log' },
    { type: 'generate_handoff', template: 'handoff' },
    { type: 'add_native_mod_note', note: 'note' },
    { type: 'remove_comment', reason: 'remove comment' },
    { type: 'remove_post', reason: 'remove post' },
    { type: 'approve_comment' },
    { type: 'approve_post' },
    { type: 'mark_spam', target: 'post' },
    { type: 'mark_spam', target: 'comment' },
    { type: 'sticky_reminder', text: 'Stay civil.' },
    { type: 'lock_post', reason: 'lock' },
    { type: 'set_post_flair', flairText: 'Needs review' },
    { type: 'ignore_reports', target: 'post' },
    { type: 'ignore_reports', target: 'comment' },
    { type: 'prepare_temp_ban', durationDays: 1, reason: 'repeat' },
    { type: 'prepare_permanent_ban', reason: 'severe repeat' },
    { type: 'mute_user', durationDays: 3, reason: 'mute' },
    { type: 'mark_handled' },
  ];
  const sampleTypes = Array.from(
    new Set(executableActions.map((action) => action.type))
  ).sort();

  assert.deepEqual(sampleTypes, ruleActionTypesFromApi());

  for (const action of executableActions) {
    assert.equal(
      ruleActionRunDisposition(action),
      'execute',
      `${ruleActionLabel(action)} should execute after moderator approval`
    );
  }
});

test('prepared action runner explicitly handles every automation action', () => {
  const source = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const runnerStart = source.indexOf('export const runPreparedRuleActions');
  const runnerEnd = source.indexOf('const buildSummary', runnerStart);
  const runnerSource = source.slice(runnerStart, runnerEnd);

  for (const actionType of ruleActionTypesFromApi()) {
    assert.match(
      runnerSource,
      new RegExp(`action\\.type === '${actionType}'`),
      `${actionType} must have an explicit execution branch`
    );
  }
});

test('prepared action runner uses documented native APIs for sticky and ban actions', () => {
  const source = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const stickyStart = source.indexOf('export const coolDownIncident');
  const stickyEnd = source.indexOf('export const lockIncident', stickyStart);
  const stickySource = source.slice(stickyStart, stickyEnd);
  const banStart = source.indexOf('const banPreparedRuleUser');
  const banEnd = source.indexOf('export const applyNativePostAction', banStart);
  const banSource = source.slice(banStart, banEnd);

  assert.match(stickySource, /await post\.addComment\(\{/);
  assert.match(stickySource, /await comment\.distinguish\(true\)/);
  assert.match(stickySource, /source: 'firewatch_notice'/);
  assert.match(banSource, /await reddit\.banUser\(\{/);
  assert.match(banSource, /duration: durationDays \?\? 0/);
  assert.match(banSource, /reason: 'Firewatch automation'/);
});

test('mute automation actions do not promise unsupported native durations', () => {
  const source = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const runnerStart = source.indexOf('export const runPreparedRuleActions');
  const runnerEnd = source.indexOf('const buildSummary', runnerStart);
  const runnerSource = source.slice(runnerStart, runnerEnd);

  assert.match(runnerSource, /const muteReason = action\.durationDays/);
  assert.match(runnerSource, /Requested duration:/);
  assert.doesNotMatch(
    ruleActionLabel({ type: 'mute_user', durationDays: 7, reason: 'x' }),
    /for 7 days/
  );
});

test('auto-run safe automation actions mutate Firewatch state and avoid double execution', () => {
  const source = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const autoRunStart = source.indexOf('const runAutoSafeRuleActions');
  const autoRunEnd = source.indexOf('export const runPreparedRuleActions', autoRunStart);
  const autoRunSource = source.slice(autoRunStart, autoRunEnd);
  const runnerStart = source.indexOf('export const runPreparedRuleActions');
  const runnerEnd = source.indexOf('const buildSummary', runnerStart);
  const runnerSource = source.slice(runnerStart, runnerEnd);

  assert.match(autoRunSource, /action\.type === 'add_firewatch_strike'/);
  assert.match(autoRunSource, /action\.type === 'generate_handoff'/);
  assert.match(autoRunSource, /action\.type === 'save_firewatch_log'/);
  assert.match(autoRunSource, /action\.type === 'queue_incident'/);
  assert.match(autoRunSource, /await saveIncident\(refreshedIncident\)/);
  assert.match(runnerSource, /alreadyExecuted\.has\(prepared\.label\)/);
});

test('auto-run all mode dispatches selected actions and records failures', () => {
  const firewatchSource = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const rulesSource = readFileSync('src/server/core/firewatch-rules.ts', 'utf8');
  const autoAllStart = firewatchSource.indexOf('const runAutoAllRuleActions');
  const autoAllEnd = firewatchSource.indexOf('const runRuleAutomationActions', autoAllStart);
  const autoAllSource = firewatchSource.slice(autoAllStart, autoAllEnd);
  const automationStart = firewatchSource.indexOf('const runRuleAutomationActions');
  const automationEnd = firewatchSource.indexOf('const buildSummary', automationStart);
  const automationSource = firewatchSource.slice(automationStart, automationEnd);

  assert.match(rulesSource, /mode === 'auto_run_all_selected_actions'/);
  assert.match(rulesSource, /Auto-run all selected actions queued/);
  assert.match(autoAllSource, /await runPreparedRuleActions\(/);
  assert.match(autoAllSource, /'firewatch'/);
  assert.match(autoAllSource, /triggerType: 'auto_run_all_failed'/);
  assert.match(automationSource, /runAutoSafeRuleActions/);
  assert.match(automationSource, /runAutoAllRuleActions/);
});
