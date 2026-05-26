import { context, redis, reddit } from '@devvit/web/server';
import type { Incident, IncidentAction } from '../../../shared/api';
import { MAX_ACTIONS } from '../firewatch-constants';
import { attachRuleContext } from '../firewatch-rules/matching';
import { clearUserStrikes } from '../firewatch-rules/strikes';
import { calculateIncident } from '../firewatch-scoring';
import type { PostSnapshot } from '../firewatch-scoring/helpers';
import { upsertIncidentSignal } from './signals';
import { actorName, getConfig, getIncident, saveIncident } from './store';
import {
  claimKey,
  formatLevel,
  formatStatus,
  formatUserHandle,
  makeId,
  normalizeCommentId,
  normalizePostId,
  normalizeUsername,
  now,
  retentionExpiration,
} from '../firewatch-utils';


// Native Reddit state hydration
const redditReadErrorMessage = (error: unknown) => {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  } else if (typeof error === 'string') {
    parts.push(error);
  }

  if (typeof error === 'object' && error !== null) {
    if ('details' in error && typeof error.details === 'string') {
      parts.push(error.details);
    }
    if (
      'code' in error &&
      (typeof error.code === 'number' || typeof error.code === 'string')
    ) {
      parts.push(String(error.code));
    }
  }

  return parts.join(' ');
};

const isTransientRedditReadError = (error: unknown) =>
  /cancelled|deadline|unavailable|timeout|timed out|econnreset/i.test(
    redditReadErrorMessage(error)
  );

const warnedPostSnapshotFallbacks = new Set<string>();

const waitForRedditReadRetry = (delayMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const getPostSnapshotFromReddit = async (
  postId: string
): Promise<PostSnapshot> => {
  const post = await reddit.getPostById(normalizePostId(postId));
  const createdAt = post.createdAt.getTime();
  const flair = post.flair?.text?.trim()
    ? {
        text: post.flair.text.trim(),
        templateId: post.flair.templateId,
        backgroundColor: post.flair.backgroundColor,
        textColor: post.flair.textColor,
      }
    : undefined;

  return {
    authorName: normalizeUsername(post.authorName),
    score: post.score,
    numberOfComments: post.numberOfComments,
    title: post.title || 'Untitled post',
    permalink: post.permalink,
    subredditName: post.subredditName,
    numberOfReports: post.numberOfReports,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    postState: {
      approved: post.approved,
      ignoringReports: post.ignoringReports,
      locked: post.locked,
      nsfw: post.nsfw,
      removed: post.removed,
      spam: post.spam,
      spoiler: post.spoiler,
      flair,
    },
  };
};

export const getPostSnapshot = async (postId: string) => {
  const retryDelays = [120, 300];

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await getPostSnapshotFromReddit(postId);
    } catch (error) {
      const delayMs = retryDelays[attempt];
      if (!isTransientRedditReadError(error) || delayMs === undefined) {
        throw error;
      }
      await waitForRedditReadRetry(delayMs);
    }
  }

  return getPostSnapshotFromReddit(postId);
};

const fallbackPostSnapshot = (incident: Incident): PostSnapshot => ({
  authorName: incident.postAuthor,
  score: incident.postScore ?? 0,
  numberOfComments:
    incident.postCommentCount ?? incident.flaggedComments.length,
  title: incident.title || 'Untitled post',
  permalink: incident.permalink,
  subredditName: incident.subredditName,
  numberOfReports: 0,
  createdAt: incident.createdAt,
  postState: incident.postState,
});

const getRefreshPostSnapshot = async (incident: Incident) => {
  try {
    return await getPostSnapshot(incident.postId);
  } catch (error) {
    if (
      !isTransientRedditReadError(error) &&
      !warnedPostSnapshotFallbacks.has(incident.postId)
    ) {
      warnedPostSnapshotFallbacks.add(incident.postId);
      console.warn(
        `Using stored Firewatch post snapshot for ${incident.postId}`,
        error
      );
    }

    return fallbackPostSnapshot(incident);
  }
};

export const isDemoCommentSnapshot = (incident: Incident, commentId: string) =>
  normalizeCommentId(commentId).startsWith('t1_fw_demo_') ||
  incident.recentSignals.some(
    (signal) =>
      signal.commentId === normalizeCommentId(commentId) && signal.isDemo
  );

