import { context, redis, reddit } from '@devvit/web/server';
import type { Incident, IncidentAction } from '../../../shared/api';
import { firewatchRatingSummary } from '../../../shared/firewatch-rating.js';
import { openCommentsForReview } from '../../../shared/incidents';
import { MAX_ACTIONS } from '../firewatch-constants';
import { attachRuleContext, ruleMatchKey } from '../firewatch-rules/matching';
import { clearUserStrikes } from '../firewatch-rules/strikes';
import { calculateIncident } from '../firewatch-scoring';
import type { PostSnapshot } from '../firewatch-scoring/helpers';
import {
  isTransientRedditRuntimeError,
  readRedditComment,
  readRedditPost,
  redditRuntimeErrorMessage,
} from './reddit-runtime';
import { upsertIncidentSignal } from './signals';
import { actorName, getConfig, getIncident, saveIncident } from './store';
import { logFirewatchError, logFirewatchWarn } from './logging';
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
  usernameKey,
} from '../firewatch-utils';


// Native Reddit state hydration
const warnedPostSnapshotFallbacks = new Set<string>();
const warnedCommentStateFallbacks = new Set<string>();

const getPostSnapshotFromReddit = async (
  postId: string
): Promise<PostSnapshot> => {
  const post = await readRedditPost(postId);
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
  return getPostSnapshotFromReddit(postId);
};

const fallbackPostSnapshot = (incident: Incident): PostSnapshot => ({
  authorName: incident.postAuthor,
  score: incident.postScore ?? 0,
  numberOfComments: incident.postCommentCount ?? 0,
  title: incident.title || 'Untitled post',
  permalink: incident.permalink,
  subredditName: incident.subredditName,
  numberOfReports: 0,
  createdAt: incident.createdAt,
  postState: incident.postState,
});

const getRefreshPostSnapshot = async (incident: Incident) => {
  try {
    const snapshot = await getPostSnapshot(incident.postId);
    if (incident.demo?.commentModel === 'sample_review_signals') {
      return {
        ...snapshot,
        numberOfComments:
          incident.postCommentCount ?? incident.flaggedComments.length,
      };
    }
    return snapshot;
  } catch (error) {
    if (
      !isTransientRedditRuntimeError(error) &&
      !warnedPostSnapshotFallbacks.has(incident.postId)
    ) {
      warnedPostSnapshotFallbacks.add(incident.postId);
      logFirewatchWarn('incident.post_snapshot_fallback', {
        postId: incident.postId,
        error,
      });
    }

    return fallbackPostSnapshot(incident);
  }
};

export const isDemoCommentSnapshot = (incident: Incident, commentId: string) =>
  normalizeCommentId(commentId).startsWith('t1_fw_demo_') ||
  incident.recentSignals.some(
    (signal) =>
      signal.commentId &&
      normalizeCommentId(signal.commentId) === normalizeCommentId(commentId) &&
      signal.isDemo
  );

