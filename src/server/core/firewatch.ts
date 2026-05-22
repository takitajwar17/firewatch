import { context, redis, reddit } from '@devvit/web/server';
import type {
  FirewatchConfig,
  FlaggedComment,
  Incident,
  IncidentAction,
  IncidentLevel,
  IncidentParticipant,
  IncidentSignal,
  IncidentStats,
  IncidentStatus,
  IncidentTrendPoint,
  RepeatedPhrase,
  ResponseSuggestion,
  RiskReason,
  SignalSource,
} from '../../shared/api';

type T1 = `t1_${string}`;
type T3 = `t3_${string}`;

const DEFAULT_CONFIG: FirewatchConfig = {
  keywords: [
    'brigade',
    'dox',
    'fraud',
    'harass',
    'hate',
    'idiot',
    'kill',
    'racist',
    'report',
    'scam',
    'slur',
    'stupid',
    'threat',
  ],
  suspiciousDomains: ['bit.ly', 'tinyurl.com', 'grabify', 'discord.gg'],
  heatThreshold: 35,
  fireThreshold: 65,
  wildfireThreshold: 85,
};

const INDEX_KEY = 'fw:index';
const MAX_ACTIONS = 30;
const MAX_FLAGGED_COMMENTS = 12;
const MAX_INVOLVED_USERS = 8;
const MAX_REPEATED_PHRASES = 6;
const MAX_RECENT_SIGNALS = 80;
const MAX_TREND_POINTS = 8;
const VELOCITY_BASELINE_COMMENTS = 4;
const INCIDENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TREND_BUCKET_MS = 10 * 60 * 1000;
const COOLDOWN_COMMENT_TEXT =
  'Mod note: Please keep this discussion civil, stay on topic, and follow the community rules. Rule-breaking comments may be removed.';

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'because',
  'been',
  'being',
  'could',
  'from',
  'have',
  'here',
  'into',
  'just',
  'like',
  'more',
  'only',
  'people',
  'really',
  'should',
  'that',
  'their',
  'there',
  'they',
  'this',
  'thread',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'your',
]);

type SignalInput = Omit<IncidentSignal, 'id' | 'createdAt' | 'source'> & {
  createdAt?: number;
  source?: SignalSource;
};

const incidentKey = (postId: string) => `fw:incident:${postId}`;
const configKey = (subredditName: string) => `fw:config:${subredditName}`;
const boardPostKey = (subredditName: string) => `fw:board-post:${subredditName}`;
const claimKey = (postId: string) => `fw:claim:${postId}`;
const selectionKey = (subredditName: string, username: string) =>
  `fw:selected:${subredditName}:${username}`;
const now = () => Date.now();
const retentionExpiration = () => new Date(now() + INCIDENT_RETENTION_MS);
const selectionExpiration = () => new Date(now() + 24 * 60 * 60 * 1000);

const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizePostId = (postId: string): T3 =>
  (postId.startsWith('t3_') ? postId : `t3_${postId}`) as T3;

const normalizeCommentId = (commentId: string): T1 =>
  (commentId.startsWith('t1_') ? commentId : `t1_${commentId}`) as T1;