const applyNativeCommentState = async (
  incident: Incident,
  comment: Incident['flaggedComments'][number]
) => {
  if (isDemoCommentSnapshot(incident, comment.id)) return comment;

  try {
    const redditComment = await reddit.getCommentById(
      normalizeCommentId(comment.id)
    );
    const removed =
      comment.removed || redditComment.removed || redditComment.spam;
    const reviewed = comment.reviewed || redditComment.approved;

    return {
      ...comment,
      approved: redditComment.approved,
      ignoringReports: redditComment.ignoringReports,
      locked: redditComment.locked,
      numReports: redditComment.numReports,
      removed,
      reviewed,
      spam: redditComment.spam,
    };
  } catch {
    return comment;
  }
};

export const hydrateFlaggedCommentStates = async (incident: Incident) => {
  if (incident.flaggedComments.length === 0) return incident;

  const flaggedComments = await Promise.all(
    incident.flaggedComments.map((comment) =>
      applyNativeCommentState(incident, comment)
    )
  );

  return {
    ...incident,
    flaggedComments,
  };
};

export const reviewStateKey = (incident: Incident) =>
  incident.flaggedComments
    .map(
      (comment) =>
        `${comment.id}:${Boolean(comment.removed)}:${Boolean(comment.reviewed)}`
    )
    .join('|');



// Moderator summaries
export const ruleDraftSummary = (
  incident: Incident,
  match: NonNullable<Incident['matchedRules']>[number],
  template: string | undefined
) =>
  [
    template ?? `${match.ruleName} matched and prepared a draft handoff.`,
    `Incident: ${incident.title}`,
    `Target: ${match.username ? formatUserHandle(match.username) : match.targetId}`,
    'Why it matched:',
    ...match.why.map((reason) => `- ${reason}`),
    'Prepared actions:',
    ...match.preparedActions.map((action) => `- ${action.label}`),
  ].join('\n');

const safetyReviewSummary = (incident: Incident) => {
  if (!incident.safetyReview) return undefined;

  return incident.safetyReview.matches
    .slice(0, 3)
    .map((match) =>
      match.author
        ? `${match.label} from ${formatUserHandle(match.author)}`
        : match.label
    )
    .join(', ');
};

