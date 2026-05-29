import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  formatModeratorPermissionList,
} from '../dist/types/shared/api.js';
import {
  DEFAULT_CONFIG,
  EMPTY_CONFIG,
  buildConfigFormFields,
  configUpdateFromFormValues,
  normalizeConfig,
} from '../dist/types/shared/firewatch-config.js';
import {
  firewatchRatingFromScore,
  firewatchRatingMinScore,
  firewatchRatingScoreRange,
  firewatchRatingStars,
  firewatchRatingSummary,
} from '../dist/types/shared/firewatch-rating.js';
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
  normalizeCommentId,
  normalizeParentId,
  normalizePostId,
} from '../dist/types/shared/incidents.js';
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

const TEST_SUBREDDIT_ID = 'example_test_subreddit';

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

test('Firewatch rating maps signal scores to simple 0-5 labels', () => {
  assert.equal(firewatchRatingFromScore(0), 0);
  assert.equal(firewatchRatingFromScore(1), 1);
  assert.equal(firewatchRatingFromScore(40), 2);
  assert.equal(firewatchRatingFromScore(41), 3);
  assert.equal(firewatchRatingFromScore(81), 5);
  assert.equal(firewatchRatingMinScore(4), 61);
  assert.equal(firewatchRatingScoreRange(5), '81-100');
  assert.equal(firewatchRatingStars(3), '★★★☆☆');
  assert.equal(firewatchRatingSummary(85), '5/5 Wildfire');
});

test('reddit thing IDs normalize legacy post, comment, and parent IDs', () => {
  assert.equal(normalizePostId('abc123'), 't3_abc123');
  assert.equal(normalizePostId('t3_abc123'), 't3_abc123');
  assert.equal(normalizeCommentId('def456'), 't1_def456');
  assert.equal(normalizeCommentId('t1_def456'), 't1_def456');
  assert.equal(normalizeParentId('abc123', 't3_abc123'), 't3_abc123');
  assert.equal(normalizeParentId('def456', 't3_abc123'), 't1_def456');
  assert.equal(normalizeParentId('t1_def456', 't3_abc123'), 't1_def456');
});

test('detection parses domains and matches exact hosts or subdomains', () => {
  const text =
    'Go to sub(dot)bit(dot)ly/claim, not orbit.ly, bit.ly-example.com, or example.com.';

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
  assert.deepEqual(extractDomains('Check bit[.]ly and safe(.)example(dot)com'), [
    'bit.ly',
    'safe.example.com',
  ]);
  assert.deepEqual(
    watchedDomainMatches('b\u200bit[.]ly still resolves', ['bit.ly']).map(
      (match) => [match.term, match.count]
    ),
    [['bit.ly', 1]]
  );
});

test('repeated phrase extraction requires more than one author', () => {
  const helpersSource = readFileSync(
    'src/server/core/firewatch-scoring/helpers.ts',
    'utf8'
  );
  const constantsSource = readFileSync(
    'src/server/core/firewatch-constants.ts',
    'utf8'
  );

  assert.match(helpersSource, /value\.count >= 2 && value\.authors\.size >= 2/);
  assert.match(
    helpersSource,
    /b\.authors\.length - a\.authors\.length \|\| b\.count - a\.count/
  );
  assert.match(constantsSource, /'the'/);
});

test('incident refresh falls back when Reddit native post reads are cancelled', () => {
  const source = readFileSync('src/server/core/firewatch/incidents.ts', 'utf8');
  const runtimeSource = readFileSync(
    'src/server/core/firewatch/reddit-runtime.ts',
    'utf8'
  );
  const refreshStart = source.indexOf('export const refreshIncident');
  const refreshEnd = source.indexOf('export const appendAction', refreshStart);
  const refreshSource = source.slice(refreshStart, refreshEnd);

  assert.match(runtimeSource, /isTransientRedditRuntimeError/);
  assert.match(runtimeSource, /cancelled\|deadline\|unavailable\|timeout/);
  assert.match(runtimeSource, /readRedditPost/);
  assert.match(source, /const fallbackPostSnapshot = \(incident: Incident\)/);
  assert.match(source, /return fallbackPostSnapshot\(incident\)/);
  assert.match(
    refreshSource,
    /const postSnapshot = await getRefreshPostSnapshot\(incident\)/
  );
  assert.doesNotMatch(
    refreshSource,
    /await getPostSnapshot\(incident\.postId\)/
  );
});

test('demo seeding reuses the submitted post snapshot instead of rereading Reddit for every signal', () => {
  const source = readFileSync('src/server/core/firewatch/demo.ts', 'utf8');
  const lifecycleStart = source.indexOf('// Demo incident lifecycle');
  const lifecycleSource = source.slice(lifecycleStart);

  assert.match(lifecycleSource, /const postSnapshot: PostSnapshot =/);
  assert.match(lifecycleSource, /postId,\n\s+commentId,/);
  assert.match(lifecycleSource, /postSnapshot,/);
  assert.match(lifecycleSource, /demo\.create_failed/);
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

test('settings watched-list counts use saved config normalization', () => {
  const configSource = readFileSync('src/shared/firewatch-config.ts', 'utf8');
  const settingsSource = readFileSync(
    'src/client/firewatch/settings/community-controls.tsx',
    'utf8'
  );

  assert.match(configSource, /export const normalizeConfigList/);
  assert.match(settingsSource, /normalizeConfigList\(\s*\n\s*splitList\(keywords\),\s*\n\s*\[\]\s*\n\s*\)\.length/);
  assert.match(settingsSource, /normalizeConfigList\(\s*\n\s*splitList\(suspiciousDomains\),\s*\n\s*\[\]\s*\n\s*\)\.length/);
  assert.doesNotMatch(settingsSource, /Watched words \(\$\{splitList\(keywords\)\.length\}\)/);
  assert.doesNotMatch(settingsSource, /Watched domains \(\$\{splitList\(suspiciousDomains\)\.length\}\)/);
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
  assert.equal(undoActionLabel('comment_removed'), 'Approve removed comment');
  assert.equal(undoActionLabel('comment_spammed'), 'Approve spammed comment');
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
    subredditId: TEST_SUBREDDIT_ID,
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
    subredditId: TEST_SUBREDDIT_ID,
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
    subredditId: TEST_SUBREDDIT_ID,
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
    username: 'RuleBreaker42',
  });
  const destructive = preparedRuleAction({
    action: { type: 'remove_comment', reason: 'Scam link' },
    id: 'prepared_destructive',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'RuleBreaker42',
  });
  const restricted = preparedRuleAction({
    action: { type: 'prepare_temp_ban', durationDays: 1, reason: 'Repeat' },
    id: 'prepared_restricted',
    targetId: 'RuleBreaker42',
    targetType: 'user',
    username: 'RuleBreaker42',
  });

  assert.equal(safe.risk, 'safe');
  assert.equal(safe.username, 'RuleBreaker42');
  assert.equal(destructive.risk, 'destructive');
  assert.equal(restricted.risk, 'restricted');
});

