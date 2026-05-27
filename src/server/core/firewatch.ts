// Public Firewatch server facade used by route modules. Keeping this as a
// narrow barrel makes route imports explicit while preserving module ownership
// under src/server/core/firewatch.
export {
  createFirewatchPost,
  getOrCreateFirewatchBoardPost,
} from './firewatch/board';
export {
  createDemoIncident,
  createDemoIncidentBatch,
  createDemoIncidents,
  resetDemoIncidents,
} from './firewatch/demo';
export {
  deleteStoredCommentContent,
  deleteStoredPostContent,
  getIncidentById,
  getIncidents,
  recordExternalModAction,
  upsertIncidentSignal,
} from './firewatch/signals';
export {
  approveFlaggedComment,
  applyNativeCommentAction,
  bulkReviewComments,
  removeFlaggedComment,
} from './firewatch/actions/comment-actions';
export { undoIncidentAction } from './firewatch/actions/undo-actions';
export { applyNativePostAction } from './firewatch/actions/post-actions';
export {
  applyNativeUserAction,
  banUserAndRemoveComments,
} from './firewatch/actions/user-actions';
export {
  claimIncident,
  clearIncidentUserStrikes,
  coolDownIncident,
  dismissMatchedRule,
  lockIncident,
  unclaimIncident,
} from './firewatch/incidents';
export {
  clearRememberedIncident,
  getRememberedIncidentPostId,
  rememberSelectedIncident,
  resetAppData,
} from './firewatch/store';
export { escalateIncident, resolveIncident } from './firewatch/incidents';
export { runPreparedRuleActions } from './firewatch/automation';
export { getConfig, getConfigFormDefaults, saveConfig } from './firewatch/store';
