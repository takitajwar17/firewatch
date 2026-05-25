export type IncidentLevel = 'watch' | 'heat' | 'fire' | 'wildfire';

export type FirewatchDemoScenarioId =
  | 'heated_thread'
  | 'scam_link_cleanup'
  | 'suspicious_giveaway_escalating'
  | 'support_safety_cleanup';

export type IncidentStatus =
  | 'open'
  | 'watching'
  | 'review'
  | 'claimed'
  | 'cooldown'
  | 'locked'
  | 'handled'
  | 'resolved';

export type SignalType =
  | 'post_create'
  | 'post_update'
  | 'comment_create'
  | 'comment_report'
  | 'post_report'
  | 'manual_escalation'
  | 'mod_action'
  | 'automod_filter';

export type SignalSource =
  | 'user'
  | 'report'
  | 'mod_action'
  | 'firewatch_notice';

export type CrowdControlLevel = 'OFF' | 'LENIENT' | 'MEDIUM' | 'STRICT';

export type NativePostAction =
  | 'approve'
  | 'remove'
  | 'spam'
  | 'unlock'
  | 'mark-nsfw'
  | 'unmark-nsfw'
  | 'mark-spoiler'
  | 'unmark-spoiler'
  | 'ignore-reports'
  | 'unignore-reports'
  | 'crowd-control'
  | 'set-flair';

export type NativeCommentAction =
  | 'spam'
  | 'lock'
  | 'unlock'
  | 'ignore-reports'
  | 'unignore-reports'
  | 'remove-thread'
  | 'show-comment';

export type NativeUserAction =
  | 'approve'
  | 'mute'
  | 'add-mod-note'
  | 'remove-recent-content';

export type PostFlairOption = {
  id: string;
  text: string;
  backgroundColor: string;
  textColor: string;
  modOnly: boolean;
  allowUserEdits: boolean;
};

export type PostFlairState = {
  text: string;
  templateId?: string;
  backgroundColor?: string;
  textColor?: string;
};

export type IncidentPostState = {
  approved: boolean;
  ignoringReports: boolean;
  locked: boolean;
  nsfw: boolean;
  removed: boolean;
  spam: boolean;
  spoiler: boolean;
  flair?: PostFlairState;
};

export type IncidentActionType =
  | 'claimed'
  | 'cool_down'
  | 'cleanup'
  | 'comment_approved'
  | 'comment_removed'
  | 'comment_spammed'
  | 'comment_locked'
  | 'comment_unlocked'
  | 'comment_reports_ignored'
  | 'comment_reports_unignored'
  | 'comment_thread_removed'
  | 'comment_shown'
  | 'user_banned'
  | 'user_approved'
  | 'user_muted'
  | 'user_content_removed'
  | 'mod_note_added'
  | 'post_approved'
  | 'post_removed'
  | 'post_spammed'
  | 'post_unlocked'
  | 'post_nsfw'
  | 'post_marked_nsfw'
  | 'post_unmarked_nsfw'
  | 'post_spoiler'
  | 'post_marked_spoiler'
  | 'post_unmarked_spoiler'
  | 'post_reports_ignored'
  | 'post_reports_unignored'
  | 'post_crowd_control'
  | 'post_flaired'
  | 'firewatch_strike_added'
  | 'rule_action_executed'
  | 'rule_prepared'
  | 'locked'
  | 'escalated'
  | 'resolved'
  | 'demo_seeded';

export type RuleMode =
  | 'suggest_only'
  | 'prepare_for_approval'
  | 'auto_run_safe_actions'
  | 'auto_run_all_selected_actions';

export type RuleTrigger =
  | { type: 'new_post' }
  | { type: 'new_comment' }
  | { type: 'post_report' }
  | { type: 'comment_report' }
  | { type: 'comment_removed' }
  | { type: 'post_removed' }
  | { type: 'incident_score_changed' }
  | { type: 'user_strike_count_changed' };

export type RuleScope = {
  target: 'post' | 'comment' | 'user' | 'incident';
  subredditId: string;
  excludeModerators: boolean;
  excludeApprovedUsers: boolean;
  excludeFirewatchNotices: boolean;
  excludeAutoModerator: boolean;
  postFlairs?: string[];
  commentAuthors?: string[];
  ignoredAuthors?: string[];
};

export type RuleCondition =
  | {
      type: 'text_contains';
      value: string;
      match: 'contains' | 'exact' | 'regex';
      caseSensitive?: boolean;
    }
  | {
      type: 'watched_word_hit';
      minHits: number;
    }
  | {
      type: 'watched_domain_hit';
      domains?: string[];
      minHits: number;
    }
  | {
      type: 'has_link';
      minLinks: number;
    }
  | {
      type: 'user_strikes';
      operator: '>=' | '>' | '=';
      value: number;
      windowMinutes?: number;
    }
  | {
      type: 'user_removed_comments';
      operator: '>=' | '>' | '=';
      value: number;
      windowMinutes: number;
    }
  | {
      type: 'post_reports';
      operator: '>=' | '>' | '=';
      value: number;
      windowMinutes?: number;
    }
  | {
      type: 'incident_score';
      operator: '>=' | '>' | '=';
      value: number;
    }
  | {
      type: 'repeated_phrase';
      minMatches: number;
      windowMinutes: number;
    }
  | {
      type: 'reply_cluster';
      minComments: number;
      windowMinutes: number;
    };