const applyNativeCommentState = async (
  incident: Incident,
  comment: Incident['flaggedComments'][number]
) => {
  if (isDemoCommentSnapshot(incident, comment.id)) return comment;

  try {
    const normalizedCommentId = normalizeCommentId(comment.id);
    const redditComment = await readRedditComment(normalizedCommentId);
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
  } catch (error) {
    const normalizedCommentId = normalizeCommentId(comment.id);
    if (!warnedCommentStateFallbacks.has(normalizedCommentId)) {
      warnedCommentStateFallbacks.add(normalizedCommentId);
      logFirewatchWarn('incident.comment_state_fallback', {
        postId: incident.postId,
        commentId: normalizedCommentId,
        error,
      });
    }
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
        [
          normalizeCommentId(comment.id),
          Boolean(comment.approved),
          Boolean(comment.ignoringReports),
          Boolean(comment.locked),
          comment.numReports ?? '',
          Boolean(comment.removed),
          Boolean(comment.reviewed),
          Boolean(comment.shown),
          Boolean(comment.spam),
        ].join(':')
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

const matchedRuleSummaryLines = (incident: Incident) =>
  (incident.matchedRules ?? [])
    .slice(0, 5)
    .map(
      (rule) =>
        `- ${rule.ruleName}: ${rule.why.join('; ')}; prepared ${rule.preparedActions
          .map((action) => action.label)
          .join(', ')}`
    )
    .join('\n');

const getRefreshedIncidentOrThrow = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const storedIncident = await getIncident(normalizedPostId);
  if (!storedIncident) throw new Error('Post is not in Firewatch yet');
  return {
    incident: await refreshIncident(storedIncident),
    normalizedPostId,
  };
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
  const matchedRules = matchedRuleSummaryLines(incident);
  const resolutionTime =
    incident.resolvedAt && (incident.openedAt ?? incident.createdAt)
      ? `${Math.max(1, Math.round((incident.resolvedAt - (incident.openedAt ?? incident.createdAt)) / 60000))}m`
      : 'unresolved';
  const safetySummary = safetyReviewSummary(incident);

  return [
    `Final mod note for ${incident.title}`,
    `Started at: ${new Date(incident.openedAt ?? incident.createdAt).toISOString()}`,
    `Peak Firewatch rating: ${firewatchRatingSummary(incident.peakScore)} (${formatLevel(incident.peakLevel)})`,
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
  const unresolved = openCommentsForReview(incident);
  const topReasons = incident.reasons
    .slice(0, 4)
    .map((reason) => `${reason.label}: ${reason.detail}`)
    .join('\n');
  const topComments = unresolved
    .slice(0, 5)
    .map(
      (comment) =>
        `- ${formatUserHandle(comment.author)} (${firewatchRatingSummary(comment.score)}): ${comment.body.slice(0, 180)}`
    )
    .join('\n');
  const matchedRules = matchedRuleSummaryLines(incident);
  const safetySummary = safetyReviewSummary(incident);

  return [
    `Mod handoff note: ${incident.title}`,
    `Firewatch rating: ${firewatchRatingSummary(incident.score)} (${formatLevel(incident.level)}); peak ${firewatchRatingSummary(incident.peakScore)}; next mod move: ${incident.responseSuggestion.label}`,
    `Post: ${incident.permalink ?? incident.postId}`,
    `Claimed by: ${handler ? formatUserHandle(handler) : 'unclaimed'}`,
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

export const saveAndRefreshIncident = async (
  incident: Incident,
  logMessage: string
) => {
  await saveIncident(incident);

  try {
    const refreshedIncident = await refreshIncident(incident);
    await saveIncident(refreshedIncident);
    return refreshedIncident;
  } catch (error) {
    logFirewatchError('incident.refresh_after_save_failed', {
      logMessage,
      postId: incident.postId,
      error,
    });
    return incident;
  }
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
        status: action.status ?? 'succeeded',
      },
      ...incident.actions,
    ].slice(0, MAX_ACTIONS),
  };
  return saveAndRefreshIncident(
    nextIncident,
    `Recorded Firewatch action but failed to refresh incident ${normalizedPostId}`
  );
};

export const startIncidentAction = async (
  postId: string,
  action: Omit<
    IncidentAction,
    'completedAt' | 'error' | 'id' | 'createdAt' | 'status'
  >
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const pendingAction: IncidentAction = {
    ...action,
    id: makeId('act'),
    createdAt: now(),
    status: 'pending',
  };
  const nextIncident: Incident = {
    ...incident,
    updatedAt: now(),
    actions: [pendingAction, ...incident.actions].slice(0, MAX_ACTIONS),
  };
  await saveIncident(nextIncident);

  return {
    actionId: pendingAction.id,
    incident: nextIncident,
  };
};

export const completeIncidentAction = async (
  postId: string,
  actionId: string,
  patch: Partial<
    Pick<
      IncidentAction,
      | 'detail'
      | 'error'
      | 'postFlairAfter'
      | 'postFlairBefore'
      | 'status'
      | 'summary'
      | 'targetIds'
    >
  >,
  logMessage: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  if (!incident.actions.some((action) => action.id === actionId)) {
    throw new Error('Action was not found');
  }

  const completedAt = now();
  const status = patch.status ?? 'succeeded';
  const nextIncident: Incident = {
    ...incident,
    updatedAt: completedAt,
    actions: incident.actions.map((action) =>
      action.id === actionId
        ? {
            ...action,
            ...patch,
            completedAt,
            status,
          }
        : action
    ),
  };

  return saveAndRefreshIncident(nextIncident, logMessage);
};

export const failIncidentAction = async (
  postId: string,
  actionId: string,
  error: unknown,
  logMessage: string,
  patch: Partial<
    Pick<IncidentAction, 'detail' | 'postFlairBefore' | 'targetIds'>
  > = {}
) => {
  const message = redditRuntimeErrorMessage(error) || 'Reddit action failed';
  return completeIncidentAction(
    postId,
    actionId,
    {
      ...patch,
      detail: patch.detail ? `${patch.detail} failed` : 'Reddit action failed',
      error: message,
      status: 'failed',
    },
    logMessage
  );
};

export const getIncidentOrThrow = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');
  return incident;
};