const normalizeUsername = (username: string | undefined) => {
  const normalized = username?.trim().replace(/^u\//i, '');
  if (!normalized || normalized.startsWith('t2_')) return undefined;
  return normalized;
};

const isAppUsername = (username: string | undefined) =>
  normalizeUsername(username)?.toLowerCase() === context.appSlug.toLowerCase();

const formatUserHandle = (username: string | undefined) => {
  const normalized = normalizeUsername(username);
  return normalized ? `u/${normalized}` : 'unknown user';
};

const inferSignalSource = (signal: {
  author?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  source?: SignalSource;
  type: IncidentSignal['type'];
}): SignalSource => {
  if (signal.source) return signal.source;
  if (signal.metadata?.firewatchNotice || isAppUsername(signal.author)) {
    return 'firewatch_notice';
  }
  if (signal.type === 'comment_report' || signal.type === 'post_report') {
    return 'report';
  }
  if (
    signal.type === 'manual_escalation' ||
    signal.type === 'mod_action' ||
    signal.type === 'automod_filter'
  ) {
    return 'mod_action';
  }
  return 'user';
};

const normalizeSignal = (signal: IncidentSignal): IncidentSignal => ({
  ...signal,
  author: normalizeUsername(signal.author),
  source: inferSignalSource(signal),
});

const normalizeStatus = (status: string | undefined): IncidentStatus => {
  if (status === 'active') return 'open';
  if (status === 'monitoring') return 'cooldown';
  if (status === 'open') return 'open';
  if (status === 'watching') return 'watching';
  if (status === 'review') return 'review';
  if (status === 'claimed') return 'claimed';
  if (status === 'cooldown') return 'cooldown';
  if (status === 'locked') return 'locked';
  if (status === 'handled') return 'handled';
  if (status === 'resolved') return 'resolved';
  return 'open';
};

const deriveIncidentStatus = (
  incident: Incident,
  commentsToReview = 0
): IncidentStatus => {
  const normalized = normalizeStatus(incident.status);
  const locked =
    normalized === 'locked' ||
    incident.actions.some((action) => action.type === 'locked');
  const finalNoteSaved =
    Boolean(incident.summary) ||
    Boolean(incident.resolvedAt) ||
    normalized === 'handled' ||
    normalized === 'resolved' ||
    incident.actions.some((action) => action.type === 'resolved');

  if (locked && commentsToReview > 0) return 'locked';
  if (commentsToReview > 0) return 'review';
  if (finalNoteSaved) {
    return 'handled';
  }
  if (locked) return 'locked';
  return 'watching';
};

const formatLevel = (level: IncidentLevel) =>
  ({
    watch: 'watch',
    heat: 'review',
    fire: 'act',
    wildfire: 'lock likely',
  })[level];

const formatStatus = (status: Incident['status']) =>
  ({
    open: 'open',
    watching: 'watching',
    review: 'review',
    claimed: 'claimed',
    cooldown: 'cooldown',
    locked: 'locked',
    handled: 'handled',
    resolved: 'resolved',
  })[status];

const parseCsv = (value: string | undefined, fallback: string[]) => {
  if (!value) return fallback;

  const parsed = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
};

const normalizeThresholds = (
  heatThreshold: number,
  fireThreshold: number,
  wildfireThreshold: number
) => {
  const heatInput = Number.isFinite(heatThreshold)
    ? heatThreshold
    : DEFAULT_CONFIG.heatThreshold;
  const fireInput = Number.isFinite(fireThreshold)
    ? fireThreshold
    : DEFAULT_CONFIG.fireThreshold;
  const wildfireInput = Number.isFinite(wildfireThreshold)
    ? wildfireThreshold
    : DEFAULT_CONFIG.wildfireThreshold;
  const heat = clamp(heatInput, 1, 98);
  const fire = clamp(fireInput, heat + 1, 99);
  const wildfire = clamp(wildfireInput, fire + 1, 100);

  return {
    heatThreshold: heat,
    fireThreshold: fire,
    wildfireThreshold: wildfire,
  };
};

export const getConfig = async (
  subredditName = context.subredditName
): Promise<FirewatchConfig> => {
  const stored = await redis.get(configKey(subredditName));
  if (!stored) return DEFAULT_CONFIG;

  try {
    const parsed = JSON.parse(stored) as Partial<FirewatchConfig>;
    const thresholds = normalizeThresholds(
      Number(parsed.heatThreshold ?? DEFAULT_CONFIG.heatThreshold),
      Number(parsed.fireThreshold ?? DEFAULT_CONFIG.fireThreshold),
      Number(parsed.wildfireThreshold ?? DEFAULT_CONFIG.wildfireThreshold)
    );

    return {
      keywords: parsed.keywords?.length
        ? parsed.keywords
        : DEFAULT_CONFIG.keywords,
      suspiciousDomains: parsed.suspiciousDomains?.length
        ? parsed.suspiciousDomains
        : DEFAULT_CONFIG.suspiciousDomains,
      ...thresholds,
    };
  } catch (error) {
    console.error('Failed to parse Firewatch config', error);
    return DEFAULT_CONFIG;
  }
};

export const saveConfig = async (values: {
  keywords?: string;
  suspiciousDomains?: string;
  heatThreshold?: number;
  fireThreshold?: number;
  wildfireThreshold?: number;
}) => {
  const current = await getConfig();
  const thresholds = normalizeThresholds(
    Number(values.heatThreshold ?? current.heatThreshold),
    Number(values.fireThreshold ?? current.fireThreshold),
    Number(values.wildfireThreshold ?? current.wildfireThreshold)
  );
  const nextConfig: FirewatchConfig = {
    keywords: parseCsv(values.keywords, current.keywords),
    suspiciousDomains: parseCsv(
      values.suspiciousDomains,
      current.suspiciousDomains
    ),
    ...thresholds,
  };

  await redis.set(configKey(context.subredditName), JSON.stringify(nextConfig));
  return nextConfig;
};

export const getConfigFormDefaults = async () => {
  const config = await getConfig();

  return {
    keywords: config.keywords.join(', '),
    suspiciousDomains: config.suspiciousDomains.join(', '),
    heatThreshold: config.heatThreshold,
    fireThreshold: config.fireThreshold,
    wildfireThreshold: config.wildfireThreshold,
  };
};

const getIndex = async () => {
  const stored = await redis.get(INDEX_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as string[];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
};

const saveIndex = async (postIds: string[]) => {
  await redis.set(
    INDEX_KEY,
    JSON.stringify(Array.from(new Set(postIds.filter(Boolean))).slice(0, 100))
  );
};

const addToIndex = async (postId: string) => {
  const index = await getIndex();
  const nextIndex = [postId, ...index.filter((id) => id !== postId)].slice(
    0,
    100
  );
  await saveIndex(nextIndex);
};

const removeFromIndex = async (postId: string) => {
  const index = await getIndex();
  await saveIndex(index.filter((id) => id !== postId));
};

const getIncident = async (postId: string) => {
  const stored = await redis.get(incidentKey(postId));
  if (!stored) return undefined;

  try {
    return JSON.parse(stored) as Incident;
  } catch (error) {
    console.error(`Failed to parse incident ${postId}`, error);
    return undefined;
  }
};

const shouldShowInQueue = (incident: Incident) =>
  incident.score > 0 ||
  incident.actions.length > 0 ||
  deriveIncidentStatus(incident) !== 'open';

const saveIncident = async (incident: Incident) => {
  await redis.set(incidentKey(incident.postId), JSON.stringify(incident), {
    expiration: retentionExpiration(),
  });
  if (shouldShowInQueue(incident)) {
    await addToIndex(incident.postId);
  } else {
    await removeFromIndex(incident.postId);
  }
};

export const deleteStoredPostContent = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const index = await getIndex();
  await redis.del(incidentKey(normalizedPostId), claimKey(normalizedPostId));
  await saveIndex(index.filter((id) => id !== normalizedPostId));

  if (context.subredditName) {
    const boardPostId = await redis.get(boardPostKey(context.subredditName));
    if (boardPostId === normalizedPostId) {
      await redis.del(boardPostKey(context.subredditName));
    }
  }
};

export const deleteStoredCommentContent = async (
  postId: string,
  commentId: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) return;

  const sanitizedSignals = incident.recentSignals.filter(
    (signal) => signal.commentId !== normalizedCommentId
  );
  const sanitizedActions = incident.actions.map((action) => {
    if (
      !action.targetIds?.includes(normalizedCommentId) &&
      !action.detail.includes(normalizedCommentId)
    ) {
      return action;
    }

    return {
      ...action,
      detail: 'Action referenced a comment that was later deleted on Reddit',
      targetIds: action.targetIds?.filter((id) => id !== normalizedCommentId),
      summary: undefined,
    };
  });
  const sanitizedIncident: Incident = {
    ...incident,
    actions: sanitizedActions,
    escalationSummary: undefined,
    flaggedComments: incident.flaggedComments.filter(
      (comment) => comment.id !== normalizedCommentId
    ),
    involvedUsers: [],
    reasons: [],
    recentSignals: sanitizedSignals,
    repeatedPhrases: [],
    summary: undefined,
    trend: [],
    updatedAt: now(),
  };

  try {
    const refreshed = await refreshIncident(sanitizedIncident);
    await saveIncident(refreshed);
  } catch (error) {
    console.error(`Failed to refresh sanitized incident ${normalizedPostId}`, error);
    await saveIncident(sanitizedIncident);
  }
};

const getPostSnapshot = async (postId: string) => {
  const post = await reddit.getPostById(normalizePostId(postId));

  return {
    title: post.title || 'Untitled post',
    permalink: post.permalink,
    subredditName: post.subredditName,
    numberOfReports: post.numberOfReports,
  };
};

const getLevel = (score: number, config: FirewatchConfig): IncidentLevel => {
  if (score >= config.wildfireThreshold) return 'wildfire';
  if (score >= config.fireThreshold) return 'fire';
  if (score >= config.heatThreshold) return 'heat';
  return 'watch';
};