export type RuleCounter = {
  countBy: 'user' | 'post' | 'thread' | 'domain' | 'phrase';
  threshold: number;
  windowMinutes: number;
};

export type RuleAction =
  | { type: 'queue_incident'; reason: string }
  | { type: 'add_firewatch_strike'; reason: string; weight?: number }
  | { type: 'save_firewatch_log'; message: string }
  | { type: 'generate_handoff'; template?: string }
  | { type: 'add_native_mod_note'; note: string }
  | { type: 'remove_comment'; reason: string }
  | { type: 'remove_post'; reason: string }
  | { type: 'approve_comment' }
  | { type: 'approve_post' }
  | { type: 'mark_spam'; target: 'post' | 'comment' }
  | { type: 'sticky_reminder'; text: string }
  | { type: 'lock_post'; reason?: string }
  | { type: 'set_post_flair'; flairText: string }
  | { type: 'ignore_reports'; target: 'post' | 'comment' }
  | { type: 'prepare_temp_ban'; durationDays: number; reason: string }
  | { type: 'prepare_permanent_ban'; reason: string }
  | { type: 'mute_user'; durationDays?: number; reason: string }
  | { type: 'mark_handled' };

export type FirewatchRule = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: RuleTrigger;
  scope: RuleScope;
  conditions: RuleCondition[];
  counter?: RuleCounter;
  actions: RuleAction[];
  mode: RuleMode;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FirewatchRuleInput = Omit<
  FirewatchRule,
  'createdAt' | 'createdBy' | 'id' | 'updatedAt'
> & {
  id?: string;
};

export type PreparedRuleAction = {
  id: string;
  action: RuleAction;
  label: string;
  risk: 'safe' | 'destructive' | 'restricted';
  targetId?: string | undefined;
  targetType: 'post' | 'comment' | 'user' | 'incident';
  username?: string | undefined;
};

export type MatchedAutomationRule = {
  id: string;
  ruleId: string;
  ruleName: string;
  mode: RuleMode;
  matchedAt: string;
  targetId: string;
  targetType: 'post' | 'comment' | 'user' | 'incident';
  username?: string | undefined;
  why: string[];
  preparedActions: PreparedRuleAction[];
};

export type RuleExecutionLog = {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  triggerType: string;
  targetType: 'post' | 'comment' | 'user' | 'incident';
  targetId: string;
  matchedConditions: string[];
  preparedActions: string[];
  executedActions: string[];
  skippedActions: string[];
  mode: RuleMode;
  actor: 'firewatch' | string;
};

export type UserStrike = {
  id: string;
  subredditId: string;
  username: string;
  reason: string;
  source:
    | 'rule_match'
    | 'comment_removed'
    | 'post_removed'
    | 'manual_mod_action'
    | 'report'
    | 'watched_domain'
    | 'watched_word';
  weight: number;
  relatedPostId?: string;
  relatedCommentId?: string;
  createdAt: string;
  expiresAt?: string;
  createdBy: 'firewatch' | string;
};

export type UserStrikeSummary = {
  username: string;
  totalWeight: number;
  strikeCount: number;
  recentWindowDays: number;
  removedComments: number;
  suspiciousDomainHits: number;
  strikes: UserStrike[];
  preparedAction?: string;
};

export type FirewatchConfig = {
  keywords: string[];
  suspiciousDomains: string[];
  heatThreshold: number;
  fireThreshold: number;
  wildfireThreshold: number;
  reminderText: string;
  actionControls: {
    approveComments: boolean;
    removeComments: boolean;
    banUsers: boolean;
    stickyReminder: boolean;
    lockPost: boolean;
    unlockPost: boolean;
    approvePosts: boolean;
    removePosts: boolean;
    markPostSpam: boolean;
    markPostNsfw: boolean;
    markPostSpoiler: boolean;
    ignoreReports: boolean;
    ignoreCommentReports: boolean;
    crowdControl: boolean;
    setPostFlair: boolean;
    lockComments: boolean;
    markCommentSpam: boolean;
    removeCommentThreads: boolean;
    showComments: boolean;
    approveUsers: boolean;
    muteUsers: boolean;
    addModNotes: boolean;
    removeUserContent: boolean;
    handoffNotes: boolean;
    markHandled: boolean;
  };
  signalWeights: {
    commentVelocity: number;
    reports: number;
    watchedWords: number;
    watchedDomains: number;
    replyPileOns: number;
    repeatedWording: number;
    recentRemovals: number;
    manualSend: number;
  };
};