export const buildSummary = (incident: Incident) => {
  const handler = incident.claim?.username;
  const topReasons = (
    incident.peakReasons?.length ? incident.peakReasons : incident.reasons
  )
    .slice(0, 3)
    .map((reason) => `${reason.label} (+${reason.points})`)
    .join(', ');
  const commonPhrases = (
    incident.peakRepeatedPhrases?.length
      ? incident.peakRepeatedPhrases
      : incident.repeatedPhrases
  )
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
  const matchedRules = (incident.matchedRules ?? [])
    .slice(0, 5)
    .map(
      (rule) =>
        `- ${rule.ruleName}: ${rule.why.join('; ')}; prepared ${rule.preparedActions
          .map((action) => action.label)
          .join(', ')}`
    )
    .join('\n');
  const resolutionTime =
    incident.resolvedAt && (incident.openedAt ?? incident.createdAt)
      ? `${Math.max(1, Math.round((incident.resolvedAt - (incident.openedAt ?? incident.createdAt)) / 60000))}m`
      : 'unresolved';
  const safetySummary = safetyReviewSummary(incident);

  return [
    `Final mod note for ${incident.title}`,
    `Started at: ${new Date(incident.openedAt ?? incident.createdAt).toISOString()}`,
    `Peak review score: ${incident.peakScore}/100 (${formatLevel(incident.peakLevel)})`,
    `Final status: ${formatStatus(incident.status)}`,
    `Time open: ${resolutionTime}`,
    `Impact: ${incident.impact.reportsGrouped} reports grouped, ${incident.impact.commentsReviewed} comments reviewed, ${incident.impact.actionsTaken} mod actions recorded`,
    `Why this needed review: ${topReasons || 'No active review reasons'}`,
    safetySummary ? `Safety review: ${safetySummary}` : undefined,
    `Comments reviewed: ${incident.impact.commentsReviewed}`,
    `Comments still waiting: ${incident.impact.commentsAwaitingReview}`,
    `Resolved by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
    `Users in post: ${involvedUsers || 'none detected'}`,
    `Repeated wording: ${commonPhrases || 'none detected'}`,
    'Matched automations:',
    matchedRules || '- No active automations matched',
    'Recent actions:',
    actionLines || '- No mod actions yet',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
};

export const buildEscalationSummary = (incident: Incident) => {
  const handler = incident.claim?.username;
  const unresolved = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  );
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
  const matchedRules = (incident.matchedRules ?? [])
    .slice(0, 5)
    .map(
      (rule) =>
        `- ${rule.ruleName}: ${rule.why.join('; ')}; prepared ${rule.preparedActions
          .map((action) => action.label)
          .join(', ')}`
    )
    .join('\n');
  const safetySummary = safetyReviewSummary(incident);

  return [
    `Mod handoff note: ${incident.title}`,
    `Review score: ${incident.score}/100 (${formatLevel(incident.level)}); peak score: ${incident.peakScore}/100; next mod move: ${incident.responseSuggestion.label}`,
    `Post: ${incident.permalink ?? incident.postId}`,
    `Resolved by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
    safetySummary ? `Safety review: ${safetySummary}` : undefined,
    `Impact so far: ${incident.impact.reportsGrouped} reports grouped, ${incident.impact.commentsReviewed} comments reviewed, ${incident.impact.commentsAwaitingReview} comments still waiting`,
    'Why this is here:',
    topReasons || '- No active reasons recorded',
    'Comments to review:',
    topComments || '- No unresolved comments',
    'Matched automations:',
    matchedRules || '- No active automations matched',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
};



// Incident refresh and action log core
export const refreshIncident = async (incident: Incident) => {
  const postSnapshot = await getRefreshPostSnapshot(incident);
  const config = await getConfig(postSnapshot.subredditName);
  const hydratedIncident = await hydrateFlaggedCommentStates(incident);
  const calculated = calculateIncident(hydratedIncident, config, postSnapshot);
  const hydratedCalculated = await hydrateFlaggedCommentStates(calculated);
  const stableCalculated =
    reviewStateKey(calculated) === reviewStateKey(hydratedCalculated)
      ? hydratedCalculated
      : await hydrateFlaggedCommentStates(
          calculateIncident(hydratedCalculated, config, postSnapshot)
        );

  return attachRuleContext(stableCalculated, config);
};

export const appendAction = async (
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

export const getIncidentOrThrow = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  return incident;
};



// Incident-level actions
type IncidentClaim = NonNullable<Incident['claim']>;

const claimActorKey = (username: string | undefined) =>
  normalizeUsername(username)?.toLowerCase();

const claimActorName = async () =>
  normalizeUsername(
    context.username ?? (await reddit.getCurrentUsername()) ?? undefined
  );

const parseStoredClaim = (
  value: string,
  fallback: IncidentClaim
): IncidentClaim => {
  try {
    const parsed: Partial<IncidentClaim> = JSON.parse(value);
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.claimedAt === 'number'
    ) {
      return {
        username: parsed.username,
        claimedAt: parsed.claimedAt,
      };
    }
  } catch (error) {
    console.error('Failed to parse Firewatch claim', error);
  }

  return fallback;
};

export const claimIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await claimActorName();
  if (!actor) throw new Error('Could not identify the current moderator');

  const actorKey = claimActorKey(actor);

  const claimedAt = now();
  if (incident.claim) {
    if (claimActorKey(incident.claim.username) !== actorKey) {
      throw new Error(
        `Claimed by u/${incident.claim.username}. Ask them to unclaim before acting.`
      );
    }

    return incident;
  }

  const existingClaim = incident.claim ?? {
    username: actor,
    claimedAt,
  };

  const claimValue = JSON.stringify(existingClaim);
  const createdClaim = await redis.set(claimKey(normalizedPostId), claimValue, {
    expiration: retentionExpiration(),
    nx: true,
  });
  const storedClaim = createdClaim
    ? existingClaim
    : parseStoredClaim(
        (await redis.get(claimKey(normalizedPostId))) ?? claimValue,
        existingClaim
      );
  const claimed: Incident = {
    ...incident,
    claim: storedClaim,
    updatedAt: now(),
  };

  await saveIncident(claimed);
  if (claimActorKey(storedClaim.username) !== actorKey) {
    throw new Error(
      `Claimed by u/${storedClaim.username}. Ask them to unclaim before acting.`
    );
  }

  return appendAction(normalizedPostId, {
    type: 'claimed',
    actor,
    detail: `Claimed by u/${actor}`,
  });
};