const countKeywordHits = (text: string, keywords: string[]) => {
  const lowered = text.toLowerCase();
  return keywords.filter((keyword) => lowered.includes(keyword)).length;
};

const countSuspiciousDomainHits = (text: string, domains: string[]) => {
  const lowered = text.toLowerCase();
  return domains.filter((domain) => lowered.includes(domain)).length;
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
    );

const extractRepeatedPhrases = (
  signals: IncidentSignal[]
): RepeatedPhrase[] => {
  const phrases = new Map<
    string,
    {
      count: number;
      authors: Set<string>;
    }
  >();

  for (const signal of signals) {
    if (!signal.body) continue;

    const tokens = tokenize(signal.body);
    if (tokens.length < 2) continue;

    const seenInSignal = new Set<string>();
    const sizes = tokens.length >= 3 ? [3, 2] : [2];

    for (const size of sizes) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const phrase = tokens.slice(index, index + size).join(' ');
        if (seenInSignal.has(phrase)) continue;
        seenInSignal.add(phrase);

        const current = phrases.get(phrase) ?? {
          count: 0,
          authors: new Set<string>(),
        };
        current.count += 1;
        if (signal.author) current.authors.add(signal.author);
        phrases.set(phrase, current);
      }
    }
  }

  return Array.from(phrases.entries())
    .filter(([, value]) => value.count >= 2)
    .map(([phrase, value]) => ({
      phrase,
      count: value.count,
      authors: Array.from(value.authors).slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count || b.authors.length - a.authors.length)
    .slice(0, MAX_REPEATED_PHRASES);
};

const makeEmptyStats = (): IncidentStats => ({
  signalCount: 0,
  commentSignals: 0,
  reportSignals: 0,
  manualEscalations: 0,
  keywordHits: 0,
  suspiciousLinkHits: 0,
  branchPileOns: 0,
  repeatedPhraseHits: 0,
  removals: 0,
  flaggedCount: 0,
  uniqueParticipants: 0,
  commentsLastHour: 0,
});

const getResponseSuggestion = (
  score: number,
  level: IncidentLevel,
  status: IncidentStatus,
  unresolvedCount = 0
): ResponseSuggestion => {
  if (status === 'locked' && unresolvedCount > 0) {
    return {
      label: 'Review remaining comments',
      detail:
        'The post is locked, but comments still need a mod decision before it can be handled.',
      level,
      steps: [
        'Review the remaining unremoved comments.',
        'Remove the comments that break the rules or leave them if they are acceptable.',
        'Mark handled after no comments remain in review.',
      ],
    };
  }

  if (status === 'review') {
    return {
      label:
        unresolvedCount === 1
          ? 'Review 1 comment'
          : `Review ${unresolvedCount} comments`,
      detail:
        unresolvedCount === 1
          ? 'One comment still needs a mod decision before this post can be handled.'
          : `${unresolvedCount} comments still need a mod decision before this post can be handled.`,
      level,
      steps: [
        'Open the Comments tab.',
        'Review or remove the flagged comments.',
        'Mark handled after the review queue is clear.',
      ],
    };
  }

  if (status === 'handled' || status === 'resolved') {
    return {
      label: 'No further action',
      detail:
        'This post has a saved final note and no comments left in review.',
      level,
      steps: [
        'Review the final mod note.',
        'Open the post if you need to check Reddit state.',
        'No further action is needed unless the thread heats up again.',
      ],
    };
  }

  if (status === 'locked') {
    return {
      label: 'Save final note',
      detail:
        'The post is locked and the comment review queue is clear. Save the final mod note to close it out.',
      level,
      steps: [
        'Save a handoff note if another mod may need context.',
        'Review the mod log for actions taken.',
        'Mark handled to generate the final note.',
      ],
    };
  }

  return {
    label: 'Monitor',
    detail: `Current attention is ${score}/100. Keep an eye on reports, comment volume, and repeated user wording.`,
    level,
    steps: [
      'Leave the post open.',
      'Watch new reports and user comments.',
      'Take this post if more reports come in.',
    ],
  };
};

const scoreComment = (
  signal: IncidentSignal,
  config: FirewatchConfig
): FlaggedComment | undefined => {
  if (signal.source === 'firewatch_notice' || signal.source === 'mod_action') {
    return undefined;
  }
  if (!signal.commentId || !signal.body) return undefined;

  const reasons: string[] = [];
  let score = 0;
  const keywordHits = countKeywordHits(signal.body, config.keywords);
  const suspiciousHits = countSuspiciousDomainHits(
    signal.body,
    config.suspiciousDomains
  );

  if (keywordHits > 0) {
    score += keywordHits * 12;
    reasons.push(
      `${keywordHits} watched word match${keywordHits > 1 ? 'es' : ''}`
    );
  }

  if (suspiciousHits > 0) {
    score += suspiciousHits * 10;
    reasons.push(
      `${suspiciousHits} watched domain match${suspiciousHits > 1 ? 'es' : ''}`
    );
  }

  if (signal.type === 'comment_report') {
    score += 20;
    reasons.push(signal.reason ? `reported: ${signal.reason}` : 'reported');
  }

  if (signal.type === 'automod_filter') {
    score += 18;
    reasons.push(
      signal.reason ? `AutoModerator: ${signal.reason}` : 'AutoModerator filter'
    );
  }

  if (score === 0) return undefined;

  return {
    id: signal.commentId,
    author: normalizeUsername(signal.author) ?? 'unknown user',
    body: signal.body.slice(0, 500),
    permalink: signal.permalink,
    createdAt: signal.createdAt,
    score,
    reasons,
  };
};

const buildParticipants = (
  signals: IncidentSignal[],
  flaggedComments: FlaggedComment[]
): IncidentParticipant[] => {
  const flaggedByAuthor = flaggedComments.reduce<Record<string, number>>(
    (counts, comment) => {
      const author = normalizeUsername(comment.author);
      if (!author) return counts;
      counts[author] = (counts[author] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const participants = new Map<
    string,
    {
      signals: number;
      lastSeenAt: number;
      branches: Set<string>;
    }
  >();

  for (const comment of flaggedComments) {
    const author = normalizeUsername(comment.author);
    if (!author) continue;

    const current = participants.get(author) ?? {
      signals: 0,
      lastSeenAt: 0,
      branches: new Set<string>(),
    };
    current.lastSeenAt = Math.max(current.lastSeenAt, comment.createdAt);
    participants.set(author, current);
  }

  for (const signal of signals) {
    const author = normalizeUsername(signal.author);
    if (!author || isAppUsername(author)) continue;

    const current = participants.get(author) ?? {
      signals: 0,
      lastSeenAt: 0,
      branches: new Set<string>(),
    };
    current.signals += 1;
    current.lastSeenAt = Math.max(current.lastSeenAt, signal.createdAt);
    if (signal.parentId) current.branches.add(signal.parentId);
    participants.set(author, current);
  }

  return Array.from(participants.entries())
    .map(([username, value]) => ({
      username,
      signals: value.signals,
      flagged: flaggedByAuthor[username] ?? 0,
      lastSeenAt: value.lastSeenAt,
      branchCount: value.branches.size,
    }))
    .sort(
      (a, b) =>
        b.flagged - a.flagged ||
        b.signals - a.signals ||
        b.lastSeenAt - a.lastSeenAt
    )
    .slice(0, MAX_INVOLVED_USERS);
};

const buildTrend = (
  signals: IncidentSignal[],
  config: FirewatchConfig
): IncidentTrendPoint[] => {
  const buckets = new Map<
    number,
    {
      commentSignals: number;
      reportSignals: number;
      keywordHits: number;
    }
  >();

  for (const signal of signals) {
    const timestamp =
      Math.floor(signal.createdAt / TREND_BUCKET_MS) * TREND_BUCKET_MS;
    const current = buckets.get(timestamp) ?? {
      commentSignals: 0,
      reportSignals: 0,
      keywordHits: 0,
    };

    if (signal.type === 'comment_create') current.commentSignals += 1;
    if (signal.type === 'comment_report' || signal.type === 'post_report') {
      current.reportSignals += 1;
    }
    current.keywordHits += countKeywordHits(signal.body ?? '', config.keywords);
    buckets.set(timestamp, current);
  }

  return Array.from(buckets.entries())
    .sort(([timestampA], [timestampB]) => timestampA - timestampB)
    .slice(-MAX_TREND_POINTS)
    .map(([timestamp, value]) => ({
      timestamp,
      ...value,
      score: clamp(
        value.commentSignals * 3 +
          value.reportSignals * 15 +
          value.keywordHits * 8,
        0,
        100
      ),
    }));
};

const calculateIncident = (
  incident: Incident,
  config: FirewatchConfig,
  postSnapshot: Awaited<ReturnType<typeof getPostSnapshot>>
): Incident => {
  const oneHourAgo = now() - 60 * 60 * 1000;
  const normalizedSignals = incident.recentSignals.map(normalizeSignal);
  const recentSignals = normalizedSignals.filter(
    (signal) => signal.createdAt >= oneHourAgo
  );
  const removedCommentIds = new Set<string>(
    [
      ...incident.flaggedComments
        .filter((comment) => comment.removed)
        .map((comment) => comment.id),
      ...incident.actions.flatMap((action) =>
        action.type === 'cleanup' ? (action.targetIds ?? []) : []
      ),
      ...normalizedSignals
        .filter(
          (signal) =>
            signal.commentId &&
            ((signal.type === 'mod_action' &&
              (signal.metadata?.action === 'removecomment' ||
                signal.metadata?.action === 'spamcomment')) ||
              signal.type === 'automod_filter')
        )
        .map((signal) => signal.commentId ?? ''),
    ]
      .filter(Boolean)
      .map(normalizeCommentId)
  );
  const userSignals = recentSignals.filter((signal) => signal.source === 'user');
  const activeUserSignals = userSignals.filter(
    (signal) => !signal.commentId || !removedCommentIds.has(signal.commentId)
  );
  const scoreSignals = recentSignals.filter(
    (signal) =>
      (signal.source === 'user' || signal.source === 'report') &&
      (!signal.commentId || !removedCommentIds.has(signal.commentId))
  );
  const visibleSignals = recentSignals.filter(
    (signal) => signal.source !== 'firewatch_notice'
  );
  const recentComments = activeUserSignals.filter(
    (signal) => signal.type === 'comment_create'
  );
  const reports = scoreSignals.filter(
    (signal) => signal.type === 'comment_report' || signal.type === 'post_report'
  );
  const commentReports = scoreSignals.filter(
    (signal) => signal.type === 'comment_report'
  );
  const postReportSignals = scoreSignals.filter(
    (signal) => signal.type === 'post_report'
  );
  const postReportCount = Math.max(
    postSnapshot.numberOfReports,
    postReportSignals.length
  );
  const totalReportCount = commentReports.length + postReportCount;
  const manualEscalations = recentSignals.filter(
    (signal) => signal.type === 'manual_escalation'
  );
  const externalRemovalActions = recentSignals.filter(
    (signal) =>
      (signal.type === 'mod_action' &&
        (signal.metadata?.action === 'removecomment' ||
          signal.metadata?.action === 'spamcomment' ||
          signal.metadata?.action === 'removelink' ||
          signal.metadata?.action === 'spamlink')) ||
      signal.type === 'automod_filter'
  );
  const repeatedPhrases = extractRepeatedPhrases(activeUserSignals);
  const repeatedPhraseHits = repeatedPhrases.reduce(
    (total, phrase) => total + phrase.count,
    0
  );
  const keywordHits = scoreSignals.reduce(
    (total, signal) => total + countKeywordHits(signal.body ?? '', config.keywords),
    0
  );
  const suspiciousHits = scoreSignals.reduce(
    (total, signal) =>
      total + countSuspiciousDomainHits(signal.body ?? '', config.suspiciousDomains),
    0
  );
  const parentAuthors = activeUserSignals.reduce<Record<string, Set<string>>>(
    (counts, signal) => {
      const author = normalizeUsername(signal.author);
      if (signal.parentId && author) {
        const authors = counts[signal.parentId] ?? new Set<string>();
        authors.add(author);
        counts[signal.parentId] = authors;
      }
      return counts;
    },
    {}
  );
  const branchPileOnCount = Object.values(parentAuthors).filter(
    (authors) => authors.size >= 3
  ).length;
  const removalsLastHour = incident.actions.reduce((total, action) => {
    if (action.createdAt < oneHourAgo) return total;
    if (action.type === 'comment_removed') return total + 1;
    if (action.type === 'cleanup') return total + (action.targetIds?.length ?? 1);
    return total;
  }, 0);
  const reasons: RiskReason[] = [];
  const velocityOverflow = Math.max(
    0,
    recentComments.length - VELOCITY_BASELINE_COMMENTS
  );
  const velocityPoints = clamp(velocityOverflow * 6, 0, 30);
  const reportPoints = clamp(totalReportCount * 15, 0, 35);
  const keywordPoints = clamp(keywordHits * 8, 0, 25);
  const suspiciousPoints = clamp(suspiciousHits * 10, 0, 20);
  const pileOnPoints = clamp(branchPileOnCount * 15, 0, 20);
  const phrasePoints = clamp(repeatedPhraseHits * 5, 0, 20);
  const removalSignalCount = removalsLastHour + externalRemovalActions.length;
  const removalPoints = clamp(removalSignalCount * 8, 0, 20);
  const manualPoints = manualEscalations.length > 0 ? 25 : 0;

  if (velocityPoints > 0) {
    reasons.push({
      key: 'velocity',
      label: 'New comments',
      detail: `${recentComments.length} new comments in the last hour`,
      points: velocityPoints,
      evidence: recentComments
        .slice(0, 3)
        .map((signal) => normalizeUsername(signal.author))
        .filter((author): author is string => Boolean(author)),
    });
  }

  if (reportPoints > 0) {
    reasons.push({
      key: 'reports',
      label: 'Reports',
      detail: `${commentReports.length} comment reports plus ${postReportCount} post reports`,
      points: reportPoints,
      evidence: reports
        .slice(0, 3)
        .map((signal) => signal.reason ?? 'Report'),
    });
  }

  if (keywordPoints > 0) {
    reasons.push({
      key: 'keywords',
      label: 'Watched words',
      detail: `${keywordHits} watched word match${keywordHits > 1 ? 'es' : ''}`,
      points: keywordPoints,
      evidence: config.keywords
        .filter((keyword) =>
          scoreSignals.some((signal) =>
            (signal.body ?? '').toLowerCase().includes(keyword)
          )
        )
        .slice(0, 5),
    });
  }

  if (suspiciousPoints > 0) {
    reasons.push({
      key: 'links',
      label: 'Watched domains',
      detail: `${suspiciousHits} watched domain match${suspiciousHits > 1 ? 'es' : ''}`,
      points: suspiciousPoints,
      evidence: config.suspiciousDomains
        .filter((domain) =>
          scoreSignals.some((signal) =>
            (signal.body ?? '').toLowerCase().includes(domain)
          )
        )
        .slice(0, 5),
    });
  }

  if (pileOnPoints > 0) {
    reasons.push({
      key: 'pile-on',
      label: 'Reply pile-on',
      detail: `${branchPileOnCount} clustered reply branch${
        branchPileOnCount > 1 ? 'es' : ''
      }`,
      points: pileOnPoints,
      evidence: Object.entries(parentAuthors)
        .filter(([, authors]) => authors.size >= 3)
        .slice(0, 3)
        .map(([, authors]) => `${authors.size} users in one branch`),
    });
  }

  if (phrasePoints > 0) {
    reasons.push({
      key: 'phrases',
      label: 'Repeated wording',
      detail: `${repeatedPhrases.length} repeated phrase${
        repeatedPhrases.length === 1 ? '' : 's'
      }`,
      points: phrasePoints,
      evidence: repeatedPhrases.map((phrase) => phrase.phrase),
    });
  }

  if (removalPoints > 0) {
    reasons.push({
      key: 'removals',
      label: 'Recent removals',
      detail: `${removalSignalCount} removals recorded in the last hour`,
      points: removalPoints,
    });
  }

  if (manualPoints > 0) {
    reasons.push({
      key: 'manual',
      label: 'Sent by mod',
      detail: 'A mod sent this post to Firewatch',
      points: manualPoints,
      evidence: manualEscalations.map(
        (signal) => signal.reason ?? 'Sent by mod'
      ),
    });
  }

  const score = clamp(
    velocityPoints +
      reportPoints +
      keywordPoints +
      suspiciousPoints +
      pileOnPoints +
      phrasePoints +
      removalPoints +
      manualPoints,
    0,
    100
  );
  const flaggedById = new Map<string, FlaggedComment>();

  for (const signal of normalizedSignals) {
    if (signal.commentId && removedCommentIds.has(signal.commentId)) continue;
    const flagged = scoreComment(signal, config);
    if (!flagged) continue;

    const existing = flaggedById.get(flagged.id);
    if (!existing || existing.score < flagged.score) {
      flaggedById.set(flagged.id, flagged);
    }
  }

  const activeFlaggedComments = Array.from(flaggedById.values())
    .map((comment) => ({
      ...comment,
      author: normalizeUsername(comment.author) ?? 'unknown user',
      removed: false,
    }))
    .sort((a, b) => b.score - a.score);
  const alreadyActionedComments = incident.flaggedComments
    .filter(
      (comment) => comment.removed || removedCommentIds.has(normalizeCommentId(comment.id))
    )
    .map((comment) => ({
      ...comment,
      author: normalizeUsername(comment.author) ?? 'unknown user',
      removed: true,
    }));
  const actionedIds = new Set(activeFlaggedComments.map((comment) => comment.id));
  const flaggedComments = [
    ...activeFlaggedComments,
    ...alreadyActionedComments.filter((comment) => !actionedIds.has(comment.id)),
  ].slice(0, MAX_FLAGGED_COMMENTS);
  const level = getLevel(score, config);
  const peakScore = Math.max(incident.peakScore ?? 0, score);
  const peakLevel = getLevel(peakScore, config);
  const status = deriveIncidentStatus(incident, activeFlaggedComments.length);
  const involvedUsers = buildParticipants(userSignals, activeFlaggedComments);
  const usersInReview = new Set(
    activeFlaggedComments
      .map((comment) => normalizeUsername(comment.author))
      .filter((author): author is string => Boolean(author))
  );
  const stats: IncidentStats = {
    ...makeEmptyStats(),
    signalCount: visibleSignals.length,
    commentSignals: recentComments.length,
    reportSignals: totalReportCount,
    manualEscalations: manualEscalations.length,
    keywordHits,
    suspiciousLinkHits: suspiciousHits,
    branchPileOns: branchPileOnCount,
    repeatedPhraseHits,
    removals:
      externalRemovalActions.length +
      incident.actions.reduce((total, action) => {
        if (action.type === 'comment_removed') return total + 1;
        if (action.type === 'cleanup') {
          return total + (action.targetIds?.length ?? 1);
        }
        return total;
      }, 0),
    flaggedCount: activeFlaggedComments.length,
    uniqueParticipants: usersInReview.size,
    commentsLastHour: recentComments.length,
  };

  return {
    ...incident,
    title: postSnapshot.title,
    permalink: postSnapshot.permalink,
    subredditName: postSnapshot.subredditName,
    score,
    level,
    peakScore,
    peakLevel,
    status,
    reasons: reasons.sort((a, b) => b.points - a.points),
    flaggedComments,
    involvedUsers,
    repeatedPhrases,
    stats,
    trend: buildTrend(scoreSignals, config),
    recentSignals: normalizedSignals.slice(0, MAX_RECENT_SIGNALS),
    responseSuggestion: getResponseSuggestion(
      score,
      level,
      status,
      activeFlaggedComments.length
    ),
    updatedAt: now(),
  };
};

const refreshIncident = async (incident: Incident) => {
  const postSnapshot = await getPostSnapshot(incident.postId);
  const config = await getConfig(postSnapshot.subredditName);
  return calculateIncident(incident, config, postSnapshot);
};

export const upsertIncidentSignal = async (input: SignalInput) => {
  const postId = normalizePostId(input.postId);
  const commentId = input.commentId
    ? normalizeCommentId(input.commentId)
    : undefined;
  const parentId =
    input.parentId && input.parentId.startsWith('t1_')
      ? normalizeCommentId(input.parentId)
      : input.parentId
        ? normalizePostId(input.parentId)
        : undefined;
  const postSnapshot = await getPostSnapshot(postId);
  const existing = await getIncident(postId);
  const signal: IncidentSignal = {
    ...input,
    postId,
    commentId,
    parentId,
    author: normalizeUsername(input.author),
    source: inferSignalSource(input),
    id: makeId('sig'),
    createdAt: input.createdAt ?? now(),
  };
  const baseIncident: Incident =
    existing ??
    {
      postId,
      subredditName: postSnapshot.subredditName,
      title: postSnapshot.title,
      permalink: postSnapshot.permalink,
      score: 0,
      level: 'watch',
      peakScore: 0,
      peakLevel: 'watch',
      status: 'open',
      createdAt: now(),
      updatedAt: now(),
      reasons: [],
      flaggedComments: [],
      recentSignals: [],
      involvedUsers: [],
      repeatedPhrases: [],
      stats: makeEmptyStats(),
      trend: [],
      responseSuggestion: getResponseSuggestion(0, 'watch', 'open'),
      actions: [],
    };
  const nextStatus =
    signal.type === 'manual_escalation' ||
    baseIncident.status === 'resolved' ||
    baseIncident.status === 'handled'
      ? 'open'
      : normalizeStatus(baseIncident.status);
  const nextIncident = calculateIncident(
    {
      ...baseIncident,
      status: nextStatus,
      resolvedAt: undefined,
      recentSignals: [signal, ...baseIncident.recentSignals].slice(
        0,
        MAX_RECENT_SIGNALS
      ),
    },
    await getConfig(postSnapshot.subredditName),
    postSnapshot
  );

  await saveIncident(nextIncident);
  return nextIncident;
};

export const getIncidents = async () => {
  const index = await getIndex();
  const incidents = (
    await Promise.all(
      index.map(async (postId) => {
        const incident = await getIncident(postId);
        if (!incident) return undefined;

        try {
          const refreshed = await refreshIncident(incident);
          await saveIncident(refreshed);
          return refreshed;
        } catch (error) {
          console.error(`Failed to refresh incident ${postId}`, error);
          return incident;
        }
      })
    )
  ).filter((incident): incident is Incident => Boolean(incident));
  const visibleIncidents = incidents.filter(shouldShowInQueue);
  await saveIndex(visibleIncidents.map((incident) => incident.postId));

  return visibleIncidents
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, 25);
};

export const getIncidentById = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) return undefined;

  try {
    const refreshed = await refreshIncident(incident);
    await saveIncident(refreshed);
    return refreshed;
  } catch (error) {
    console.error(`Failed to refresh incident ${normalizedPostId}`, error);
    return incident;
  }
};

const appendAction = async (
  postId: string,
  action: Omit<IncidentAction, 'id' | 'createdAt'>
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const nextIncident: Incident = {
    ...incident,
    updatedAt: now(),
    actions: [
      {
        ...action,
        id: makeId('act'),
        createdAt: now(),
      },
      ...incident.actions,
    ].slice(0, MAX_ACTIONS),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const currentUsername = async () =>
  context.username ?? (await reddit.getCurrentUsername()) ?? undefined;

const actorName = async () => (await currentUsername()) ?? 'mod';

export const rememberSelectedIncident = async (postId: string) => {
  const username = await currentUsername();
  if (!username) return;

  await redis.set(
    selectionKey(context.subredditName, username),
    normalizePostId(postId),
    {
      expiration: selectionExpiration(),
    }
  );
};

export const getRememberedIncidentPostId = async (username?: string) => {
  const resolvedUsername = username ?? (await currentUsername());
  if (!resolvedUsername) return undefined;

  const postId = await redis.get(
    selectionKey(context.subredditName, resolvedUsername)
  );

  return postId ? normalizePostId(postId) : undefined;
};

export const claimIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const claimedAt = now();
  const existingClaim = incident.claim ?? {
    username: actor,
    claimedAt,
  };

  if (incident.claim) {
    await redis.set(claimKey(normalizedPostId), JSON.stringify(incident.claim), {
      expiration: retentionExpiration(),
      nx: true,
    });
  }

  const claimValue = JSON.stringify(existingClaim);
  const createdClaim = incident.claim
    ? undefined
    : await redis.set(claimKey(normalizedPostId), claimValue, {
        expiration: retentionExpiration(),
        nx: true,
      });
  const storedClaim = createdClaim
    ? existingClaim
    : JSON.parse((await redis.get(claimKey(normalizedPostId))) ?? claimValue) as {
        username: string;
        claimedAt: number;
      };
  const claimed: Incident = {
    ...incident,
    claim: storedClaim,
    updatedAt: now(),
  };

  await saveIncident(claimed);
  return appendAction(normalizedPostId, {
    type: 'claimed',
    actor,
    detail: storedClaim.username !== actor
      ? `Already taken by u/${storedClaim.username}`
      : `Taken by u/${actor}`,
  });
};

export const coolDownIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  const comment = await post.addComment({
    text: COOLDOWN_COMMENT_TEXT,
  });
  await comment.distinguish(true);

  await upsertIncidentSignal({
    type: 'comment_create',
    source: 'firewatch_notice',
    postId: normalizedPostId,
    commentId: comment.id,
    author: context.appSlug,
    body: COOLDOWN_COMMENT_TEXT,
    createdAt: now(),
    metadata: {
      firewatchNotice: true,
    },
  });

  return appendAction(normalizedPostId, {
    type: 'cool_down',
    actor,
    detail: `Added sticky mod reminder ${comment.id}`,
  });
};

export const lockIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  await post.lock();

  return appendAction(normalizedPostId, {
    type: 'locked',
    actor,
    detail: 'Locked post',
  });
};

