import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DEFAULT_CONFIG,
  EMPTY_CONFIG,
  buildConfigFormFields,
  configUpdateFromFormValues,
  normalizeConfig,
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
  undoActionLabel,
  userActionControl,
  userActionDetail,
} from '../dist/types/shared/reddit-actions.js';
import {
  RULE_MODE_LABELS,
  defaultRuleTemplates,
  isDestructiveRuleAction,
  isRestrictedRuleAction,
  preparedRuleAction,
  ruleActionLabel,
  summarizeRule,
} from '../dist/types/shared/automation-rules.js';
import {
  extractDomains,
  linkCount,
  textContainsTerm,
  watchedDomainMatches,
  watchedWordMatches,
} from '../dist/types/server/core/firewatch-detection.js';

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

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

test('detection matches watched words without substring false positives', () => {
  const matches = watchedWordMatches(
    'Classical giveaways: scammers ask for an admin fee.',
    ['ass', 'scam', 'admin fee']
  );

  assert.deepEqual(
    matches.map((match) => [match.term, match.count]),
    [
      ['scam', 1],
      ['admin fee', 1],
    ]
  );
});

test('detection parses domains and matches exact hosts or subdomains', () => {
  const text =
    'Go to hxxps://sub.bit.ly/claim, not orbit.ly, bit.ly-example.com, or example.com.';

  assert.deepEqual(extractDomains(text), [
    'sub.bit.ly',
    'orbit.ly',
    'bit.ly-example.com',
    'example.com',
  ]);
  assert.deepEqual(
    watchedDomainMatches(text, ['bit.ly', 'it.ly', 'example.com']).map(
      (match) => [match.term, match.count]
    ),
    [
      ['bit.ly', 1],
      ['example.com', 1],
    ]
  );
  assert.equal(linkCount(text), 4);
});

test('safety lane uses narrow high-risk patterns instead of broad sentiment claims', () => {
  const source = readFileSync('src/server/core/firewatch-safety.ts', 'utf8');

  assert.match(source, /\\brecovery code\\b/);
  assert.match(source, /\\bhome address\\b/);
  assert.match(source, /passwords\?/);
  assert.match(source, /\\b2fa code\\b/);
  assert.match(source, /\\bkill myself\\b/);
  assert.match(source, /track\|hunt/);
  assert.match(source, /child sexual abuse material/);
  assert.doesNotMatch(source, /\\bfind you\\b/);
  assert.doesNotMatch(source, /\\bunderage\\b\/i/);
  assert.doesNotMatch(source, /heated/);
});

test('automation text conditions use explicit match semantics', () => {
  assert.equal(
    textContainsTerm({
      match: 'exact',
      text: 'The admin fee unlocks nothing.',
      value: 'admin fee',
    }),
    true
  );
  assert.equal(
    textContainsTerm({
      match: 'exact',
      text: 'A scammer is posting again.',
      value: 'scam',
    }),
    false
  );
  assert.equal(
    textContainsTerm({
      match: 'contains',
      text: 'A scammer is posting again.',
      value: 'scam',
    }),
    true
  );
  assert.equal(
    textContainsTerm({
      match: 'regex',
      text: 'Message me for free money.',
      value: 'free\\s+money',
    }),
    true
  );
});

test('normalized config can intentionally clear watched lists', async () => {
  const config = normalizeConfig({
    keywords: [],
    suspiciousDomains: [],
  });

  assert.deepEqual(config.keywords, []);
  assert.deepEqual(config.suspiciousDomains, []);
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
  assert.equal(postActionControl('clear-flair'), 'setPostFlair');
  assert.equal(nativePostActionType('set-flair'), 'post_flaired');
  assert.equal(nativePostActionType('clear-flair'), 'post_flair_removed');
  assert.equal(nativePostActionType('mark-nsfw'), 'post_marked_nsfw');
  assert.equal(nativePostActionType('unmark-nsfw'), 'post_unmarked_nsfw');
  assert.equal(nativePostActionType('mark-spoiler'), 'post_marked_spoiler');
  assert.equal(
    nativePostActionType('unmark-spoiler'),
    'post_unmarked_spoiler'
  );
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
  assert.equal(
    postActionDetail({ action: 'clear-flair' }),
    'Removed post flair'
  );
});

