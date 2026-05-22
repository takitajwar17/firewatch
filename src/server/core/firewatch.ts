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
  IncidentTrendPoint,
  RepeatedPhrase,
  ResponseSuggestion,
  RiskReason,
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
const TREND_BUCKET_MS = 10 * 60 * 1000;

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

type SignalInput = Omit<IncidentSignal, 'id' | 'createdAt'> & {
  createdAt?: number;
};

const incidentKey = (postId: string) => `fw:incident:${postId}`;
const configKey = (subredditName: string) => `fw:config:${subredditName}`;
const boardPostKey = (subredditName: string) => `fw:board-post:${subredditName}`;
const claimKey = (postId: string) => `fw:claim:${postId}`;
const now = () => Date.now();

const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizePostId = (postId: string): T3 =>
  (postId.startsWith('t3_') ? postId : `t3_${postId}`) as T3;

const normalizeCommentId = (commentId: string): T1 =>
  (commentId.startsWith('t1_') ? commentId : `t1_${commentId}`) as T1;

const formatLevel = (level: IncidentLevel) =>
  ({
    watch: 'watch',
    heat: 'review',
    fire: 'act',
    wildfire: 'lock likely',
  })[level];

const formatStatus = (status: Incident['status']) =>
  ({
    active: 'open',
    monitoring: 'watching',
    resolved: 'handled',
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

const saveIncident = async (incident: Incident) => {
  await redis.set(incidentKey(incident.postId), JSON.stringify(incident));
  await addToIndex(incident.postId);
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

  const sanitizedSignals = incident.recentSignals.map((signal) =>
    signal.commentId === normalizedCommentId
      ? {
          ...signal,
          author: undefined,
          body: undefined,
          permalink: undefined,
          reason: undefined,
          metadata: undefined,
        }
      : signal
  );
  const sanitizedIncident: Incident = {
    ...incident,
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
  level: IncidentLevel
): ResponseSuggestion => {
  if (level === 'wildfire') {
    return {
      label: 'Lock post',
      detail: 'Reports and activity are high enough that mods may want to stop new comments.',
      level,
      steps: [
        'Lock the post with a clear mod note.',
        'Remove the comments that break the rules.',
        'Mark handled to save a final note for the mod team.',
      ],
    };
  }

  if (level === 'fire') {
    return {
      label: 'Remove comments',
      detail: 'The review score is high. Remove rule-breaking comments before the argument spreads.',
      level,
      steps: [
        'Take this post so other mods know someone is handling it.',
        'Remove the selected comments.',
        'Add a sticky reminder if the post stays open.',
      ],
    };
  }

  if (level === 'heat') {
    return {
      label: 'Sticky reminder',
      detail: 'The post can probably stay open if mods leave a visible reminder.',
      level,
      steps: [
        'Add a distinguished sticky comment.',
        'Watch new reports, repeated wording, and reply piles.',
        'Save a handoff note if the post keeps getting reports.',
      ],
    };
  }

  return {
    label: 'Watch',
    detail: `Review score is ${score}/100. Keep an eye on reports, comment volume, and repeated wording.`,
    level,
    steps: [
      'Leave the post open.',
      'Review comments as they appear.',
      'Take this post if more reports come in.',
    ],
  };
};

const scoreComment = (
  signal: IncidentSignal,
  config: FirewatchConfig
): FlaggedComment | undefined => {
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
    author: signal.author ?? 'unknown',
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
      counts[comment.author] = (counts[comment.author] ?? 0) + 1;
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

  for (const signal of signals) {
    if (!signal.author) continue;

    const current = participants.get(signal.author) ?? {
      signals: 0,
      lastSeenAt: 0,
      branches: new Set<string>(),
    };
    current.signals += 1;
    current.lastSeenAt = Math.max(current.lastSeenAt, signal.createdAt);
    if (signal.parentId) current.branches.add(signal.parentId);
    participants.set(signal.author, current);
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
  const recentSignals = incident.recentSignals.filter(
    (signal) => signal.createdAt >= oneHourAgo
  );
  const recentComments = recentSignals.filter(
    (signal) => signal.type === 'comment_create'
  );
  const reports = recentSignals.filter(
    (signal) => signal.type === 'comment_report' || signal.type === 'post_report'
  );
  const commentReports = recentSignals.filter(
    (signal) => signal.type === 'comment_report'
  );
  const postReportSignals = recentSignals.filter(
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
  const repeatedPhrases = extractRepeatedPhrases(recentSignals);
  const repeatedPhraseHits = repeatedPhrases.reduce(
    (total, phrase) => total + phrase.count,
    0
  );
  const keywordHits = recentSignals.reduce(
    (total, signal) => total + countKeywordHits(signal.body ?? '', config.keywords),
    0
  );
  const suspiciousHits = recentSignals.reduce(
    (total, signal) =>
      total + countSuspiciousDomainHits(signal.body ?? '', config.suspiciousDomains),
    0
  );
  const parentAuthors = recentSignals.reduce<Record<string, Set<string>>>(
    (counts, signal) => {
      if (signal.parentId && signal.author) {
        const authors = counts[signal.parentId] ?? new Set<string>();
        authors.add(signal.author);
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
  const velocityPoints = clamp(recentComments.length * 3, 0, 30);
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
        .map((signal) => signal.author)
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
          recentSignals.some((signal) =>
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
          recentSignals.some((signal) =>
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
  const previousRemoved = new Set(
    incident.flaggedComments
      .filter((comment) => comment.removed)
      .map((comment) => comment.id)
  );
  const flaggedById = new Map<string, FlaggedComment>();

  for (const signal of incident.recentSignals) {
    const flagged = scoreComment(signal, config);
    if (!flagged) continue;

    const existing = flaggedById.get(flagged.id);
    if (!existing || existing.score < flagged.score) {
      flaggedById.set(flagged.id, flagged);
    }
  }

  const allFlaggedComments = Array.from(flaggedById.values())
    .map((comment) => ({
      ...comment,
      removed: previousRemoved.has(comment.id) || comment.removed,
    }))
    .sort((a, b) => b.score - a.score);
  const flaggedComments = allFlaggedComments.slice(0, MAX_FLAGGED_COMMENTS);
  const level = getLevel(score, config);
  const peakScore = Math.max(incident.peakScore ?? 0, score);
  const peakLevel = getLevel(peakScore, config);
  const involvedUsers = buildParticipants(recentSignals, flaggedComments);
  const stats: IncidentStats = {
    ...makeEmptyStats(),
    signalCount: recentSignals.length,
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
    flaggedCount: allFlaggedComments.length,
    uniqueParticipants: new Set(
      recentSignals
        .map((signal) => signal.author)
        .filter((author): author is string => Boolean(author))
    ).size,
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
    reasons: reasons.sort((a, b) => b.points - a.points),
    flaggedComments,
    involvedUsers,
    repeatedPhrases,
    stats,
    trend: buildTrend(recentSignals, config),
    responseSuggestion: getResponseSuggestion(score, level),
    updatedAt: now(),
  };
};

const refreshIncident = async (incident: Incident) => {
  const postSnapshot = await getPostSnapshot(incident.postId);
  const config = await getConfig(postSnapshot.subredditName);
  return calculateIncident(incident, config, postSnapshot);
};

export const upsertIncidentSignal = async (input: SignalInput) => {
  const postSnapshot = await getPostSnapshot(input.postId);
  const existing = await getIncident(input.postId);
  const signal: IncidentSignal = {
    ...input,
    id: makeId('sig'),
    createdAt: input.createdAt ?? now(),
  };
  const baseIncident: Incident =
    existing ??
    {
      postId: input.postId,
      subredditName: postSnapshot.subredditName,
      title: postSnapshot.title,
      permalink: postSnapshot.permalink,
      score: 0,
      level: 'watch',
      peakScore: 0,
      peakLevel: 'watch',
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
      reasons: [],
      flaggedComments: [],
      recentSignals: [],
      involvedUsers: [],
      repeatedPhrases: [],
      stats: makeEmptyStats(),
      trend: [],
      responseSuggestion: getResponseSuggestion(0, 'watch'),
      actions: [],
    };
  const nextStatus =
    signal.type === 'manual_escalation' || baseIncident.status === 'resolved'
      ? 'active'
      : baseIncident.status;
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

  return incidents
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, 25);
};

export const getIncidentById = async (postId: string) => {
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
};

const appendAction = async (
  postId: string,
  action: Omit<IncidentAction, 'id' | 'createdAt'>
) => {
  const incident = await getIncident(postId);
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

const actorName = async () =>
  context.username ?? (await reddit.getCurrentUsername()) ?? 'mod';

export const claimIncident = async (postId: string) => {
  const incident = await getIncident(postId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const claimedAt = now();
  const existingClaim = incident.claim ?? {
    username: actor,
    claimedAt,
  };

  if (incident.claim) {
    await redis.set(claimKey(postId), JSON.stringify(incident.claim), {
      nx: true,
    });
  }

  const claimValue = JSON.stringify(existingClaim);
  const createdClaim = incident.claim
    ? undefined
    : await redis.set(claimKey(postId), claimValue, { nx: true });
  const storedClaim = createdClaim
    ? existingClaim
    : JSON.parse((await redis.get(claimKey(postId))) ?? claimValue) as {
        username: string;
        claimedAt: number;
      };
  const claimed: Incident = {
    ...incident,
    claim: storedClaim,
    updatedAt: now(),
  };

  await saveIncident(claimed);
  return appendAction(postId, {
    type: 'claimed',
    actor,
    detail: storedClaim.username !== actor
      ? `Already taken by u/${storedClaim.username}`
      : `Taken by u/${actor}`,
  });
};

export const coolDownIncident = async (postId: string) => {
  const post = await reddit.getPostById(postId as T3);
  const actor = await actorName();
  const comment = await post.addComment({
    text:
      'Mod note: Please keep this discussion civil, stay on topic, and follow the community rules. Rule-breaking comments may be removed.',
  });
  await comment.distinguish(true);

  const incident = await appendAction(postId, {
    type: 'cool_down',
    actor,
    detail: `Added sticky mod reminder ${comment.id}`,
  });
  const monitoring: Incident = {
    ...incident,
    status: 'monitoring',
    updatedAt: now(),
  };

  await saveIncident(monitoring);
  return monitoring;
};

export const lockIncident = async (postId: string) => {
  const post = await reddit.getPostById(postId as T3);
  const actor = await actorName();
  await post.lock();

  return appendAction(postId, {
    type: 'locked',
    actor,
    detail: 'Locked post',
  });
};

const isDemoComment = (incident: Incident, commentId: string) =>
  commentId.startsWith('t1_fw_demo_') ||
  incident.recentSignals.some(
    (signal) => signal.commentId === commentId && signal.isDemo
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
  if (isDemoComment(incident, commentId)) return;

  const comment = await reddit.getCommentById(commentId as T1);
  await comment.remove(false);
  const modNote = trimRemovalNote(reason);
  if (modNote) {
    await comment.addRemovalNote({
      reasonId: '',
      modNote,
    });
  }
};

export const removeFlaggedComment = async (
  postId: string,
  commentId: string,
  reason?: string
) => {
  const sourceIncident = await getIncident(postId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  await removeCommentIfReal(sourceIncident, commentId, reason);
  const incident = await appendAction(postId, {
    type: 'comment_removed',
    actor,
    detail: `Removed comment ${commentId}${reason ? `: ${reason}` : ''}`,
  });
  const nextIncident: Incident = {
    ...incident,
    flaggedComments: incident.flaggedComments.map((flaggedComment) =>
      flaggedComment.id === commentId
        ? { ...flaggedComment, removed: true }
        : flaggedComment
    ),
  };

  await saveIncident(nextIncident);
  return nextIncident;
};

export const cleanUpIncident = async (
  postId: string,
  commentIds: string[],
  reason?: string
) => {
  const sourceIncident = await getIncident(postId);
  if (!sourceIncident) throw new Error('Post is not in Firewatch yet');

  const selectedIds = Array.from(new Set(commentIds)).filter((commentId) =>
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

  await Promise.all(
    targetIds.map((commentId) =>
      removeCommentIfReal(sourceIncident, commentId, reason)
    )
  );

  const actor = await actorName();
  const incident = await appendAction(postId, {
    type: 'cleanup',
    actor,
    detail: `Removed ${targetIds.length} comment${
      targetIds.length === 1 ? '' : 's'
    }${reason ? `: ${reason}` : ''}`,
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

  await saveIncident(nextIncident);
  return nextIncident;
};

const buildSummary = (incident: Incident) => {
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
    .map((user) => `u/${user.username}`)
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
    `Highest review score: ${incident.peakScore}/100 (${formatLevel(incident.peakLevel)})`,
    `Final status: ${formatStatus(incident.status)}`,
    `Time open: ${resolutionTime}`,
    `Why this needed review: ${topReasons || 'No active review reasons'}`,
    `Comments reviewed: ${incident.flaggedComments.length}`,
    `Handled by: ${incident.claim ? `u/${incident.claim.username}` : 'unclaimed'}`,
    `Users in post: ${involvedUsers || 'none detected'}`,
    `Repeated wording: ${commonPhrases || 'none detected'}`,
    'Recent actions:',
    actionLines || '- No mod actions yet',
  ].join('\n');
};

const buildEscalationSummary = (incident: Incident) => {
  const unresolved = incident.flaggedComments.filter((comment) => !comment.removed);
  const topReasons = incident.reasons
    .slice(0, 4)
    .map((reason) => `${reason.label}: ${reason.detail}`)
    .join('\n');
  const topComments = unresolved
    .slice(0, 5)
    .map(
      (comment) =>
        `- u/${comment.author} (${comment.score}): ${comment.body.slice(0, 180)}`
    )
    .join('\n');

  return [
    `Mod handoff note: ${incident.title}`,
    `Review score: ${incident.score}/100 (${formatLevel(incident.level)}); suggested action: ${incident.responseSuggestion.label}`,
    `Post: ${incident.permalink ?? incident.postId}`,
    `Handled by: ${incident.claim ? `u/${incident.claim.username}` : 'unclaimed'}`,
    'Why this is here:',
    topReasons || '- No active reasons recorded',
    'Comments to review:',
    topComments || '- No unresolved comments',
  ].join('\n');
};

export const escalateIncident = async (postId: string) => {
  const incident = await getIncident(postId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const escalationSummary = buildEscalationSummary(incident);
  const withAction = await appendAction(postId, {
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
  const incident = await getIncident(postId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await actorName();
  const resolvedAt = now();
  const summary = buildSummary({ ...incident, status: 'resolved', resolvedAt });
  const resolved: Incident = {
    ...incident,
    status: 'resolved',
    resolvedAt,
    summary,
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

  await saveIncident(resolved);
  return resolved;
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
      'The review queue is populated through the same path used by comments, reports, and posts sent by mods.',
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
  const sourcePost = options?.incidentPostId
    ? await getPostSnapshot(options.incidentPostId)
    : undefined;

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: sourcePost
      ? `Firewatch review: ${sourcePost.title.slice(0, 220)}`
      : 'Firewatch mod queue',
    entry: 'dashboard',
    postData: options?.incidentPostId
      ? {
          incidentPostId: options.incidentPostId,
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