export const unclaimIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  if (!incident.claim) throw new Error('Post is not claimed');

  const actor = await claimActorName();
  if (!actor) throw new Error('Could not identify the current moderator');

  if (claimActorKey(incident.claim.username) !== claimActorKey(actor)) {
    throw new Error(
      `Claimed by u/${incident.claim.username}. Only that mod can release claim.`
    );
  }

  const releasedUsername = incident.claim.username;
  await redis.del(claimKey(normalizedPostId));

  const released: Incident = {
    ...incident,
    claim: undefined,
    updatedAt: now(),
  };

  await saveIncident(released);
  return appendAction(normalizedPostId, {
    type: 'unclaimed',
    actor,
    detail: `Released claim by u/${releasedUsername}`,
    targetIds: [releasedUsername],
  });
};

export const coolDownIncident = async (
  postId: string,
  reminderText?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.stickyReminder) {
    throw new Error('Sticky comments are disabled in Settings');
  }
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  const text = reminderText?.trim() || config.reminderText;
  const comment = await post.addComment({
    text,
  });
  await comment.distinguish(true);

  await upsertIncidentSignal({
    type: 'comment_create',
    source: 'firewatch_notice',
    postId: normalizedPostId,
    commentId: comment.id,
    author: context.appSlug,
    body: text,
    createdAt: now(),
    metadata: {
      firewatchNotice: true,
    },
  });

  const withAction = await appendAction(normalizedPostId, {
    type: 'cool_down',
    actor,
    detail: `Added sticky mod reminder ${comment.id}`,
  });
  const refreshedIncident = await refreshIncident({
    ...withAction,
    status: 'cooldown',
    updatedAt: now(),
  });

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};

export const lockIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.lockPost) {
    throw new Error('Post locking is disabled in Settings');
  }
  const post = await reddit.getPostById(normalizedPostId);
  const actor = await actorName();
  await post.lock();

  return appendAction(normalizedPostId, {
    type: 'locked',
    actor,
    detail: 'Locked post',
  });
};


export const clearIncidentUserStrikes = async (
  postId: string,
  username: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot clear unknown user');

  const incident = await getIncidentOrThrow(normalizedPostId);
  await clearUserStrikes(incident.subredditName, normalizedUsername);

  const actor = await actorName();
  return appendAction(normalizedPostId, {
    type: 'rule_action_executed',
    actor,
    detail: `Cleared Firewatch strikes for u/${normalizedUsername}`,
    targetIds: [normalizedUsername],
  });
};



// Incident lifecycle
export const escalateIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const storedIncident = await getIncident(normalizedPostId);
  if (!storedIncident) throw new Error('Post is not in Firewatch yet');
  const incident = await refreshIncident(storedIncident);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.handoffNotes) {
    throw new Error('Handoff notes are disabled in Settings');
  }

  const actor = await actorName();
  const currentIncident = await refreshIncident(incident);
  const escalationSummary = buildEscalationSummary(currentIncident);
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
  const storedIncident = await getIncident(normalizedPostId);
  if (!storedIncident) throw new Error('Post is not in Firewatch yet');
  const incident = await refreshIncident(storedIncident);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.markResolved) {
    throw new Error('Mark resolved is disabled in Settings');
  }
  const unresolvedCount = incident.flaggedComments.filter(
    (comment) => !comment.removed && !comment.reviewed
  ).length;
  if (unresolvedCount > 0) {
    throw new Error('Review all comments before marking resolved');
  }

  const actor = await actorName();
  const resolvedAt = now();
  const resolvedAction: IncidentAction = {
    id: makeId('act'),
    type: 'resolved',
    actor,
    createdAt: now(),
    detail: 'Marked post resolved',
  };
  const resolved: Incident = {
    ...incident,
    status: 'resolved',
    resolvedAt,
    updatedAt: resolvedAt,
    actions: [resolvedAction, ...incident.actions].slice(0, MAX_ACTIONS),
  };
  const refreshedResolved = await refreshIncident(resolved);
  const summary = buildSummary(refreshedResolved);
  const refreshedIncident = await refreshIncident({
    ...refreshedResolved,
    summary,
  });

  await saveIncident(refreshedIncident);
  return refreshedIncident;
};
