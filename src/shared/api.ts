export type IncidentLevel = 'watch' | 'heat' | 'fire' | 'wildfire';

export type IncidentStatus = 'active' | 'resolved';

export type SignalType =
  | 'comment_create'
  | 'comment_report'
  | 'post_report'
  | 'manual_escalation'
  | 'mod_action';

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
};

export type IncidentAction = {
  id: string;
  type: 'claimed' | 'cool_down' | 'comment_removed' | 'locked' | 'resolved';
  actor: string;
  createdAt: number;
  detail: string;
};

export type IncidentSignal = {
  id: string;
  type: SignalType;
  createdAt: number;
  postId: string;
  commentId?: string;
  author?: string;
  body?: string;
  parentId?: string;
  reason?: string;
  permalink?: string;
};

export type Incident = {
  postId: string;
  subredditName: string;
  title: string;
  permalink?: string;
  score: number;
  level: IncidentLevel;
  status: IncidentStatus;
  createdAt: number;
  updatedAt: number;
  claim?: {
    username: string;
    claimedAt: number;
  };
  reasons: RiskReason[];
  flaggedComments: FlaggedComment[];
  recentSignals: IncidentSignal[];
  actions: IncidentAction[];
  summary?: string;
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

export type ErrorResponse = {
  status: 'error';
  message: string;
};
