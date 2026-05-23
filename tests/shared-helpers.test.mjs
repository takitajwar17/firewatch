import assert from 'node:assert/strict';
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