test('comment action helpers keep native comment action behavior aligned', () => {
  assert.equal(commentActionControl('remove-thread'), 'removeCommentThreads');
  assert.equal(commentActionControl('ignore-reports'), 'ignoreCommentReports');
  assert.equal(
    commentActionControl('unignore-reports'),
    'ignoreCommentReports'
  );
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

test('undo action labels only expose safe reversible moderation actions', () => {
  assert.equal(undoActionLabel('comment_removed'), 'Restore comment');
  assert.equal(undoActionLabel('comment_locked'), 'Unlock comment');
  assert.equal(undoActionLabel('post_removed'), 'Restore post');
  assert.equal(undoActionLabel('locked'), 'Unlock post');
  assert.equal(undoActionLabel('post_reports_ignored'), 'Unignore post reports');
  assert.equal(undoActionLabel('post_flaired'), 'Restore previous flair');
  assert.equal(undoActionLabel('post_flair_removed'), 'Restore flair');
  assert.equal(undoActionLabel('claimed'), undefined);
  assert.equal(undoActionLabel('unclaimed'), undefined);
  assert.equal(undoActionLabel('comment_approved'), undefined);
  assert.equal(undoActionLabel('user_banned'), undefined);
  assert.equal(undoActionLabel('resolved'), undefined);
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
    'src/client/firewatch/settings/automations-card.tsx',
    'src/client/firewatch/settings/community-controls.tsx',
    'src/client/firewatch/settings/community-settings-page.tsx',
    'src/client/firewatch/settings/rule-builder-model.ts',
    'src/client/firewatch/settings/rule-builder.tsx',
    'src/client/firewatch/common.tsx',
    'src/client/firewatch/format.ts',
    'src/client/firewatch/incident-rules.tsx',
    'src/client/firewatch/shell/command-panel.tsx',
    'src/client/firewatch/shell/firewatch-shell.tsx',
    'src/client/firewatch/shell/incident-queue-item.tsx',
    'src/client/firewatch/shell/workspace-header.tsx',
    'src/client/firewatch/use-dashboard.ts',
    'src/server/core/firewatch-rules/matching.ts',
    'src/server/core/firewatch-rules/store.ts',
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

test('all automation actions are represented in shared and server handlers', () => {
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
});

test('prepared action runner explicitly handles every automation action', () => {
  const source = readFileSync(
    'src/server/core/firewatch/automation.ts',
    'utf8'
  );
  const runnerStart = source.indexOf('export const runPreparedRuleActions');
  const runnerEnd = source.indexOf('const ruleAutomationErrorMessage', runnerStart);
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
  const incidentActionSource = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );
  const userActionSource = readFileSync(
    'src/server/core/firewatch/actions/user-actions.ts',
    'utf8'
  );
  const stickyStart = incidentActionSource.indexOf('export const coolDownIncident');
  const stickyEnd = incidentActionSource.indexOf(
    'export const lockIncident',
    stickyStart
  );
  const stickySource = incidentActionSource.slice(stickyStart, stickyEnd);
  const banStart = userActionSource.indexOf('export const banPreparedRuleUser');
  const banEnd = userActionSource.indexOf(
    'export const applyNativeUserAction',
    banStart
  );
  const banSource = userActionSource.slice(banStart, banEnd);

  assert.match(stickySource, /await post\.addComment\(\{/);
  assert.match(stickySource, /await comment\.distinguish\(true\)/);
  assert.match(stickySource, /await upsertIncidentSignal\(\{/);
  assert.match(stickySource, /source: 'firewatch_notice'/);
  assert.match(banSource, /await reddit\.banUser\(\{/);
  assert.match(banSource, /duration: durationDays \?\? 0/);
  assert.match(banSource, /reason: 'Firewatch automation'/);
});

test('mute automation actions do not promise unsupported native durations', () => {
  const source = readFileSync(
    'src/server/core/firewatch/automation.ts',
    'utf8'
  );
  const runnerStart = source.indexOf('export const runPreparedRuleActions');
  const runnerEnd = source.indexOf('const ruleAutomationErrorMessage', runnerStart);
  const runnerSource = source.slice(runnerStart, runnerEnd);

  assert.match(runnerSource, /const muteReason = action\.durationDays/);
  assert.match(runnerSource, /Requested duration:/);
  assert.doesNotMatch(
    ruleActionLabel({ type: 'mute_user', durationDays: 7, reason: 'x' }),
    /for 7 days/
  );
});

test('auto-run safe automation actions mutate Firewatch state and avoid double execution', () => {
  const source = readFileSync(
    'src/server/core/firewatch/automation.ts',
    'utf8'
  );
  const autoRunStart = source.indexOf('const runAutoSafeRuleActions');
  const autoRunEnd = source.indexOf('export const runPreparedRuleActions', autoRunStart);
  const autoRunSource = source.slice(autoRunStart, autoRunEnd);
  const runnerStart = source.indexOf('export const runPreparedRuleActions');
  const runnerEnd = source.indexOf('const ruleAutomationErrorMessage', runnerStart);
  const runnerSource = source.slice(runnerStart, runnerEnd);

  assert.match(autoRunSource, /action\.type === 'add_firewatch_strike'/);
  assert.match(autoRunSource, /action\.type === 'generate_handoff'/);
  assert.match(autoRunSource, /action\.type === 'save_firewatch_log'/);
  assert.match(autoRunSource, /action\.type === 'queue_incident'/);
  assert.match(autoRunSource, /if \(!incident\.claim\?\.username\) return incident/);
  assert.match(autoRunSource, /await saveIncident\(refreshedIncident\)/);
  assert.match(runnerSource, /alreadyExecuted\.has\(prepared\.label\)/);
  assert.match(runnerSource, /requireAutomationClaim\(incident, actor\)/);
});

test('auto-run all mode dispatches selected actions and records failures', () => {
  const firewatchSource = readFileSync(
    'src/server/core/firewatch/automation.ts',
    'utf8'
  );
  const rulesSource = readFileSync(
    'src/server/core/firewatch-rules/matching.ts',
    'utf8'
  );
  const autoAllStart = firewatchSource.indexOf('const runAutoAllRuleActions');
  const autoAllEnd = firewatchSource.indexOf('const runRuleAutomationActions', autoAllStart);
  const autoAllSource = firewatchSource.slice(autoAllStart, autoAllEnd);
  const automationStart = firewatchSource.indexOf('const runRuleAutomationActions');
  const automationEnd = firewatchSource.length;
  const automationSource = firewatchSource.slice(automationStart, automationEnd);

  assert.match(rulesSource, /mode === 'auto_run_all_selected_actions'/);
  assert.match(rulesSource, /Auto-run all selected actions queued/);
  assert.match(rulesSource, /Waiting for a moderator claim before auto-running actions/);
  assert.match(rulesSource, /const incidentClaimed = Boolean\(incident\.claim\?\.username\)/);
  assert.match(rulesSource, /log\.skippedActions\.includes\(AUTO_RUN_CLAIM_REQUIRED\)/);
  assert.match(autoAllSource, /await runPreparedRuleActions\(/);
  assert.match(autoAllSource, /skippedActions\.includes\(AUTO_RUN_ALL_QUEUED\)/);
  assert.match(autoAllSource, /'firewatch'/);
  assert.match(autoAllSource, /triggerType: 'auto_run_all_failed'/);
  assert.match(automationSource, /runAutoSafeRuleActions/);
  assert.match(automationSource, /runAutoAllRuleActions/);
});

test('server stores real post metadata for post-header consistency', () => {
  const source = readFileSync('src/server/core/firewatch/incidents.ts', 'utf8');
  const snapshotSource = source;

  assert.match(snapshotSource, /authorName: normalizeUsername\(post\.authorName\)/);
  assert.match(snapshotSource, /score: post\.score/);
  assert.match(snapshotSource, /numberOfComments: post\.numberOfComments/);
});

test('cooldown action persists cooldown status instead of only appending an action', () => {
  const source = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );
  const cooldownStart = source.indexOf('export const coolDownIncident');
  const cooldownEnd = source.indexOf('export const lockIncident', cooldownStart);
  const cooldownSource = source.slice(cooldownStart, cooldownEnd);

  assert.match(cooldownSource, /status: 'cooldown'/);
});

test('comment review cards hydrate and display native Reddit comment state', () => {
  const apiSource = readFileSync('src/shared/api.ts', 'utf8');
  const serverSource = [
    readFileSync('src/server/core/firewatch/incidents.ts', 'utf8'),
  ].join('\n');
  const clientSource = readFileSync(
    'src/client/firewatch/comments/comment-state.ts',
    'utf8'
  );

  assert.match(apiSource, /approved\?: boolean/);
  assert.match(apiSource, /ignoringReports\?: boolean/);
  assert.match(apiSource, /locked\?: boolean/);
  assert.match(apiSource, /spam\?: boolean/);
  assert.match(serverSource, /await reddit\.getCommentById/);
  assert.match(serverSource, /redditComment\.locked/);
  assert.match(serverSource, /redditComment\.ignoringReports/);
  assert.match(serverSource, /reviewStateKey\(calculated\)/);
  assert.match(clientSource, /Boolean\(comment\.locked\)/);
  assert.match(clientSource, /Boolean\(comment\.ignoringReports\)/);
  assert.match(clientSource, /Boolean\(comment\.approved\)/);
  assert.match(clientSource, /Boolean\(comment\.spam\)/);
});

test('bulk comment review is a single typed server action with queue selection UI', () => {
  const apiTypesSource = readFileSync('src/shared/api.ts', 'utf8');
  const routeSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const serverSource = readFileSync(
    'src/server/core/firewatch/actions/comment-actions.ts',
    'utf8'
  );
  const clientSource = readFileSync(
    'src/client/firewatch/comments/flagged-comments-card.tsx',
    'utf8'
  );

  assert.match(apiTypesSource, /export type BulkCommentReviewInput/);
  assert.match(routeSource, /comments\/bulk-review/);
  assert.match(routeSource, /bulkReviewComments/);
  assert.match(serverSource, /export const bulkReviewComments/);
  assert.match(serverSource, /appendAction\(normalizedPostId/);
  assert.match(serverSource, /targetIds/);
  assert.match(clientSource, /bulk-comments:approve/);
  assert.match(clientSource, /bulk-comments:remove/);
  assert.match(clientSource, /Select all/);
  assert.match(clientSource, /Confirm remove/);
});

test('safety lane is typed, scored, queued, and displayed as advisory', () => {
  const apiTypesSource = readFileSync('src/shared/api.ts', 'utf8');
  const safetySource = readFileSync(
    'src/server/core/firewatch-safety.ts',
    'utf8'
  );
  const scoringSource = readFileSync(
    'src/server/core/firewatch-scoring.ts',
    'utf8'
  );
  const commentScoringSource = readFileSync(
    'src/server/core/firewatch-scoring/helpers.ts',
    'utf8'
  );
  const sortingSource = readFileSync('src/shared/incidents.ts', 'utf8');
  const overviewSource = readFileSync(
    'src/client/firewatch/overview/review-sidecards.tsx',
    'utf8'
  );
  const headerSource = readFileSync(
    'src/client/firewatch/overview/post-header.tsx',
    'utf8'
  );
  const queueSource = readFileSync(
    'src/client/firewatch/shell/incident-queue-item.tsx',
    'utf8'
  );

  assert.match(apiTypesSource, /export type SafetyReview/);
  assert.match(apiTypesSource, /safetyReview\?: SafetyReview/);
  assert.match(safetySource, /export const detectSafetyReview/);
  assert.match(safetySource, /category: 'self_harm'/);
  assert.match(safetySource, /category: 'personal_info'/);
  assert.match(safetySource, /category: 'threat'/);
  assert.match(safetySource, /category: 'minor_safety'/);
  assert.match(scoringSource, /const safetyPoints = safetyReview \? 35 : 0/);
  assert.match(scoringSource, /label: 'Safety review'/);
  assert.match(
    commentScoringSource,
    /Safety review: \$\{firstSafetyMatch\.label\}/
  );
  assert.match(sortingSource, /incident\.safetyReview \? 160 : 0/);
  assert.match(overviewSource, /Review before routine cleanup/);
  assert.match(
    overviewSource,
    /It will not auto-act from\s+this signal alone/
  );
  assert.match(headerSource, /Safety review/);
  assert.match(queueSource, /RedditShieldIcon/);
});

test('latest reversible action can be undone through one server endpoint', () => {
  const routeSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const exportSource = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const activitySource = readFileSync(
    'src/client/firewatch/incident-activity.tsx',
    'utf8'
  );
  const serverSource = readFileSync(
    'src/server/core/firewatch/actions/undo-actions.ts',
    'utf8'
  );
  const clientSource = readFileSync(
    'src/client/firewatch/overview/mod-actions-card.tsx',
    'utf8'
  );

  assert.match(routeSource, /actions\/:actionId\/undo/);
  assert.match(routeSource, /undoIncidentAction/);
  assert.match(exportSource, /undoIncidentAction/);
  assert.match(serverSource, /undoActionLabel\(action\.type\)/);
  assert.match(serverSource, /approveCommentIfReal/);
  assert.match(serverSource, /post\.approve\(\)/);
  assert.match(serverSource, /comment\.unlock\(\)/);
  assert.match(serverSource, /comment\.lock\(\)/);
  assert.match(serverSource, /post\.unignoreReports\(\)/);
  assert.match(serverSource, /post\.ignoreReports\(\)/);
  assert.match(serverSource, /restorePostFlair/);
  assert.match(clientSource, /undoActionLabel/);
  assert.match(clientSource, /Confirm undo/);
  assert.match(clientSource, /\/actions\/\$\{latestAction\.id\}\/undo/);
  assert.match(activitySource, /latestUndoableAction/);
  assert.match(activitySource, /\/actions\/\$\{action\.id\}\/undo/);
});

test('state actions expose unclaim and post flair removal without fake undo buttons', () => {
  const apiTypesSource = readFileSync('src/shared/api.ts', 'utf8');
  const routeSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const exportSource = readFileSync('src/server/core/firewatch.ts', 'utf8');
  const incidentsSource = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );
  const postActionSource = readFileSync(
    'src/server/core/firewatch/actions/post-actions.ts',
    'utf8'
  );
  const heroSource = readFileSync(
    'src/client/firewatch/overview/mod-actions-card.tsx',
    'utf8'
  );
  const postToolsSource = readFileSync(
    'src/client/firewatch/overview/post-tools-card.tsx',
    'utf8'
  );
  const commentsSource = readFileSync(
    'src/client/firewatch/comments/flagged-comments-card.tsx',
    'utf8'
  );

  assert.match(apiTypesSource, /'unclaimed'/);
  assert.match(apiTypesSource, /'clear-flair'/);
  assert.match(apiTypesSource, /postFlairBefore\?: PostFlairState/);
  assert.match(routeSource, /incidents\/:postId\/unclaim/);
  assert.match(exportSource, /unclaimIncident/);
  assert.match(incidentsSource, /redis\.del\(claimKey\(normalizedPostId\)\)/);
  assert.match(postActionSource, /removePostFlair/);
  assert.match(postActionSource, /postFlairBefore/);
  assert.match(heroSource, /claimedByCurrentUser\s*\?\s*'Unclaim'/);
  assert.match(heroSource, /claimedByAnotherMod/);
  assert.match(postToolsSource, /Remove flair/);
  assert.match(commentsSource, /label="Restore"/);
  assert.match(commentsSource, /commentState\.locked\s*\?\s*'Unlock'/);
});

test('user content removal refreshes and skips content already approved on Reddit', () => {
  const source = readFileSync(
    'src/server/core/firewatch/actions/user-actions.ts',
    'utf8'
  );
  const banStart = source.indexOf('export const banUserAndRemoveComments');
  const userActionStart = source.indexOf('export const applyNativeUserAction');
  const banSource = source.slice(banStart, userActionStart);
  const removalStart = source.indexOf('const removeRecentUserContent');
  const removalEnd = source.indexOf('export const applyNativeUserAction', removalStart);
  const removalSource = source.slice(removalStart, removalEnd);

  assert.match(banSource, /await refreshIncident\(/);
  assert.match(removalSource, /item\.isApproved\(\)/);
  assert.match(removalSource, /if \(item\.isRemoved\(\)\)/);
});

test('scoring keeps open review comments durable and report counts stable', () => {
  const source = [
    readFileSync('src/server/core/firewatch-scoring.ts', 'utf8'),
    readFileSync('src/server/core/firewatch-scoring/helpers.ts', 'utf8'),
  ].join('\n');

  assert.match(source, /previousOpenComments/);
  assert.match(source, /MAX_FLAGGED_COMMENTS - openFlaggedComments\.length/);
  assert.match(source, /reportSignals: Math\.max\(totalReportCount, incident\.stats\.reportSignals\)/);
  assert.match(source, /action\.type === 'user_banned' \? 0 : 1/);
});

test('incident ingest dedupes retried content events but keeps reports additive', () => {
  const source = [
    readFileSync('src/server/core/firewatch/signals.ts', 'utf8'),
  ].join('\n');

  assert.match(source, /const DEDUPED_SIGNAL_TYPES = new Set/);
  assert.match(source, /'comment_create'/);
  assert.match(source, /'automod_filter'/);
  assert.match(source, /const signalDedupeKey/);
  assert.match(source, /if \(!DEDUPED_SIGNAL_TYPES\.has\(signal\.type\)\)/);
  assert.match(source, /return undefined/);
  assert.match(source, /mergeRecentSignal\(signal, baseIncident\.recentSignals\)/);
  assert.doesNotMatch(source, /'comment_report',\s*\n\s*'post_report'/);
});

test('demo creation keeps repeated judge walkthroughs clean', () => {
  const source = readFileSync('src/server/core/firewatch/demo.ts', 'utf8');
  const createStart = source.indexOf('export const createDemoIncident');
  const createEnd = source.indexOf('export const resetDemoIncidents', createStart);
  const createSource = source.slice(createStart, createEnd);
  const resetStart = source.indexOf('export const resetDemoIncidents');
  const resetSource = source.slice(resetStart);

  assert.match(createSource, /await resetDemoIncidents\(\)/);
  assert.match(resetSource, /clearUserStrikes\(context\.subredditName, username\)/);
  assert.match(resetSource, /clearRememberedIncident\(\)/);
  assert.match(resetSource, /startsWith\('demo'\)/);
});

test('app reset deletes Firewatch-owned storage', () => {
  const storeSource = readFileSync('src/server/core/firewatch/store.ts', 'utf8');
  const apiSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const clientSource = readFileSync(
    'src/client/firewatch/settings/community-controls.tsx',
    'utf8'
  );
  const resetStart = storeSource.indexOf('export const resetAppData');
  const resetSource = storeSource.slice(resetStart);

  assert.match(apiSource, /api\.post\('\/app\/reset'/);
  assert.match(clientSource, /Delete all Firewatch data/);
  assert.match(resetSource, /INDEX_KEY/);
  assert.match(resetSource, /boardPostKey\(subredditName\)/);
  assert.match(resetSource, /configKey\(subredditName\)/);
  assert.match(resetSource, /incidentRegistryKey\(subredditName\)/);
  assert.match(resetSource, /responseRulesKey\(subredditName\)/);
  assert.match(resetSource, /ruleLogsKey\(subredditName\)/);
  assert.match(resetSource, /userRegistryKey\(subredditName\)/);
  assert.match(resetSource, /incidentKey\(postId\)/);
  assert.match(resetSource, /claimKey\(postId\)/);
  assert.match(resetSource, /selectionKey\(subredditName, username\)/);
  assert.match(resetSource, /userStrikesKey\(subredditName, username\)/);
  assert.match(storeSource, /await redis\.del\(\.\.\.uniqueKeys\.slice/);
});

test('automation matching filters by trigger and source scope', () => {
  const source = [
    readFileSync('src/server/core/firewatch-rules/matching.ts', 'utf8'),
    readFileSync('src/server/core/firewatch-rules/scope.ts', 'utf8'),
  ].join('\n');

  assert.match(source, /triggerTypesForIncident/);
  assert.match(source, /!effectiveTriggerTypes\.has\(rule\.trigger\.type\)/);
  assert.match(source, /await reddit\s*\n\s*\.getModerators/);
  assert.match(source, /moderatorUsers\.has/);
  assert.match(source, /excludeFirewatchNotices/);
  assert.match(source, /excludeAutoModerator/);
  assert.match(source, /ignoredAuthors/);
});

test('automation runner can execute the selected matched target', () => {
  const serverSource = readFileSync(
    'src/server/core/firewatch/automation.ts',
    'utf8'
  );
  const apiSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const clientSource = readFileSync('src/client/firewatch/incident-rules.tsx', 'utf8');

  assert.match(serverSource, /targetId\?: string/);
  assert.match(serverSource, /rule\.targetId === targetId/);
  assert.match(apiSource, /targetId: string/);
  assert.match(clientSource, /targetId: rule\.targetId/);
});

test('client refreshes dashboard state after settings, automations, and actions', () => {
  const source = readFileSync('src/client/firewatch/use-dashboard.ts', 'utf8');

  assert.match(source, /await refresh\(\);/);
  assert.match(source, /const payload = await requestJson<ConfigResponse>/);
  assert.match(source, /const payload = await requestJson<RulesResponse>/);
});

test('automation editor preserves existing scope counters and extra actions', () => {
  const source = readFileSync(
    'src/client/firewatch/settings/rule-builder.tsx',
    'utf8'
  );

  assert.match(source, /mergeExistingActions\(builtActions, rule\.actions\)/);
  assert.match(source, /\.\.\.\(rule\?\.counter \? \{ counter: rule\.counter \} : \{\}\)/);
  assert.match(source, /\.\.\.\(rule\?\.scope \?\? \{\}\)/);
});

test('incident mutations require the current moderator claim', () => {
  const apiSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const protectedRoutes = [
    '/incidents/:postId/unclaim',
    '/incidents/:postId/cool-down',
    '/incidents/:postId/lock',
    '/incidents/:postId/post-action',
    '/incidents/:postId/escalate',
    '/incidents/:postId/resolve',
    '/incidents/:postId/actions/:actionId/undo',
    '/incidents/:postId/comments/:commentId/remove',
    '/incidents/:postId/comments/:commentId/approve',
    '/incidents/:postId/comments/bulk-review',
    '/incidents/:postId/comments/:commentId/native-action',
    '/incidents/:postId/users/:username/ban',
    '/incidents/:postId/users/:username/native-action',
    '/incidents/:postId/rules/:ruleId/run',
    '/incidents/:postId/users/:username/strikes/clear',
  ];

  assert.match(
    apiSource,
    /api\.post\('\/incidents\/:postId\/claim'[\s\S]*?return incidentAction\(c, \(\) => claimIncident/
  );
  for (const route of protectedRoutes) {
    assert.match(
      apiSource,
      new RegExp(
        `api\\.post\\('${escapeRegExp(route)}'[\\s\\S]*?return claimedIncidentAction`
      )
    );
  }
  assert.match(apiSource, /const requireIncidentClaim = async/);
  assert.match(apiSource, /const currentModeratorName = async/);
  assert.match(apiSource, /currentModeratorName\(\)/);
  assert.match(apiSource, /Claim this post before taking mod actions/);
  assert.match(apiSource, /Only that mod can take actions/);
  assert.match(apiSource, /claimKeyFor\(claimOwner\) !== claimKeyFor\(actor\)/);
});

test('claim ownership rejects duplicate ownership and release by another mod', () => {
  const source = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );

  assert.match(source, /const claimActorKey/);
  assert.match(source, /const claimActorName = async/);
  assert.match(source, /Could not identify the current moderator/);
  assert.match(source, /Ask them to unclaim before acting/);
  assert.match(source, /Only that mod can release claim/);
  assert.match(source, /return incident/);
  assert.match(source, /type: 'claimed'/);
  assert.match(source, /type: 'unclaimed'/);
});

test('client action surfaces disable post actions without the current claim', () => {
  const source = [
    readFileSync('src/client/firewatch/incident-detail.tsx', 'utf8'),
    readFileSync('src/client/firewatch/overview/mod-actions-card.tsx', 'utf8'),
    readFileSync('src/client/firewatch/overview/post-tools-card.tsx', 'utf8'),
    readFileSync('src/client/firewatch/comments/flagged-comments-card.tsx', 'utf8'),
    readFileSync('src/client/firewatch/comments/comment-action-prep.tsx', 'utf8'),
    readFileSync('src/client/firewatch/incident-rules.tsx', 'utf8'),
    readFileSync('src/client/firewatch/incident-activity.tsx', 'utf8'),
    readFileSync('src/client/firewatch/overview/review-sidecards.tsx', 'utf8'),
  ].join('\n');

  assert.match(source, /const actionLocked = !isIncidentClaimedByCurrentUser/);
  assert.match(source, /A moderator needs to claim this before actions/);
  assert.match(source, /Claim this post to perform removals/);
  assert.match(source, /label=\{[\s\S]*?'Claim post'/);
  assert.match(source, /claimedByAnotherMod/);
  assert.match(source, /disabled=\{actionLocked \|\| !commentOpen\}/);
  assert.match(source, /disabled=\{!canRun \|\| Boolean\(busyAction\) \|\| actionLocked\}/);
  assert.match(source, /Boolean\(busyAction\) \|\| actionLocked \|\| !canSaveHandoff/);
  assert.match(source, /description=\{actionLocked \? actionLockReason : undefined\}/);
  assert.match(source, /title=\{actionLocked \? actionLockReason : undefined\}/);
});