test('auto-run safe mode is limited to Firewatch-internal actions', () => {
  const nativeModNote = preparedRuleAction({
    action: { type: 'add_native_mod_note', note: 'native note' },
    id: 'native_mod_note',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'RuleBreaker42',
  });
  const nativeApproval = preparedRuleAction({
    action: { type: 'approve_comment' },
    id: 'native_approval',
    targetId: 't1_comment',
    targetType: 'comment',
    username: 'RuleBreaker42',
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
    { type: 'mark_resolved' },
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
  const strikeHelperStart = source.indexOf('const addFirewatchStrikeWithAction');
  const strikeHelperEnd = source.indexOf(
    'const runPreparedPostOrCommentAction',
    strikeHelperStart
  );
  const strikeHelperSource = source.slice(strikeHelperStart, strikeHelperEnd);

  assert.match(autoRunSource, /action\.type === 'add_firewatch_strike'/);
  assert.match(autoRunSource, /action\.type === 'generate_handoff'/);
  assert.match(autoRunSource, /action\.type === 'save_firewatch_log'/);
  assert.match(autoRunSource, /action\.type === 'queue_incident'/);
  assert.match(autoRunSource, /if \(!incident\.claim\?\.username\) return incident/);
  assert.match(autoRunSource, /saveAndRefreshIncident\(/);
  assert.match(runnerSource, /alreadyExecuted\.has\(prepared\.label\)/);
  assert.match(runnerSource, /requireAutomationClaim\(incident, actor\)/);
  assert.match(runnerSource, /ruleAutomationErrorMessage\(error\)/);
  assert.match(runnerSource, /match\.preparedActions\.slice\(preparedIndex \+ 1\)/);
  assert.match(runnerSource, /skipped after earlier action failed/);
  assert.match(strikeHelperSource, /startIncidentAction/);
  assert.match(strikeHelperSource, /await addUserStrike/);
  assert.match(strikeHelperSource, /failIncidentAction/);
  assert.match(strikeHelperSource, /completeIncidentAction/);
  assert.match(autoRunSource, /addFirewatchStrikeWithAction/);
  assert.match(runnerSource, /addFirewatchStrikeWithAction/);
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
  assert.match(autoAllSource, /const actor = currentIncident\.claim\?\.username/);
  assert.match(autoAllSource, /actor,\s*log\.targetId/);
  assert.match(autoAllSource, /actor: actor \?\? 'firewatch'/);
  assert.match(autoAllSource, /triggerType: 'auto_run_all_failed'/);
  assert.match(automationSource, /runAutoSafeRuleActions/);
  assert.match(automationSource, /runAutoAllRuleActions/);
});

test('automation scope fails closed when moderator list cannot be verified', () => {
  const scopeSource = readFileSync(
    'src/server/core/firewatch-rules/scope.ts',
    'utf8'
  );
  const matchingSource = readFileSync(
    'src/server/core/firewatch-rules/matching.ts',
    'utf8'
  );

  assert.match(scopeSource, /ModeratorScopeResolution/);
  assert.match(scopeSource, /verified: false/);
  assert.match(
    matchingSource,
    /shouldSkipRuleForUnverifiedModeratorScope/
  );
  assert.match(
    matchingSource,
    /rule\.scope\.excludeModerators && !moderatorScopeVerified/
  );
  assert.match(matchingSource, /automation\.scope_moderators_unverified/);
  assert.match(matchingSource, /return \[\]/);
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
  const clientSource = readFileSync(
    'src/client/firewatch/overview/post-tools-card.tsx',
    'utf8'
  );
  const cooldownStart = source.indexOf('export const coolDownIncident');
  const cooldownEnd = source.indexOf('export const lockIncident', cooldownStart);
  const cooldownSource = source.slice(cooldownStart, cooldownEnd);

  assert.match(cooldownSource, /status: 'cooldown'/);
  assert.match(clientSource, /action\.type === 'cool_down' && actionCompleted\(action\)/);
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
  assert.match(serverSource, /await readRedditComment/);
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
  const clientSource = [
    readFileSync(
      'src/client/firewatch/comments/flagged-comments-card.tsx',
      'utf8'
    ),
    readFileSync(
      'src/client/firewatch/comments/bulk-comment-review-toolbar.tsx',
      'utf8'
    ),
  ].join('\n');

  assert.match(apiTypesSource, /export type BulkCommentReviewInput/);
  assert.match(routeSource, /comments\/bulk-review/);
  assert.match(routeSource, /bulkReviewComments/);
  assert.match(serverSource, /export const bulkReviewComments/);
  assert.match(serverSource, /startIncidentAction\(normalizedPostId/);
  assert.match(serverSource, /completeIncidentAction\(\s*normalizedPostId/);
  assert.match(serverSource, /failIncidentAction\(\s*normalizedPostId/);
  assert.match(serverSource, /successfulTargetIds/);
  assert.match(serverSource, /targetIds/);
  assert.match(clientSource, /bulk-comments:approve/);
  assert.match(clientSource, /bulk-comments:remove/);
  assert.match(clientSource, /Select all/);
  assert.match(clientSource, /Confirm remove/);
});

test('native moderation actions use a pending action ledger before Reddit writes', () => {
  const apiTypesSource = readFileSync('src/shared/api.ts', 'utf8');
  const sharedActionsSource = readFileSync(
    'src/shared/reddit-actions.ts',
    'utf8'
  );
  const incidentsSource = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );
  const postActionsSource = readFileSync(
    'src/server/core/firewatch/actions/post-actions.ts',
    'utf8'
  );
  const commentActionsSource = readFileSync(
    'src/server/core/firewatch/actions/comment-actions.ts',
    'utf8'
  );
  const userActionsSource = readFileSync(
    'src/server/core/firewatch/actions/user-actions.ts',
    'utf8'
  );
  const scoringHelpersSource = readFileSync(
    'src/server/core/firewatch-scoring/helpers.ts',
    'utf8'
  );
  const scoringSource = readFileSync(
    'src/server/core/firewatch-scoring.ts',
    'utf8'
  );
  const commentStateSource = readFileSync(
    'src/client/firewatch/comments/comment-state.ts',
    'utf8'
  );
  const modActionsSource = readFileSync(
    'src/client/firewatch/overview/mod-actions-card.tsx',
    'utf8'
  );
  const activitySource = readFileSync(
    'src/client/firewatch/incident-activity.tsx',
    'utf8'
  );
  const undoSource = readFileSync(
    'src/server/core/firewatch/actions/undo-actions.ts',
    'utf8'
  );
  const automationSource = readFileSync(
    'src/server/core/firewatch/automation.ts',
    'utf8'
  );
  const storeSource = readFileSync(
    'src/server/core/firewatch/store.ts',
    'utf8'
  );

  assert.match(apiTypesSource, /status\?: 'pending' \| 'succeeded' \| 'failed'/);
  assert.match(apiTypesSource, /completedAt\?: number/);
  assert.match(apiTypesSource, /error\?: string/);
  assert.match(sharedActionsSource, /export const actionCompleted/);
  assert.match(sharedActionsSource, /action\.status === 'succeeded'/);
  assert.match(incidentsSource, /export const startIncidentAction/);
  assert.match(incidentsSource, /export const completeIncidentAction/);
  assert.match(incidentsSource, /export const failIncidentAction/);
  assert.match(incidentsSource, /status: 'pending'/);
  assert.match(incidentsSource, /status: action\.status \?\? 'succeeded'/);
  assert.match(incidentsSource, /patch\.status \?\? 'succeeded'/);
  assert.match(incidentsSource, /status: 'failed'/);
  assert.match(storeSource, /const normalizeIncidentActions/);
  assert.match(storeSource, /status: action\.status \?\? 'succeeded'/);
  assert.match(incidentsSource, /export const coolDownIncident[\s\S]*?startIncidentAction\(normalizedPostId/);
  assert.match(incidentsSource, /export const coolDownIncident[\s\S]*?failIncidentAction\(\s*normalizedPostId/);
  assert.match(incidentsSource, /export const coolDownIncident[\s\S]*?completeIncidentAction\(\s*normalizedPostId/);
  assert.match(incidentsSource, /export const lockIncident[\s\S]*?startIncidentAction\(normalizedPostId/);
  assert.match(incidentsSource, /export const lockIncident[\s\S]*?failIncidentAction\(\s*normalizedPostId/);
  assert.match(incidentsSource, /export const lockIncident[\s\S]*?completeIncidentAction\(\s*normalizedPostId/);
  assert.match(postActionsSource, /startIncidentAction\(normalizedPostId/);
  assert.match(postActionsSource, /completeIncidentAction\(\s*normalizedPostId/);
  assert.match(postActionsSource, /failIncidentAction\(\s*normalizedPostId/);
  assert.match(commentActionsSource, /startIncidentAction\(normalizedPostId/);
  assert.match(commentActionsSource, /completeIncidentAction\(\s*normalizedPostId/);
  assert.match(commentActionsSource, /failIncidentAction\(\s*normalizedPostId/);
  assert.match(commentActionsSource, /throwIfNoTargetSucceeded/);
  assert.match(userActionsSource, /startIncidentAction\(normalizedPostId/);
  assert.match(userActionsSource, /completeIncidentAction\(\s*normalizedPostId/);
  assert.match(userActionsSource, /failIncidentAction\(\s*normalizedPostId/);
  assert.match(userActionsSource, /trackedCommentIdsByUser/);
  assert.match(scoringHelpersSource, /actionCompleted\(action\)/);
  assert.match(scoringSource, /actionCompleted\(action\)/);
  assert.match(commentStateSource, /if \(!actionCompleted\(action\)\) continue/);
  assert.match(modActionsSource, /actionCompleted\(latestAction\)/);
  assert.match(activitySource, /actionCompleted\(action\)/);
  assert.match(undoSource, /Only completed actions can be undone from Firewatch/);
  assert.match(undoSource, /startIncidentAction\(incident\.postId/);
  assert.match(undoSource, /completeIncidentAction\(incident\.postId/);
  assert.match(undoSource, /failIncidentAction\(\s*incident\.postId/);
  assert.doesNotMatch(undoSource, /appendAction/);
  assert.match(automationSource, /action\.type === 'add_native_mod_note'[\s\S]*?startIncidentAction\(normalizedPostId/);
  assert.match(automationSource, /action\.type === 'add_native_mod_note'[\s\S]*?failIncidentAction\(\s*normalizedPostId/);
  assert.match(automationSource, /action\.type === 'add_native_mod_note'[\s\S]*?completeIncidentAction\(\s*normalizedPostId/);
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
  assert.match(scoringSource, /const SAFETY_REVIEW_POINTS = 35/);
  assert.match(scoringSource, /const safetyPoints = safetyReview \? SAFETY_REVIEW_POINTS : 0/);
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
  assert.match(serverSource, /patch: \{ approved: true, removed: false, reviewed: true, spam: false \}/);
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

test('user content removal refreshes and removes only open tracked comments', () => {
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

  assert.match(banSource, /saveAndRefreshIncident\(/);
  assert.match(banSource, /type: 'user_content_removed'/);
  assert.match(banSource, /type: 'user_banned'/);
  assert.match(banSource, /refreshedRemovalIncident/);
  assert.match(banSource, /User ban failed to record failure state/);
  assert.match(removalSource, /trackedCommentIdsByUser/);
  assert.match(removalSource, /runTargetedRedditActions/);
  assert.match(removalSource, /removeCommentIfReal/);
  assert.doesNotMatch(removalSource, /getCommentsAndPostsByUser/);
});

test('scoring keeps open review comments durable and report counts stable', () => {
  const source = [
    readFileSync('src/server/core/firewatch-scoring.ts', 'utf8'),
    readFileSync('src/server/core/firewatch-scoring/helpers.ts', 'utf8'),
  ].join('\n');
  const helpersSource = readFileSync(
    'src/server/core/firewatch-scoring/helpers.ts',
    'utf8'
  );
  const removalSetStart = helpersSource.indexOf(
    'export const COMMENT_REMOVAL_ACTION_TYPES'
  );
  const removalSetEnd = helpersSource.indexOf(
    'export const REMOVAL_ACTION_TYPES',
    removalSetStart
  );
  const removalSetSource = helpersSource.slice(removalSetStart, removalSetEnd);

  assert.match(source, /previousOpenComments/);
  assert.match(source, /isCommentOpenForReview\(comment\)/);
  assert.match(source, /getReportIgnoreState/);
  assert.match(source, /reportIgnoreState\.postReportsIgnored/);
  assert.match(source, /if \(isReportSignalIgnored\(signal, reportIgnoreState\)\) continue/);
  assert.match(source, /MAX_FLAGGED_COMMENTS - openFlaggedComments\.length/);
  assert.match(source, /const impactFlaggedComments = \[/);
  assert.match(source, /flaggedComments: impactFlaggedComments/);
  assert.match(source, /score: Math\.max\(existing\.score, point\.score\)/);
  assert.match(source, /commentSignals: Math\.max\(/);
  assert.match(source, /reportSignals: totalReportCount/);
  assert.doesNotMatch(source, /currentReportSignals/);
  assert.match(source, /action\.type === 'user_banned' \? 0 : 1/);
  assert.doesNotMatch(removalSetSource, /comment_locked/);
  assert.doesNotMatch(removalSetSource, /comment_reports_ignored/);
  assert.doesNotMatch(removalSetSource, /comment_shown/);
});

test('incident ingest dedupes retried content and report events', () => {
  const source = [
    readFileSync('src/server/core/firewatch/signals.ts', 'utf8'),
  ].join('\n');

  assert.match(source, /const DEDUPED_SIGNAL_TYPES = new Set/);
  assert.match(source, /'comment_create'/);
  assert.match(source, /'automod_filter'/);
  assert.match(source, /const signalDedupeKey/);
  assert.match(source, /if \(!DEDUPED_SIGNAL_TYPES\.has\(signal\.type\)\)/);
  assert.match(source, /return undefined/);
  assert.match(source, /mergeRecentSignalWithMeta\(\s*signal,\s*baseIncident\.recentSignals/);
  assert.match(source, /signalsOmitted/);
  assert.match(source, /'comment_report'/);
  assert.match(source, /'post_report'/);
});

test('review UI labels current signals and warns when context is capped', () => {
  const apiTypesSource = readFileSync('src/shared/api.ts', 'utf8');
  const scoringSource = readFileSync(
    'src/server/core/firewatch-scoring.ts',
    'utf8'
  );
  const commentsSource = readFileSync(
    'src/client/firewatch/comments/flagged-comments-card.tsx',
    'utf8'
  );
  const sidecardsSource = readFileSync(
    'src/client/firewatch/overview/review-sidecards.tsx',
    'utf8'
  );

  assert.match(apiTypesSource, /signalsOmitted\?: number/);
  assert.match(apiTypesSource, /flaggedCommentsOmitted\?: number/);
  assert.match(apiTypesSource, /lastSignalAt\?: number/);
  assert.match(scoringSource, /lastSignalAt/);
  assert.match(scoringSource, /flaggedCommentsOmitted/);
  assert.match(commentsSource, /Showing the top/);
  assert.match(sidecardsSource, /Current signals/);
  assert.match(sidecardsSource, /No current reasons/);
  assert.match(sidecardsSource, /older signal/);
  const activitySource = readFileSync(
    'src/client/firewatch/incident-activity.tsx',
    'utf8'
  );
  assert.match(activitySource, /const shownSignals = visibleSignals\.slice\(0, 16\)/);
  assert.match(activitySource, /older activity item/);
  assert.match(activitySource, /older signal/);
});

test('username history opens a reusable factual Reddit-style card', () => {
  const historySource = readFileSync(
    'src/client/firewatch/username-history.tsx',
    'utf8'
  );
  const commentsSource = readFileSync(
    'src/client/firewatch/comments/flagged-comments-card.tsx',
    'utf8'
  );
  const headerSource = readFileSync(
    'src/client/firewatch/overview/post-header.tsx',
    'utf8'
  );
  const activitySource = readFileSync(
    'src/client/firewatch/incident-activity.tsx',
    'utf8'
  );
  const rulesSource = readFileSync(
    'src/client/firewatch/incident-rules.tsx',
    'utf8'
  );

  assert.match(historySource, /export const UsernameHistoryTrigger/);
  assert.match(historySource, /DropdownMenu\.Root/);
  assert.match(historySource, /DropdownMenu\.Content/);
  assert.match(
    historySource,
    /Firewatch facts for this thread and stored strikes/
  );
  assert.match(historySource, /Firewatch strike history/);
  assert.match(historySource, /Prepared automations/);
  assert.match(historySource, /Mod actions involving this user/);
  assert.match(historySource, /Comments in this thread/);
  assert.match(historySource, /No Firewatch history for this user yet/);
  assert.doesNotMatch(historySource, /export const buildUserHistory/);
  assert.match(commentsSource, /<UsernameHistoryTrigger/);
  assert.match(headerSource, /<UsernameHistoryTrigger/);
  assert.match(activitySource, /<UsernameHistoryTrigger/);
  assert.match(rulesSource, /<UsernameHistoryTrigger/);
});

test('user history receives every stored strike while retaining recent strike counts', () => {
  const strikesSource = readFileSync(
    'src/server/core/firewatch-rules/strikes.ts',
    'utf8'
  );

  assert.match(strikesSource, /const recentStrikes = strikes\.filter/);
  assert.match(strikesSource, /strikeCount: recentStrikes\.length/);
  assert.match(strikesSource, /strikes,/);
  assert.doesNotMatch(strikesSource, /strikes: recentStrikes/);
});

test('demo creation is additive and reset deletes Reddit demo posts', () => {
  const source = readFileSync('src/server/core/firewatch/demo.ts', 'utf8');
  const createStart = source.indexOf('export const createDemoIncident');
  const createEnd = source.indexOf('export const resetDemoIncidents', createStart);
  const createSource = source.slice(createStart, createEnd);
  const resetStart = source.indexOf('export const resetDemoIncidents');
  const resetSource = source.slice(resetStart);
  const apiSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const boardStateSource = readFileSync(
    'src/client/firewatch/board-states.tsx',
    'utf8'
  );
  const dashboardSource = readFileSync(
    'src/client/firewatch/use-dashboard.ts',
    'utf8'
  );
  const settingsSource = readFileSync(
    'src/client/firewatch/settings/community-controls.tsx',
    'utf8'
  );

  assert.doesNotMatch(createSource, /await resetDemoIncidents\(\)/);
  assert.match(createSource, /export const createDemoIncidents/);
  assert.match(createSource, /scenarioIds\.length > 0/);
  assert.match(createSource, /for \(const scenarioId of selectedScenarioIds\)/);
  assert.match(createSource, /deleteRedditPostIfExists\(postId\)/);
  assert.match(resetSource, /deleteDemoRedditPost\(postId\)/);
  assert.match(resetSource, /clearUserStrikesForPost\(context\.subredditName, username, cleanup\.postId\)/);
  assert.match(resetSource, /clearRememberedIncident\(\)/);
  assert.doesNotMatch(resetSource, /startsWith\('demo'\)/);
  assert.match(resetSource, /if \(normalized\) demoAuthors\.add\(normalized\)/);
  assert.match(apiSource, /scenarioIds: FirewatchDemoScenarioId\[\]/);
  assert.match(createSource, /export const createDemoIncidentBatch/);
  assert.match(apiSource, /createDemoIncidentBatch\(scenarioIds\)/);
  assert.match(apiSource, /type: 'demo-create'/);
  assert.match(apiSource, /failures: result\.failures/);
  assert.match(boardStateSource, /selectedScenarioIds/);
  assert.match(boardStateSource, /onCreateDemo\(selectedScenarioIds\)/);
  assert.match(boardStateSource, /Choose demo scenarios/);
  assert.doesNotMatch(boardStateSource, /Choose one demo scenario/);
  assert.doesNotMatch(dashboardSource, /selectedScenarioIds\.reduce/);
  assert.match(dashboardSource, /scenarioId: selectedScenarioIds\[0\]/);
  assert.match(dashboardSource, /body: \{ scenarioIds: selectedScenarioIds \}/);
  assert.doesNotMatch(settingsSource, /Replace demo thread|cleared first|one clean demo/);
});

test('demo review data reads like real incidents with honest counting', () => {
  const demoSource = readFileSync('src/server/core/firewatch/demo.ts', 'utf8');
  const postSeedStart = demoSource.indexOf('const buildDemoPostSeed');
  const postSeedEnd = demoSource.indexOf(
    'export const buildDemoComments',
    postSeedStart
  );
  const postSeedSource = demoSource.slice(postSeedStart, postSeedEnd);
  const scoringSource = readFileSync(
    'src/server/core/firewatch-scoring.ts',
    'utf8'
  );
  const strikesSource = readFileSync(
    'src/server/core/firewatch-rules/strikes.ts',
    'utf8'
  );
  const postHeaderSource = readFileSync(
    'src/client/firewatch/overview/post-header.tsx',
    'utf8'
  );
  const commentActionsSource = readFileSync(
    'src/server/core/firewatch/actions/comment-actions.ts',
    'utf8'
  );
  const userActionsSource = readFileSync(
    'src/server/core/firewatch/actions/user-actions.ts',
    'utf8'
  );

  assert.match(demoSource, /\[Firewatch demo\] Official giveaway claim/);
  assert.match(demoSource, /\[Firewatch demo\] Account recovery agent/);
  assert.match(demoSource, /\[Firewatch demo\] Locked account help thread/);
  assert.match(demoSource, /\[Firewatch demo\] Mods removed the warning/);
  assert.doesNotMatch(demoSource, /This is a Firewatch demo post/);
  assert.doesNotMatch(
    demoSource,
    new RegExp(`Demo report|Demo post sent|${'demo'}Spammer|${'demo'}Newcomer`)
  );
  assert.match(postSeedSource, /I was told this community still has unused promotional payouts/);
  assert.match(postSeedSource, /A warning thread disappeared this morning/);
  assert.doesNotMatch(postSeedSource, /demoUrl|hxxps?:\/\/|\(dot\)/);
  assert.doesNotMatch(demoSource, /Created .* demo with/);
  assert.match(demoSource, /commentModel: 'sample_review_signals'/);
  assert.match(demoSource, /\$\{comments\.length\} sample review comments/);
  assert.doesNotMatch(demoSource, /with [0-9]+ comments plus post and comment reports/);
  assert.match(demoSource, /\(dot\)/);
  assert.doesNotMatch(demoSource, /hxxps?:\/\//);
  assert.match(demoSource, /try \{\s*const ruleLogs = await recordRuleMatches/);
  assert.match(demoSource, /return await runRuleAutomationActions/);
  assert.match(demoSource, /return enrichedDemoIncident/);
  assert.match(scoringSource, /const contentSignals = uniqueContentSignals\(scoreSignals\)/);
  assert.match(scoringSource, /const keywordHits = contentSignals\.reduce/);
  assert.match(scoringSource, /const suspiciousHits = contentSignals\.reduce/);
  assert.match(strikesSource, /export const clearUserStrikesForPost/);
  assert.match(strikesSource, /strike\.relatedPostId !== normalizedPostId/);
  assert.doesNotMatch(postHeaderSource, /<InlineState>Demo<\/InlineState>/);
  assert.doesNotMatch(commentActionsSource, /Marked demo comment/);
  assert.doesNotMatch(userActionsSource, /recorded demo|Recorded demo/);
});

test('app reset deletes Firewatch-owned storage', () => {
  const storeSource = readFileSync('src/server/core/firewatch/store.ts', 'utf8');
  const utilsSource = readFileSync(
    'src/server/core/firewatch-utils.ts',
    'utf8'
  );
  const apiSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const clientSource = readFileSync(
    'src/client/firewatch/settings/community-controls.tsx',
    'utf8'
  );
  const resetStart = storeSource.indexOf('export const resetAppData');
  const resetSource = storeSource.slice(resetStart);

  assert.match(apiSource, /api\.post\('\/app\/reset'/);
  assert.match(clientSource, /Delete all Firewatch data/);
  assert.match(utilsSource, /indexKey = \(subredditName: string\)/);
  assert.match(resetSource, /deleteRedditPostIfExists\(postId\)/);
  assert.match(resetSource, /INDEX_KEY/);
  assert.match(resetSource, /indexKey\(subredditName\)/);
  assert.match(resetSource, /boardPostKey\(subredditName\)/);
  assert.match(resetSource, /configKey\(subredditName\)/);
  assert.match(resetSource, /incidentRegistryKey\(subredditName\)/);
  assert.match(resetSource, /automationRulesKey\(subredditName\)/);
  assert.match(resetSource, /ruleLogsKey\(subredditName\)/);
  assert.match(resetSource, /userRegistryKey\(subredditName\)/);
  assert.match(resetSource, /userStrikeKeyRegistryKey\(subredditName\)/);
  assert.match(resetSource, /incidentKey\(postId\)/);
  assert.match(resetSource, /claimKey\(postId\)/);
  assert.match(resetSource, /selectionKey\(subredditName, username\)/);
  assert.match(resetSource, /trackedUserStrikeKeys/);
  assert.match(resetSource, /userStrikesKey\(subredditName, username\)/);
  assert.match(resetSource, /redditPostDeleteCount/);
  assert.match(storeSource, /await redis\.del\(\.\.\.uniqueKeys\.slice/);
});

test('board post storage rejects legacy entries without inline splash metadata', () => {
  const boardSource = readFileSync(
    'src/server/core/firewatch/board.ts',
    'utf8'
  );
  const boardStateSource = readFileSync(
    'src/server/core/firewatch/board-post-state.ts',
    'utf8'
  );
  const storeSource = readFileSync('src/server/core/firewatch/store.ts', 'utf8');
  const signalsSource = readFileSync(
    'src/server/core/firewatch/signals.ts',
    'utf8'
  );

  assert.match(boardStateSource, /BOARD_POST_FORMAT_VERSION = 'inline-splash-v1'/);
  assert.match(boardStateSource, /serializeBoardPostReference/);
  assert.match(boardStateSource, /parseBoardPostReference/);
  assert.match(boardStateSource, /allowLegacyPlainString/);
  assert.match(boardStateSource, /options\?\.allowLegacyPlainString \? value : undefined/);
  assert.match(boardSource, /serializeBoardPostReference\(post\.id\)/);
  assert.match(boardSource, /parseBoardPostReference\(storedPostValue\)/);
  assert.match(boardSource, /else if \(storedPostValue\)/);
  assert.match(storeSource, /allowLegacyPlainString: true/);
  assert.match(signalsSource, /allowLegacyPlainString: true/);
});

test('automations and strike registries persist until explicit deletion', () => {
  const rulesStoreSource = readFileSync(
    'src/server/core/firewatch-rules/store.ts',
    'utf8'
  );
  const strikesSource = readFileSync(
    'src/server/core/firewatch-rules/strikes.ts',
    'utf8'
  );
  const utilsSource = readFileSync(
    'src/server/core/firewatch-utils.ts',
    'utf8'
  );
  const saveAutomationsStart = rulesStoreSource.indexOf(
    'const saveAutomations'
  );
  const saveAutomationsEnd = rulesStoreSource.indexOf(
    'const normalizeRuleScope',
    saveAutomationsStart
  );
  const saveAutomationsSource = rulesStoreSource.slice(
    saveAutomationsStart,
    saveAutomationsEnd
  );
  const addStrikeStart = strikesSource.indexOf('export const addUserStrike');
  const addStrikeEnd = strikesSource.indexOf(
    'export const getUserStrikes',
    addStrikeStart
  );
  const addStrikeSource = strikesSource.slice(addStrikeStart, addStrikeEnd);
  const clearPostStart = strikesSource.indexOf(
    'export const clearUserStrikesForPost'
  );
  const clearPostEnd = strikesSource.indexOf(
    'export const getUserStrikeSummaries',
    clearPostStart
  );
  const clearPostSource = strikesSource.slice(clearPostStart, clearPostEnd);

  assert.match(utilsSource, /userStrikeKeyRegistryKey/);
  assert.doesNotMatch(saveAutomationsSource, /expiration/);
  assert.match(strikesSource, /export const getTrackedUserStrikeKeys/);
  assert.match(strikesSource, /trackUserStrikeKey/);
  assert.match(strikesSource, /untrackUserStrikeKey/);
  assert.doesNotMatch(addStrikeSource, /expiration/);
  assert.doesNotMatch(clearPostSource, /expiration/);
});

test('storage keeps queue index subreddit scoped and claim state synchronized', () => {
  const storeSource = readFileSync('src/server/core/firewatch/store.ts', 'utf8');
  const signalsSource = readFileSync(
    'src/server/core/firewatch/signals.ts',
    'utf8'
  );

  assert.match(storeSource, /redis\.get\(indexKey\(subredditName\)\)/);
  assert.match(storeSource, /redis\.get\(INDEX_KEY\)/);
  assert.match(storeSource, /await saveIndex\(migratedPostIds, subredditName\)/);
  assert.match(storeSource, /saveStoredClaim\(incident\)/);
  assert.match(storeSource, /hydrateStoredClaim\(parsed\)/);
  assert.match(storeSource, /await redis\.del\(claimKey\(incident\.postId\)\)/);
  assert.match(signalsSource, /const subredditName = incident\?\.subredditName \?\? context\.subredditName/);
  assert.match(signalsSource, /await saveIndex\(\s*\n\s*index\.filter\(\(id\) => id !== normalizedPostId\),\s*\n\s*subredditName\s*\n\s*\)/);
  assert.match(signalsSource, /const candidatePostIds = Array\.from\(new Set\(\[\.\.\.index, \.\.\.registry\]\)\)/);
});

test('dashboard queue list refreshes stale visible incidents without refreshing resolved history', () => {
  const signalsSource = readFileSync(
    'src/server/core/firewatch/signals.ts',
    'utf8'
  );
  const dashboardSource = readFileSync(
    'src/server/routes/dashboard.ts',
    'utf8'
  );
  const getIncidentsStart = signalsSource.indexOf('export const getIncidents');
  const getIncidentsEnd = signalsSource.indexOf(
    'export const getIncidentById',
    getIncidentsStart
  );
  const getIncidentsSource = signalsSource.slice(
    getIncidentsStart,
    getIncidentsEnd
  );
  const getIncidentByIdSource = signalsSource.slice(getIncidentsEnd);

  assert.match(getIncidentsSource, /shouldShowInQueue\(incident\)\s*\n\s*\? refreshIncidentForRead\(incident\)\s*\n\s*: incident/);
  assert.match(getIncidentsSource, /resolvedIncidents/);
  assert.match(getIncidentByIdSource, /return refreshIncidentForRead\(incident\)/);
  assert.match(dashboardSource, /getIncidents\(\)/);
  assert.match(dashboardSource, /getIncidentById\(requestedSelectedPostId\)/);
  assert.match(dashboardSource, /requestedSelectedPostId && !contextSelectedPostId && !selectedIncident/);
  assert.match(dashboardSource, /await clearRememberedIncident\(\)/);
});

test('trigger routes sanitize timestamps and share one error wrapper', () => {
  const triggerSource = readFileSync('src/server/routes/triggers.ts', 'utf8');
  const responseSource = readFileSync('src/server/routes/responses.ts', 'utf8');
  const apiSource = readFileSync('src/shared/api.ts', 'utf8');
  const clientApiSource = readFileSync(
    'src/client/firewatch/api-client.ts',
    'utf8'
  );
  const signalSource = readFileSync(
    'src/server/core/firewatch/signals.ts',
    'utf8'
  );
  const incidentSource = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );

  assert.match(triggerSource, /const runTrigger = async/);
  assert.match(triggerSource, /logFirewatchError\('trigger\.failed'/);
  assert.match(triggerSource, /status: 'ok',\n\s+message: `\$\{label\} failed:/);
  assert.doesNotMatch(triggerSource, /status: 'error',\n\s+message: `\$\{label\} failed:/);
  assert.match(triggerSource, /Date\.parse\(value\)/);
  assert.match(triggerSource, /parsed > currentTime \+ fiveMinutes/);
  assert.match(triggerSource, /redditCreatedAt\(comment\?\.createdAt\)/);
  assert.match(signalSource, /DASHBOARD_READ_REFRESH_INTERVAL_MS/);
  assert.match(signalSource, /refreshIncidentForRead/);
  assert.match(incidentSource, /incident\.comment_state_fallback/);
  assert.match(apiSource, /export type ErrorResponseCode =\n\s+\| 'action_failed'/);
  assert.match(apiSource, /code: ErrorResponseCode/);
  assert.match(apiSource, /\| 'reddit_unavailable'/);
  assert.match(apiSource, /retryable\?: boolean/);
  assert.match(responseSource, /responseCodeFor/);
  assert.match(responseSource, /isRouteError/);
  assert.match(responseSource, /isTransientRedditRuntimeError/);
  assert.match(responseSource, /return 'reddit_unavailable'/);
  assert.match(responseSource, /return 503/);
  assert.match(responseSource, /code === 'reddit_unavailable'/);
  assert.match(responseSource, /statusForCode/);
  assert.match(clientApiSource, /class FirewatchApiError extends Error/);
  assert.match(clientApiSource, /readonly code\?: ErrorResponse\['code'\]/);
  assert.match(clientApiSource, /readonly retryable\?: boolean/);
});

test('automation matching filters by trigger and source scope', () => {
  const source = [
    readFileSync('src/shared/api.ts', 'utf8'),
    readFileSync('src/server/core/firewatch-rules/matching.ts', 'utf8'),
    readFileSync('src/server/core/firewatch/automation.ts', 'utf8'),
    readFileSync('src/server/core/firewatch-rules/scope.ts', 'utf8'),
    readFileSync('src/server/core/firewatch-rules/metrics.ts', 'utf8'),
    readFileSync('src/shared/incidents.ts', 'utf8'),
  ].join('\n');

  assert.match(source, /ruleUpdatedAt\?: string/);
  assert.match(source, /dismissedRuleMatchKeys\?: string\[\]/);
  assert.match(source, /ruleUpdatedAt: rule\.updatedAt/);
  assert.match(source, /export const ruleMatchKey/);
  assert.match(source, /export const ruleDismissalKey/);
  assert.match(source, /dismissedRuleMatchKeys\.has\(ruleDismissalKey\(match\)\)/);
  assert.match(source, /log\.ruleUpdatedAt === match\.ruleUpdatedAt/);
  assert.match(source, /\$\{match\.ruleId\}:\$\{match\.ruleUpdatedAt \?\? ''\}/);
  assert.match(source, /recordRuleExecutionLog\(\s*\{[\s\S]*?currentIncident\.subredditName\s*\)/);
  assert.match(source, /recordRuleExecutionLog\(\s*\{[\s\S]*?incident\.subredditName\s*\)/);
  assert.match(source, /triggerTypesForIncident/);
  assert.match(source, /!effectiveTriggerTypes\.has\(rule\.trigger\.type\)/);
  assert.match(source, /await reddit\s*\n\s*\.getModerators/);
  assert.match(source, /moderatorUsers\.has/);
  assert.match(source, /candidate\.targetType === 'comment'/);
  assert.match(source, /postReportsIgnored/);
  assert.match(source, /comment_reports_ignored/);
  assert.match(source, /comment_reports_unignored/);
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
  const incidentsSource = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );

  assert.match(serverSource, /targetId\?: string/);
  assert.match(serverSource, /rule\.targetId === targetId/);
  assert.match(apiSource, /targetId\?: string/);
  assert.match(apiSource, /\/incidents\/:postId\/rules\/:ruleId\/dismiss/);
  assert.match(apiSource, /Automation match target was missing/);
  assert.match(clientSource, /targetId: rule\.targetId/);
  assert.match(clientSource, /rule-dismiss:\$\{rule\.ruleId\}:\$\{rule\.targetId\}/);
  assert.match(incidentsSource, /const key = ruleDismissalKey\(input\)/);
  assert.match(incidentsSource, /matchedRules: \(incident\.matchedRules \?\? \[\]\)\.filter/);
  assert.match(incidentsSource, /ruleDismissalKey\(match\) !== key/);
  assert.doesNotMatch(clientSource, /dismissedRuleIds|dismissedRuleKeys/);
});

test('client refreshes dashboard state after settings, automations, and actions', () => {
  const source = readFileSync('src/client/firewatch/use-dashboard.ts', 'utf8');

  assert.match(source, /preserveOnError\?: boolean/);
  assert.match(source, /await refresh\(\{ preserveOnError: true \}\);/);
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
  const moderatorsSource = readFileSync(
    'src/server/core/firewatch/moderators.ts',
    'utf8'
  );
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
    '/incidents/:postId/rules/:ruleId/dismiss',
    '/incidents/:postId/users/:username/strikes/clear',
  ];

  assert.match(
    apiSource,
    /api\.post\('\/incidents\/:postId\/claim'[\s\S]*?claimIncident\(c\.req\.param\('postId'\)\)/
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
  assert.match(moderatorsSource, /export const currentModeratorName = async/);
  assert.match(apiSource, /currentModeratorName\(\)/);
  assert.match(apiSource, /Claim this post before taking mod actions/);
  assert.match(apiSource, /Only that mod can take actions/);
  assert.match(apiSource, /usernameKey\(claimOwner\) !== usernameKey\(actor\)/);
});

test('claim ownership rejects duplicate ownership and release by another mod', () => {
  const source = readFileSync(
    'src/server/core/firewatch/incidents.ts',
    'utf8'
  );

  assert.match(source, /usernameKey\(incident\.claim\.username\)/);
  assert.match(source, /currentModeratorName\(\)/);
  assert.match(source, /parseStoredIncidentClaim/);
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
  assert.match(source, /disabled=\{Boolean\(busyAction\) \|\| actionLocked\}/);
  assert.match(source, /Boolean\(busyAction\) \|\| actionLocked \|\| !canSaveHandoff/);
  assert.match(source, /description=\{actionLocked \? actionLockReason : undefined\}/);
  assert.match(source, /title=\{actionLocked \? actionLockReason : undefined\}/);
});

test('moderator access labels are plain language for mod teams', () => {
  assert.equal(
    formatModeratorPermissionList(['posts'], { includeAllFallback: true }),
    'post and comment moderation, or full mod access'
  );
  assert.equal(
    formatModeratorPermissionList(['config'], { includeAllFallback: true }),
    'subreddit settings, or full mod access'
  );
  assert.equal(
    formatModeratorPermissionList(['posts', 'flair'], {
      includeAllFallback: true,
    }),
    'post and comment moderation and post flair, or full mod access'
  );
  assert.equal(formatModeratorPermissionList([]), 'moderator access');
});

test('moderator permissions guard mod-only data and actions', () => {
  const apiSource = readFileSync('src/server/routes/api.ts', 'utf8');
  const authSource = readFileSync('src/server/routes/auth.ts', 'utf8');
  const dashboardSource = readFileSync(
    'src/server/routes/dashboard.ts',
    'utf8'
  );
  const moderationPermissionsSource = readFileSync(
    'src/server/routes/moderation-permissions.ts',
    'utf8'
  );
  const menuSource = readFileSync('src/server/routes/menu.ts', 'utf8');
  const formsSource = readFileSync('src/server/routes/forms.ts', 'utf8');
  const appSource = readFileSync('src/client/firewatch/app.tsx', 'utf8');
  const boardSource = readFileSync(
    'src/client/firewatch/board-states.tsx',
    'utf8'
  );
  const sharedApiSource = readFileSync('src/shared/api.ts', 'utf8');
  const devvitConfig = readFileSync('devvit.json', 'utf8');
  const parsedDevvitConfig = JSON.parse(devvitConfig);

  assert.ok(Array.isArray(parsedDevvitConfig.menu?.items));
  assert.equal(
    parsedDevvitConfig.menu.items.every(
      (item) => item.forUserType === 'moderator'
    ),
    true
  );
  assert.match(authSource, /getModPermissionsForSubreddit\(subredditName\)/);
  assert.match(authSource, /export const hasModeratorPermissions/);
  assert.match(authSource, /export class ModeratorPermissionError/);
  assert.match(authSource, /formatModeratorPermissionList/);
  assert.match(apiSource, /accessDeniedPayload\(access, 'view moderation review data'\)/);
  assert.match(dashboardSource, /type ModeratorAccess = Awaited<ReturnType<typeof getModeratorAccess>>/);
  assert.match(apiSource, /loadDashboardData\(access\)/);
  assert.match(dashboardSource, /initialAccess \?\? getModeratorAccess\(DASHBOARD_PERMISSIONS\)/);
  assert.match(dashboardSource, /const selectedPostId = selectedIncident\?\.postId/);
  assert.match(dashboardSource, /reviewVisibleConfig\(config, canConfigure\)/);
  assert.match(dashboardSource, /canUseFlair \? getPostFlairOptions/);
  assert.match(dashboardSource, /canConfigure \? getAutomations/);
  assert.match(dashboardSource, /canConfigure \? getRuleExecutionLogs/);
  assert.match(apiSource, /postActionPermissions\(body\.action\)/);
  assert.match(apiSource, /userActionPermissions\(body\.action\)/);
  assert.match(apiSource, /ruleActionPermissions\(rule\.actions\)/);
  assert.match(moderationPermissionsSource, /action\.type === 'add_firewatch_strike'/);
  assert.match(apiSource, /undoActionPermissions\(action\.type\)/);
  assert.match(apiSource, /requireModeratorPermissions\(\s*CONFIG_PERMISSIONS/);
  assert.match(menuSource, /requireModeratorPermissions/);
  assert.match(formsSource, /requireModeratorPermissions/);
  assert.match(appSource, /loadState\.status === 'access_denied'/);
  assert.match(appSource, /change subreddit settings/);
  assert.match(boardSource, /Private mod view/);
  assert.match(boardSource, /formatModeratorPermissionList/);
  assert.match(boardSource, /private moderation data|Check again/);
  assert.match(sharedApiSource, /export type AccessDeniedResponse/);
  assert.match(sharedApiSource, /moderatorPermissions: FirewatchModeratorPermission\[\]/);
});

test('runtime docs and logs describe reliability-sensitive behavior honestly', () => {
  const readmeSource = readFileSync('README.md', 'utf8');
  const architectureSource = readFileSync('docs/architecture.md', 'utf8');
  const loggingSource = readFileSync(
    'src/server/core/firewatch/logging.ts',
    'utf8'
  );
  const triggerSource = readFileSync('src/server/routes/triggers.ts', 'utf8');
  const signalsSource = readFileSync(
    'src/server/core/firewatch/signals.ts',
    'utf8'
  );
  const demoSource = readFileSync(
    'src/server/core/firewatch/demo.ts',
    'utf8'
  );

  assert.match(
    readmeSource,
    /demo drills.*seed realistic incidents for playtesting in a sandbox subreddit/i
  );
  assert.match(readmeSource, /deterministic signal queue, not a complete abuse detector/);
  assert.match(architectureSource, /automation rules, rule logs, user strikes/);
  assert.doesNotMatch(readmeSource, /automation, and user strike records expire after 30 days/);
  assert.match(architectureSource, /All client\/server payloads flow through types in `src\/shared\/api\.ts`/);
  assert.match(architectureSource, /Delete Handling/);
  assert.match(architectureSource, /Playtests run against a real subreddit/i);
  assert.match(loggingSource, /logFirewatchError/);
  assert.match(loggingSource, /safeErrorMessage/);
  assert.match(triggerSource, /logFirewatchError\('trigger\.failed'/);
  assert.match(signalsSource, /incident\.refresh_for_read_failed/);
  assert.match(demoSource, /demo\.create_failed/);
});

test('vite config does not hide client bundle size warnings', () => {
  const viteSource = readFileSync('vite.config.ts', 'utf8');

  assert.doesNotMatch(viteSource, /chunkSizeWarningLimit/);
  assert.match(viteSource, /devvit\(\)/);
});

test('sidebar queue filters keep resolved posts out of active queues', () => {
  const appSource = readFileSync('src/client/firewatch/app.tsx', 'utf8');
  const shellSource = readFileSync(
    'src/client/firewatch/shell/firewatch-shell.tsx',
    'utf8'
  );
  const commandPanelSource = readFileSync(
    'src/client/firewatch/shell/command-panel.tsx',
    'utf8'
  );
  const queueItemSource = readFileSync(
    'src/client/firewatch/shell/incident-queue-item.tsx',
    'utf8'
  );
  const signalsSource = readFileSync(
    'src/server/core/firewatch/signals.ts',
    'utf8'
  );

  assert.match(appSource, /useState<QueueFilter>\('all'\)/);
  assert.match(appSource, /const unresolvedIncidents = useMemo/);
  assert.match(appSource, /!isTerminalStatus\(incident\.status\)/);
  assert.match(appSource, /all: unresolvedIncidents\.length/);
  assert.match(appSource, /isIncidentClaimedByCurrentUser\(incident, data\.username\)/);
  assert.match(appSource, /isTerminalStatus\(incident\.status\)/);
  assert.match(appSource, /FilteredQueueEmptyBoard/);
  assert.match(shellSource, /queueFilterCounts/);
  assert.match(commandPanelSource, /<QueueFilterTabs/);
  assert.match(queueItemSource, /Unresolved posts I claimed/);
  assert.match(queueItemSource, /shortLabel: 'Claimed'/);
  assert.match(queueItemSource, /role="radiogroup"/);
  assert.match(signalsSource, /getIncidentRegistry/);
  assert.match(signalsSource, /resolvedIncidents/);
  assert.match(signalsSource, /normalizeStatus\(incident\.status\) === 'resolved'/);
});