// Incident-level actions
type IncidentClaim = NonNullable<Incident['claim']>;

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
    logFirewatchError('incident.parse_claim_failed', {
      fallbackOwner: fallback.username,
      error,
    });
  }

  return fallback;
};

export const claimIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncident(normalizedPostId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await claimActorName();
  if (!actor) throw new Error('Could not identify the current moderator');

  const actorKey = usernameKey(actor);

  const claimedAt = now();
  if (incident.claim) {
    if (usernameKey(incident.claim.username) !== actorKey) {
      throw new Error(
        `Claimed by u/${incident.claim.username}. Ask them to unclaim before acting.`
      );
    }

    const refreshedClaim: Incident = {
      ...incident,
      claim: {
        username: incident.claim.username,
        claimedAt,
      },
      updatedAt: claimedAt,
    };
    await saveIncident(refreshedClaim);
    return refreshedClaim;
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
  if (usernameKey(storedClaim.username) !== actorKey) {
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

  if (usernameKey(incident.claim.username) !== usernameKey(actor)) {
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
  const actor = await actorName();
  const text = reminderText?.trim() || config.reminderText;
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: 'cool_down',
    actor,
    detail: 'Add sticky mod reminder',
  });
  let commentId: string | undefined;
  try {
    const post = await readRedditPost(normalizedPostId);
    const comment = await post.addComment({
      text,
    });
    commentId = comment.id;
    await comment.distinguish(true);
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Sticky mod reminder failed to record failure state for ${normalizedPostId}`,
      { detail: 'Add sticky mod reminder' }
    );
    throw error;
  }

  try {
    await upsertIncidentSignal({
      type: 'comment_create',
      source: 'firewatch_notice',
      postId: normalizedPostId,
      commentId,
      author: context.appSlug,
      body: text,
      createdAt: now(),
      metadata: {
        firewatchNotice: true,
      },
    });
  } catch (error) {
    logFirewatchWarn('incident.cooldown_signal_failed', {
      postId: normalizedPostId,
      commentId,
      error,
    });
  }

  const withAction = await completeIncidentAction(
    normalizedPostId,
    actionId,
    {
      detail: `Added sticky mod reminder ${commentId}`,
      status: 'succeeded',
      targetIds: commentId ? [commentId] : undefined,
    },
    `Posted sticky reminder but failed to refresh incident ${normalizedPostId}`
  );
  const cooldownIncident: Incident = {
    ...withAction,
    status: 'cooldown',
    updatedAt: now(),
  };

  return saveAndRefreshIncident(
    cooldownIncident,
    `Posted sticky reminder but failed to refresh incident ${normalizedPostId}`
  );
};

export const lockIncident = async (postId: string) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.lockPost) {
    throw new Error('Post locking is disabled in Settings');
  }
  const actor = await actorName();
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: 'locked',
    actor,
    detail: 'Locked post',
  });
  try {
    const post = await readRedditPost(normalizedPostId);
    await post.lock();
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Post lock failed to record failure state for ${normalizedPostId}`,
      { detail: 'Locked post' }
    );
    throw error;
  }

  return completeIncidentAction(
    normalizedPostId,
    actionId,
    { status: 'succeeded' },
    `Locked post but failed to refresh incident ${normalizedPostId}`
  );
};

export const dismissMatchedRule = async (
  postId: string,
  input: Pick<
    NonNullable<Incident['matchedRules']>[number],
    'ruleId' | 'ruleUpdatedAt' | 'targetId' | 'targetType'
  >
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await getIncidentOrThrow(normalizedPostId);
  const key = ruleMatchKey(input);
  const nextIncident: Incident = {
    ...incident,
    dismissedRuleKeys: Array.from(
      new Set([...(incident.dismissedRuleKeys ?? []), key])
    ).slice(-100),
    updatedAt: now(),
  };

  return saveAndRefreshIncident(
    nextIncident,
    `Dismissed automation match but failed to refresh incident ${normalizedPostId}`
  );
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
  const { incident, normalizedPostId } = await getRefreshedIncidentOrThrow(
    postId
  );
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
  const { incident } = await getRefreshedIncidentOrThrow(postId);
  const config = await getConfig(incident.subredditName);
  if (!config.actionControls.markResolved) {
    throw new Error('Mark resolved is disabled in Settings');
  }
  const unresolvedCount = openCommentsForReview(incident).length;
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
  const summarized: Incident = {
    ...resolved,
    summary: buildSummary(resolved),
  };

  await saveIncident(summarized);
  return summarized;
};
