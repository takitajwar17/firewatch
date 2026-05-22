export type IncidentLevel = 'watch' | 'heat' | 'fire' | 'wildfire';

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

export type FirewatchConfig = {
  keywords: string[];
  suspiciousDomains: string[];
  heatThreshold: number;
  fireThreshold: number;
  wildfireThreshold: number;
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
  type:
    | 'claimed'
    | 'cool_down'
    | 'cleanup'
    | 'comment_approved'
    | 'comment_removed'
    | 'user_banned'
    | 'locked'
    | 'escalated'
    | 'resolved'
    | 'demo_seeded';
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
  trend: IncidentTrendPoint[];
  responseSuggestion: ResponseSuggestion;
  actions: IncidentAction[];
  summary?: string;
  escalationSummary?: string;
  demo?: {
    scenario: string;
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

export type ErrorResponse = {
  status: 'error';
  message: string;
};