export type FirewatchDemoScenario = {
  id: FirewatchDemoScenarioId;
  label: string;
  description: string;
};

export type RiskReason = {
  key: string;
  label: string;
  detail: string;
  points: number;
  evidence?: string[];
};

export type FlaggedComment = {
  id: string;
  author: string;
  body: string;
  permalink?: string;
  createdAt: number;
  score: number;
  reasons: string[];
  approved?: boolean;
  ignoringReports?: boolean;
  locked?: boolean;
  numReports?: number;
  removed?: boolean;
  reviewed?: boolean;
  spam?: boolean;
};

export type IncidentAction = {
  id: string;
  type: IncidentActionType;
  actor: string;
  createdAt: number;
  detail: string;
  targetIds?: string[];
  summary?: string;
};

export type IncidentSignal = {
  id: string;
  type: SignalType;
  source: SignalSource;
  createdAt: number;
  postId: string;
  commentId?: string;
  author?: string;
  body?: string;
  parentId?: string;
  reason?: string;
  permalink?: string;
  isDemo?: boolean;
  metadata?: Record<string, string | number | boolean | undefined>;
};

export type IncidentParticipant = {
  username: string;
  signals: number;
  flagged: number;
  lastSeenAt: number;
  branchCount: number;
};

export type RepeatedPhrase = {
  phrase: string;
  count: number;
  authors: string[];
};

export type IncidentStats = {
  signalCount: number;
  commentSignals: number;
  reportSignals: number;
  manualEscalations: number;
  keywordHits: number;
  suspiciousLinkHits: number;
  branchPileOns: number;
  repeatedPhraseHits: number;
  removals: number;
  flaggedCount: number;
  uniqueParticipants: number;
  commentsLastHour: number;
};

export type IncidentImpactSnapshot = {
  reportsGrouped: number;
  commentsReviewed: number;
  commentsAwaitingReview: number;
  usersInReview: number;
  usersHandled: number;
  actionsTaken: number;
  removals: number;
  approvals: number;
  bans: number;
  handoffSaved: boolean;
  finalNoteSaved: boolean;
  timeOpenMinutes: number;
  peakAttention: number;
};

export type IncidentTrendPoint = {
  timestamp: number;
  score: number;
  commentSignals: number;
  reportSignals: number;
  keywordHits: number;
};

export type ResponseSuggestion = {
  label: string;
  detail: string;
  level: IncidentLevel;
  steps: string[];
};

export type Incident = {
  postId: string;
  subredditName: string;
  title: string;
  permalink?: string;
  score: number;
  postAuthor?: string;
  postScore?: number;
  postCommentCount?: number;
  level: IncidentLevel;
  peakScore: number;
  peakLevel: IncidentLevel;
  peakReasons?: RiskReason[];
  peakRepeatedPhrases?: RepeatedPhrase[];
  status: IncidentStatus;
  postState?: IncidentPostState;
  createdAt: number;
  openedAt?: number;
  updatedAt: number;
  resolvedAt?: number;
  claim?: {
    username: string;
    claimedAt: number;
  };
  reasons: RiskReason[];
  flaggedComments: FlaggedComment[];
  recentSignals: IncidentSignal[];
  involvedUsers: IncidentParticipant[];
  repeatedPhrases: RepeatedPhrase[];
  matchedRules?: MatchedAutomationRule[];
  userStrikeSummaries?: UserStrikeSummary[];
  stats: IncidentStats;
  impact: IncidentImpactSnapshot;
  trend: IncidentTrendPoint[];
  responseSuggestion: ResponseSuggestion;
  actions: IncidentAction[];
  summary?: string;
  escalationSummary?: string;
  demo?: {
    scenario: string;
    scenarioId?: FirewatchDemoScenarioId;
    seededAt: number;
  };
};

export type DashboardInitResponse = {
  type: 'dashboard';
  username: string;
  subredditName: string;
  selectedPostId?: string;
  incidents: Incident[];
  config: FirewatchConfig;
  postFlairOptions: PostFlairOption[];
  rules: FirewatchRule[];
  ruleLogs: RuleExecutionLog[];
};

export type ActionResponse = {
  type: 'action';
  incident: Incident;
};

export type ConfigResponse = {
  type: 'config';
  config: FirewatchConfig;
};

export type DemoResetResponse = DashboardInitResponse & {
  resetCount: number;
};

export type AppResetResponse = DashboardInitResponse & {
  deletedKeys: number;
  incidentCount: number;
  userCount: number;
};

export type RulesResponse = {
  type: 'rules';
  rules: FirewatchRule[];
  ruleLogs: RuleExecutionLog[];
};

export type RuleTestResponse = {
  type: 'rule-test';
  ruleId: string;
  ruleName: string;
  matchedCount: number;
  examples: {
    label: string;
    detail: string;
  }[];
  preparedActions: string[];
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