const isDemoComment = (incident: Incident, commentId: string) =>
  normalizeCommentId(commentId).startsWith('t1_fw_demo_') ||
  incident.recentSignals.some(
    (signal) =>
      signal.commentId === normalizeCommentId(commentId) && signal.isDemo
  );

const trimRemovalNote = (reason: string | undefined) => {
  const trimmed = reason?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 100);
};

const removeCommentIfReal = async (
  incident: Incident,
  commentId: string,
  reason?: string
) => {
  const normalizedCommentId = normalizeCommentId(commentId);
  if (isDemoComment(incident, normalizedCommentId)) return false;

  const comment = await reddit.getCommentById(normalizedCommentId);
  await comment.remove(false);
  const modNote = trimRemovalNote(reason);
  if (modNote) {
    await comment.addRemovalNote({
      reasonId: '',
      modNote,
    });
  }

  return true;
};

export const removeFlaggedComment = async (
  postId: string,
  commentId: string,
  reason?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedCommentId = normalizeCommentId(commentId);
  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const removedOnReddit = await removeCommentIfReal(
    sourceIncident,
    normalizedCommentId,
    reason
  );
  const incident = await appendAction(normalizedPostId, {
    type: 'comment_removed',
    actor,
    detail: removedOnReddit
      ? `Removed comment ${normalizedCommentId}${reason ? `: ${reason}` : ''}`
      : `Marked demo comment ${normalizedCommentId} removed`,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      flaggedComment.id === normalizedCommentId
        ? { ...flaggedComment, removed: true }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

export const cleanUpIncident = async (
  postId: string,
  commentIds: string[],
  reason?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const sourceIncident = await getIncident(normalizedPostId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');

  const selectedIds = Array.from(
    new Set(commentIds.map(normalizeCommentId))
  ).filter((commentId) =>
    sourceIncident.flaggedComments.some(
      (comment) => comment.id === commentId && !comment.removed
    )
  );
  const targetIds =
    selectedIds.length > 0
      ? selectedIds
      : sourceIncident.flaggedComments
          .filter((comment) => !comment.removed)
          .slice(0, 3)
          .map((comment) => comment.id);

  if (targetIds.length === 0) {
    throw new Error('No removable comments selected');
  }

  const removalResults = await Promise.all(
    targetIds.map((commentId) =>
      removeCommentIfReal(sourceIncident, commentId, reason)
    )
  );
  const redditRemovalCount = removalResults.filter(Boolean).length;
  const demoRemovalCount = targetIds.length - redditRemovalCount;
  const cleanupDetail =
    demoRemovalCount === 0
      ? `Removed ${targetIds.length} comment${
          targetIds.length === 1 ? '' : 's'
        }${reason ? `: ${reason}` : ''}`
      : redditRemovalCount === 0
        ? `Marked ${demoRemovalCount} demo comment${
            demoRemovalCount === 1 ? '' : 's'
          } removed`
        : `Removed ${redditRemovalCount} comment${
            redditRemovalCount === 1 ? '' : 's'
          } and marked ${demoRemovalCount} demo comment${
            demoRemovalCount === 1 ? '' : 's'
          } removed`;

  const actor = await actorName();
  const incident = await appendAction(normalizedPostId, {
    type: 'cleanup',
    actor,
    detail: cleanupDetail,
    targetIds,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      targetIds.includes(flaggedComment.id)
        ? { ...flaggedComment, removed: true }
        : flaggedComment
    ),
  };
  const refreshedIncident = await refreshIncident(nextIncident);

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const buildSummary = (incident: Incident) => {
  const handler =
    incident.claim?.username ??
    incident.actions.find((action) => action.type === 'claimed')?.actor;
  const topReasons = incident.reasons
    .slice(0, 3)
    .map((reason) => `${reason.label} (+${reason.points})`)
    .join(', ');
  const commonPhrases = incident.repeatedPhrases
    .slice(0, 3)
    .map((phrase) => `"${phrase.phrase}" x${phrase.count}`)
    .join(', ');
  const involvedUsers = incident.involvedUsers
    .slice(0, 5)
    .map((user) => formatUserHandle(user.username))
    .join(', ');
  const actionLines = incident.actions
    .slice(0, 5)
    .map((action) => `- ${action.detail}`)
    .join('\n');
  const resolutionTime =
    incident.resolvedAt && incident.createdAt
      ? `${Math.max(1, Math.round((incident.resolvedAt - incident.createdAt) / 60000))}m`
      : 'unresolved';

  return [
    `Final mod note for ${incident.title}`,
    `Started at: ${new Date(incident.createdAt).toISOString()}`,
    `Peak incident score: ${incident.peakScore}/100 (${formatLevel(incident.peakLevel)})`,
    `Final status: ${formatStatus(incident.status)}`,
    `Time open: ${resolutionTime}`,
    `Why this needed review: ${topReasons || 'No active review reasons'}`,
    `Comments reviewed: ${incident.flaggedComments.length}`,
    `Handled by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
    `Users in post: ${involvedUsers || 'none detected'}`,
    `Repeated wording: ${commonPhrases || 'none detected'}`,
    'Recent actions:',
    actionLines || '- No mod actions yet',
  ].join('\n');
};

const buildEscalationSummary = (incident: Incident) => {
  const handler =
    incident.claim?.username ??
    incident.actions.find((action) => action.type === 'claimed')?.actor;
  const unresolved = incident.flaggedComments.filter((comment) => !comment.removed);
  const topReasons = incident.reasons
    .slice(0, 4)
    .map((reason) => `${reason.label}: ${reason.detail}`)
    .join('\n');
  const topComments = unresolved
    .slice(0, 5)
    .map(
      (comment) =>
        `- ${formatUserHandle(comment.author)} (${comment.score}): ${comment.body.slice(0, 180)}`
    )
    .join('\n');

  return [
    `Mod handoff note: ${incident.title}`,
    `Current attention: ${incident.score}/100 (${formatLevel(incident.level)}); peak incident score: ${incident.peakScore}/100; suggested action: ${incident.responseSuggestion.label}`,
    `Post: ${incident.permalink ?? incident.postId}`,
    `Handled by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
    'Why this is here:',
    topReasons || '- No active reasons recorded',
    'Comments to review:',
    topComments || '- No unresolved comments',
  ].join('\n');
};

export const escalateIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const escalationSummary = buildEscalationSummary(incident);
  const withAction = await appendAction(normalizedPostId, {
    type: 'escalated',
    actor,
    detail: 'Saved handoff note for the mod team',
    summary: escalationSummary,
  });
  const nextIncident: Incident = {
    ...withAction,
    escalationSummary,
    updatedAt: now(),
  };

  await saveIncident(nextIncident);
  return nextIncident;
};

export const resolveIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const resolvedAt = now();
  const resolved: Incident = {
    ...incident,
    status: 'handled',
    resolvedAt,
    updatedAt: resolvedAt,
    actions: [
      {
        id: makeId('act'),
        type: 'resolved' as const,
        actor,
        createdAt: now(),
        detail: 'Marked post handled',
      },
      ...incident.actions,
    ].slice(0, MAX_ACTIONS),
  };
  const summary = buildSummary(resolved);
  const refreshedIncident = await refreshIncident({
    ...resolved,
    summary,
  });

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

const pick = <T>(items: T[], index: number, fallback: T) =>
  items.length > 0 ? items[index % items.length] : fallback;

const demoKeyword = (config: FirewatchConfig) =>
  config.keywords.find(
    (keyword) => !['kill', 'slur', 'hate'].includes(keyword.toLowerCase())
  ) ?? 'brigade';

export const createDemoIncident = async () => {
  const config = await getConfig();
  const seed = now();
  const keyword = demoKeyword(config);
  const secondKeyword = pick(config.keywords, 4, 'report');
  const suspiciousDomain = pick(config.suspiciousDomains, 0, 'bit.ly');
  const scenario = `rapid replies, reports, ${keyword} mentions, watched domains, and repeated wording`;
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title: `[Firewatch demo] Mod queue drill ${new Date(seed).toLocaleTimeString()}`,
    text: [
      'This is a Firewatch demo post generated by the app.',
      'The mod queue is populated through the same path used by comments, reports, and posts sent by mods.',
      'Mods can test taking the post, adding a sticky reminder, removing comments, locking the post, saving a handoff note, and marking it handled without waiting for real reports.',
    ].join('\n\n'),
  });
  const authors = [
    'demoScout',
    'demoRegular',
    'demoNewcomer',
    'demoWatcher',
    'demoHelper',
    'demoConcerned',
  ];
  const repeatedPhrase = 'mods are hiding evidence';
  const branchParentId = `t1_fw_demo_branch_${seed.toString(36)}`;
  const bodies = [
    `This suddenly looks like a ${keyword} from outside the community. ${repeatedPhrase}.`,
    `I keep seeing the same claim. ${repeatedPhrase} and nobody is answering.`,
    `Please check this ${suspiciousDomain}/post before it spreads further.`,
    `The argument is looping now. ${repeatedPhrase}.`,
    `This feels like a ${secondKeyword} issue and the replies are getting personal.`,
    `Several new accounts are repeating the same line in this branch.`,
    `I reported the suspicious link and the ${keyword} comments.`,
    `Can a mod step in before everyone piles onto the same user?`,
  ];
  for (const [index, body] of bodies.entries()) {
    const createdAt = seed - (bodies.length - index) * 4 * 60 * 1000;
    const commentId = `t1_fw_demo_${seed.toString(36)}_${index}`;
    await upsertIncidentSignal({
      type: 'comment_create',
      source: 'user',
      postId: post.id,
      commentId,
      author: authors[index % authors.length],
      body,
      parentId: index < 6 ? branchParentId : post.id,
      createdAt,
      isDemo: true,
      metadata: {
        scenario,
        generatedIndex: index,
      },
    });

    if ([1, 2, 6].includes(index)) {
      await upsertIncidentSignal({
        type: 'comment_report',
        source: 'report',
        postId: post.id,
        commentId,
        author: authors[index % authors.length],
        body,
        parentId: index < 6 ? branchParentId : post.id,
        reason: index === 2 ? 'Suspicious link' : 'Personal attacks',
        createdAt: createdAt + 60 * 1000,
        isDemo: true,
        metadata: {
          scenario,
          generatedIndex: index,
        },
      });
    }
  }

  await upsertIncidentSignal({
    type: 'post_report',
    source: 'report',
    postId: post.id,
    body: `${post.title}\nDemo report: repeated wording and watched domains`,
    reason: 'Post needs mod review',
    createdAt: seed - 2 * 60 * 1000,
    isDemo: true,
    metadata: {
      scenario,
    },
  });
  const incident = await upsertIncidentSignal({
    type: 'manual_escalation',
    source: 'mod_action',
    postId: post.id,
    reason: 'Demo post sent for moderator review',
    createdAt: seed,
    isDemo: true,
    metadata: {
      scenario,
    },
  });

  const actor = await actorName();
  const withAction = await appendAction(incident.postId, {
    type: 'demo_seeded',
    actor,
    detail: `Created demo post with ${bodies.length} comment events and 4 report/manual events`,
  });
  const demoIncident: Incident = {
    ...withAction,
    demo: {
      scenario,
      seededAt: seed,
    },
  };

  await saveIncident(demoIncident);
  return demoIncident;
};

export const createFirewatchPost = async (options?: {
  incidentPostId?: string;
}) => {
  const normalizedIncidentPostId = options?.incidentPostId
    ? normalizePostId(options.incidentPostId)
    : undefined;
  const sourcePost = normalizedIncidentPostId
    ? await getPostSnapshot(normalizedIncidentPostId)
    : undefined;

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: sourcePost
      ? `Firewatch review: ${sourcePost.title.slice(0, 220)}`
      : 'Firewatch mod queue',
    entry: 'dashboard',
    postData: normalizedIncidentPostId
      ? {
          incidentPostId: normalizedIncidentPostId,
        }
      : {
          board: true,
        },
    textFallback: {
      text: sourcePost
        ? `Firewatch mod view for ${sourcePost.title}`
        : 'Firewatch mod queue for this community.',
    },
  });

  if (!options?.incidentPostId) {
    await redis.set(boardPostKey(context.subredditName), post.id);
  }

  return post;
};

export const getOrCreateFirewatchBoardPost = async () => {
  const storedPostId = await redis.get(boardPostKey(context.subredditName));

  if (storedPostId) {
    try {
      return await reddit.getPostById(storedPostId as T3);
    } catch (error) {
      console.error(`Stored Firewatch queue post could not be opened: ${error}`);
    }
  }

  return await createFirewatchPost();
};
