export type IncidentLevel = 'watch' | 'heat' | 'fire' | 'wildfire';

export type FirewatchDemoScenarioId =
  | 'heated_thread'
  | 'scam_link_cleanup'
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
  | 'post_spoiler'
  | 'post_reports_ignored'
  | 'post_reports_unignored'
  | 'post_crowd_control'
  | 'post_flaired'
  | 'locked'
  | 'escalated'
  | 'resolved'
  | 'demo_seeded';

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
  removed?: boolean;
  reviewed?: boolean;
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
  level: IncidentLevel;
  peakScore: number;
  peakLevel: IncidentLevel;
  status: IncidentStatus;
  createdAt: number;
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

export type ErrorResponse = {
  status: 'error';
  message: string;
};
