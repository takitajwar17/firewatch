import { context, redis, reddit } from '@devvit/web/server';
import type {
  FirewatchConfig,
  FlaggedComment,
  Incident,
  IncidentAction,
  IncidentLevel,
  IncidentSignal,
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
const MAX_RECENT_SIGNALS = 80;

type SignalInput = Omit<IncidentSignal, 'id' | 'createdAt'> & {
  createdAt?: number;
};

const incidentKey = (postId: string) => `fw:incident:${postId}`;
const configKey = (subredditName: string) => `fw:config:${subredditName}`;
const now = () => Date.now();

const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const parseCsv = (value: string | undefined, fallback: string[]) => {
  if (!value) return fallback;

  const parsed = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
};

export const getConfig = async (
  subredditName = context.subredditName
): Promise<FirewatchConfig> => {
  const stored = await redis.get(configKey(subredditName));
  if (!stored) return DEFAULT_CONFIG;

  try {
    const parsed = JSON.parse(stored) as Partial<FirewatchConfig>;
    return {
      keywords: parsed.keywords?.length
        ? parsed.keywords
        : DEFAULT_CONFIG.keywords,
      suspiciousDomains: parsed.suspiciousDomains?.length
        ? parsed.suspiciousDomains
        : DEFAULT_CONFIG.suspiciousDomains,
      heatThreshold: clamp(
        Number(parsed.heatThreshold ?? DEFAULT_CONFIG.heatThreshold),
        1,
        100
      ),
      fireThreshold: clamp(
        Number(parsed.fireThreshold ?? DEFAULT_CONFIG.fireThreshold),
        1,
        100
      ),
      wildfireThreshold: clamp(
        Number(parsed.wildfireThreshold ?? DEFAULT_CONFIG.wildfireThreshold),
        1,
        100
      ),
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
  const nextConfig: FirewatchConfig = {
    keywords: parseCsv(values.keywords, current.keywords),
    suspiciousDomains: parseCsv(
      values.suspiciousDomains,
      current.suspiciousDomains
    ),
    heatThreshold: clamp(
      Number(values.heatThreshold ?? current.heatThreshold),
      1,
      100
    ),
    fireThreshold: clamp(
      Number(values.fireThreshold ?? current.fireThreshold),
      1,
      100
    ),
    wildfireThreshold: clamp(
      Number(values.wildfireThreshold ?? current.wildfireThreshold),
      1,
      100
    ),
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

const addToIndex = async (postId: string) => {
  const index = await getIndex();
  const nextIndex = [postId, ...index.filter((id) => id !== postId)].slice(
    0,
    100
  );
  await redis.set(INDEX_KEY, JSON.stringify(nextIndex));
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

const getPostSnapshot = async (postId: string) => {
  const post = await reddit.getPostById(postId as T3);

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
    reasons.push(`${keywordHits} keyword match${keywordHits > 1 ? 'es' : ''}`);
  }

  if (suspiciousHits > 0) {
    score += suspiciousHits * 10;
    reasons.push(
      `${suspiciousHits} suspicious domain match${suspiciousHits > 1 ? 'es' : ''}`
    );
  }

  if (signal.type === 'comment_report') {
    score += 20;
    reasons.push(signal.reason ? `reported: ${signal.reason}` : 'reported');
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
  const manualEscalations = recentSignals.filter(
    (signal) => signal.type === 'manual_escalation'
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
  const parentCounts = recentSignals.reduce<Record<string, number>>(
    (counts, signal) => {
      if (signal.parentId) counts[signal.parentId] = (counts[signal.parentId] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const branchPileOnCount = Object.values(parentCounts).filter(
    (count) => count >= 4
  ).length;
  const reasons: RiskReason[] = [];
  const velocityPoints = clamp(recentComments.length * 3, 0, 30);
  const reportPoints = clamp(
    reports.length * 15 + postSnapshot.numberOfReports * 8,
    0,
    35
  );
  const keywordPoints = clamp(keywordHits * 8, 0, 25);
  const suspiciousPoints = clamp(suspiciousHits * 10, 0, 20);
  const pileOnPoints = clamp(branchPileOnCount * 15, 0, 20);
  const manualPoints = manualEscalations.length > 0 ? 25 : 0;

  if (velocityPoints > 0) {
    reasons.push({
      key: 'velocity',
      label: 'Comment velocity',
      detail: `${recentComments.length} new comment signals in the last hour`,
      points: velocityPoints,
    });
  }

  if (reportPoints > 0) {
    reasons.push({
      key: 'reports',
      label: 'Reports',
      detail: `${reports.length} recent report signals plus ${postSnapshot.numberOfReports} post reports`,
      points: reportPoints,
    });
  }

  if (keywordPoints > 0) {
    reasons.push({
      key: 'keywords',
      label: 'Heated terms',
      detail: `${keywordHits} configured keyword match${keywordHits > 1 ? 'es' : ''}`,
      points: keywordPoints,
    });
  }

  if (suspiciousPoints > 0) {
    reasons.push({
      key: 'links',
      label: 'Suspicious links',
      detail: `${suspiciousHits} suspicious domain match${suspiciousHits > 1 ? 'es' : ''}`,
      points: suspiciousPoints,
    });
  }

  if (pileOnPoints > 0) {
    reasons.push({
      key: 'pile-on',
      label: 'Branch pile-on',
      detail: `${branchPileOnCount} clustered reply branch${
        branchPileOnCount > 1 ? 'es' : ''
      }`,
      points: pileOnPoints,
    });
  }

  if (manualPoints > 0) {
    reasons.push({
      key: 'manual',
      label: 'Manual escalation',
      detail: 'A moderator manually escalated this thread',
      points: manualPoints,
    });
  }

  const score = clamp(
    velocityPoints +
      reportPoints +
      keywordPoints +
      suspiciousPoints +
      pileOnPoints +
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

  const flaggedComments = Array.from(flaggedById.values())
    .map((comment) => ({
      ...comment,
      removed: previousRemoved.has(comment.id) || comment.removed,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FLAGGED_COMMENTS);

  return {
    ...incident,
    title: postSnapshot.title,
    permalink: postSnapshot.permalink,
    subredditName: postSnapshot.subredditName,
    score,
    level: getLevel(score, config),
    reasons: reasons.sort((a, b) => b.points - a.points),
    flaggedComments,
    updatedAt: now(),
  };
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
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
      reasons: [],
      flaggedComments: [],
      recentSignals: [],
      actions: [],
    };
  const nextIncident = calculateIncident(
    {
      ...baseIncident,
      status: 'active',
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
    await Promise.all(index.map(async (postId) => getIncident(postId)))
  ).filter((incident): incident is Incident => Boolean(incident));

  return incidents
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, 25);
};

export const getIncidentById = async (postId: string) => getIncident(postId);

const appendAction = async (
  postId: string,
  action: Omit<IncidentAction, 'id' | 'createdAt'>
) => {
  const incident = await getIncident(postId);
  if (!incident) throw new Error('Incident not found');

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

  await saveIncident(nextIncident);
  return nextIncident;
};

const actorName = async () =>
  context.username ?? (await reddit.getCurrentUsername()) ?? 'mod';

export const claimIncident = async (postId: string) => {
  const incident = await getIncident(postId);
  if (!incident) throw new Error('Incident not found');

  const actor = await actorName();
  const claimed: Incident = {
    ...incident,
    claim: incident.claim ?? {
      username: actor,
      claimedAt: now(),
    },
    updatedAt: now(),
  };

  await saveIncident(claimed);
  return appendAction(postId, {
    type: 'claimed',
    actor,
    detail: incident.claim
      ? `Incident already claimed by u/${incident.claim.username}`
      : `Claimed by u/${actor}`,
  });
};

export const coolDownIncident = async (postId: string) => {
  const post = await reddit.getPostById(postId as T3);
  const actor = await actorName();
  const comment = await post.addComment({
    text:
      'Firewatch notice: This thread is heating up. Please slow down, stay on topic, and follow community rules. Further rule-breaking may be removed.',
  });
  await comment.distinguish(true);

  return appendAction(postId, {
    type: 'cool_down',
    actor,
    detail: `Posted distinguished cooldown reminder ${comment.id}`,
  });
};

export const lockIncident = async (postId: string) => {
  const post = await reddit.getPostById(postId as T3);
  const actor = await actorName();
  await post.lock();

  return appendAction(postId, {
    type: 'locked',
    actor,
    detail: 'Locked the source thread',
  });
};

export const removeFlaggedComment = async (
  postId: string,
  commentId: string
) => {
  const comment = await reddit.getCommentById(commentId as T1);
  const actor = await actorName();
  await comment.remove(false);
  const incident = await appendAction(postId, {
    type: 'comment_removed',
    actor,
    detail: `Removed flagged comment ${commentId}`,
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

const buildSummary = (incident: Incident) => {
  const topReasons = incident.reasons
    .slice(0, 3)
    .map((reason) => `${reason.label} (+${reason.points})`)
    .join(', ');
  const actionLines = incident.actions
    .slice(0, 5)
    .map((action) => `- ${action.detail}`)
    .join('\n');

  return [
    `Firewatch after-action summary for ${incident.title}`,
    `Peak risk score: ${incident.score}/100 (${incident.level})`,
    `Top signals: ${topReasons || 'No active risk signals'}`,
    `Flagged comments reviewed: ${incident.flaggedComments.length}`,
    `Claimed by: ${incident.claim ? `u/${incident.claim.username}` : 'unclaimed'}`,
    'Recent actions:',
    actionLines || '- No moderator actions recorded yet',
  ].join('\n');
};

export const resolveIncident = async (postId: string) => {
  const incident = await getIncident(postId);
  if (!incident) throw new Error('Incident not found');

  const actor = await actorName();
  const summary = buildSummary(incident);
  const resolved: Incident = {
    ...incident,
    status: 'resolved',
    summary,
    updatedAt: now(),
    actions: [
      {
        id: makeId('act'),
        type: 'resolved' as const,
        actor,
        createdAt: now(),
        detail: 'Marked incident resolved',
      },
      ...incident.actions,
    ].slice(0, MAX_ACTIONS),
  };

  await saveIncident(resolved);
  return resolved;
};

export const createFirewatchPost = async (options?: {
  incidentPostId?: string;
}) => {
  const sourcePost = options?.incidentPostId
    ? await getPostSnapshot(options.incidentPostId)
    : undefined;

  return await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: sourcePost
      ? `Firewatch: ${sourcePost.title.slice(0, 220)}`
      : 'Firewatch incident board',
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
        ? `Firewatch incident panel for ${sourcePost.title}`
        : 'Firewatch incident board for moderators.',
    },
  });
};
