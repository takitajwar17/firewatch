import { reddit } from '@devvit/web/server';
import type {
  Incident,
  NativeCommentAction,
  RuleExecutionLog,
} from '../../../shared/api';
import { addUserStrike } from '../firewatch-rules/strikes';
import { attachRuleContext } from '../firewatch-rules/matching';
import {
  getRuleExecutionLogs,
  recordRuleExecutionLog,
} from '../firewatch-rules/store';
import {
  applyNativeCommentAction,
  approveFlaggedComment,
  removeFlaggedComment,
} from './actions/comment-actions';
import { applyNativePostAction } from './actions/post-actions';
import {
  applyNativeUserAction,
  banPreparedRuleUser,
  isDemoUser,
} from './actions/user-actions';
import {
  appendAction,
  completeIncidentAction,
  coolDownIncident,
  failIncidentAction,
  getIncidentOrThrow,
  lockIncident,
  refreshIncident,
  resolveIncident,
  ruleDraftSummary,
  saveAndRefreshIncident,
  startIncidentAction,
} from './incidents';
import { actorName, getConfig, saveIncident } from './store';
import {
  formatUserHandle,
  normalizePostId,
  usernameKey,
  now,
} from '../firewatch-utils';


// Automation action runner
const AUTO_RUN_ALL_QUEUED = 'Auto-run all selected actions queued';

const requireAutomationClaim = (incident: Incident, actor: string) => {
  const claimOwner = incident.claim?.username;
  if (!claimOwner) {
    throw new Error('Claim this post before running automation actions.');
  }

  if (usernameKey(claimOwner) !== usernameKey(actor)) {
    throw new Error(
      `Claimed by u/${claimOwner}. Only that mod can run automation actions.`
    );
  }
};

const addFirewatchStrikeWithAction = async ({
  actor,
  detail,
  postId,
  reason,
  relatedCommentId,
  subredditName,
  username,
  weight,
}: {
  actor: string;
  detail: string;
  postId: string;
  reason: string;
  relatedCommentId?: string | undefined;
  subredditName: string;
  username: string;
  weight: number;
}) => {
  const normalizedPostId = normalizePostId(postId);
  const targetIds = [username];
  const { actionId } = await startIncidentAction(normalizedPostId, {
    type: 'firewatch_strike_added',
    actor,
    detail,
    targetIds,
  });

  try {
    await addUserStrike({
      createdBy: actor,
      reason,
      relatedCommentId,
      relatedPostId: normalizedPostId,
      source: 'rule_match',
      subredditName,
      username,
      weight,
    });
  } catch (error) {
    await failIncidentAction(
      normalizedPostId,
      actionId,
      error,
      `Automation Firewatch strike failed to record failure state for ${normalizedPostId}`,
      { detail, targetIds }
    );
    throw error;
  }

  return completeIncidentAction(
    normalizedPostId,
    actionId,
    { status: 'succeeded' },
    `Automation Firewatch strike succeeded but failed to refresh incident ${normalizedPostId}`
  );
};

const runPreparedPostOrCommentAction = async ({
  commentAction,
  postAction,
  postId,
  prepared,
  skippedActions,
  target,
}: {
  commentAction: {
    action: NativeCommentAction;
    reason?: string;
  };
  postAction: Parameters<typeof applyNativePostAction>[1];
  postId: string;
  prepared: NonNullable<Incident['matchedRules']>[number]['preparedActions'][number];
  skippedActions: string[];
  target: 'comment' | 'post';
}) => {
  if (target === 'post') {
    return applyNativePostAction(postId, postAction);
  }
  if (prepared.targetType !== 'comment' || !prepared.targetId) {
    skippedActions.push(`${prepared.label}: no comment target`);
    return undefined;
  }

  return applyNativeCommentAction(postId, prepared.targetId, commentAction);
};

const runAutoSafeRuleActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const autoRunLogs = logs.filter(
    (log) =>
      log.mode === 'auto_run_safe_actions' && log.executedActions.length > 0
  );
  if (autoRunLogs.length === 0) return incident;
  if (!incident.claim?.username) return incident;

  let currentIncident = incident;

  for (const log of autoRunLogs) {
    const match = currentIncident.matchedRules?.find(
      (rule) => rule.ruleId === log.ruleId && rule.targetId === log.targetId
    );
    if (!match) continue;

    for (const prepared of match.preparedActions) {
      if (prepared.risk !== 'safe') continue;

      const action = prepared.action;
      if (action.type === 'add_firewatch_strike') {
        if (!prepared.username) continue;
        currentIncident = await addFirewatchStrikeWithAction({
          actor: 'firewatch',
          detail: `Auto-ran ${match.ruleName}: added Firewatch strike to ${formatUserHandle(prepared.username)}: ${action.reason}`,
          postId: currentIncident.postId,
          reason: action.reason,
          relatedCommentId:
            prepared.targetType === 'comment' ? prepared.targetId : undefined,
          subredditName: currentIncident.subredditName,
          username: prepared.username,
          weight: action.weight ?? 1,
        });
        continue;
      }

      if (action.type === 'generate_handoff') {
        const draft = ruleDraftSummary(currentIncident, match, action.template);
        const withAction = await appendAction(currentIncident.postId, {
          type: 'rule_action_executed',
          actor: 'firewatch',
          detail: `Auto-ran ${match.ruleName}: generated draft handoff`,
          summary: draft,
        });
        currentIncident = {
          ...withAction,
          escalationSummary: draft,
          updatedAt: now(),
        };
        await saveIncident(currentIncident);
        continue;
      }

      if (
        action.type === 'save_firewatch_log' ||
        action.type === 'queue_incident'
      ) {
        currentIncident = await appendAction(currentIncident.postId, {
          type: 'rule_action_executed',
          actor: 'firewatch',
          detail:
            action.type === 'queue_incident'
              ? `Auto-ran ${match.ruleName}: queued incident because ${action.reason}`
              : `Auto-ran ${match.ruleName}: ${action.message}`,
          targetIds: [match.targetId],
        });
      }
    }
  }

  return saveAndRefreshIncident(
    currentIncident,
    `Auto-safe automation actions ran but incident ${currentIncident.postId} did not refresh`
  );
};

export const runPreparedRuleActions = async (
  postId: string,
  ruleId: string,
  actorOverride?: string,
  targetId?: string
) => {
  const normalizedPostId = normalizePostId(postId);
  const incident = await refreshIncident(
    await getIncidentOrThrow(normalizedPostId)
  );
  const match = incident.matchedRules?.find(
    (rule) =>
      rule.ruleId === ruleId && (!targetId || rule.targetId === targetId)
  );
  if (!match) throw new Error('Automation no longer matches this post');

  const actor = actorOverride ?? (await actorName());
  requireAutomationClaim(incident, actor);

  const executedActions: string[] = [];
  const skippedActions: string[] = [];
  let currentIncident = incident;
  const existingLogs = await getRuleExecutionLogs(
    currentIncident.subredditName
  );
  const alreadyExecuted = new Set(
    existingLogs
      .filter(
        (log) =>
          log.ruleId === match.ruleId &&
          log.ruleUpdatedAt === match.ruleUpdatedAt &&
          log.targetId === match.targetId &&
          log.matchedConditions.join('|') === match.why.join('|') &&
          log.preparedActions.join('|') ===
            match.preparedActions.map((action) => action.label).join('|')
      )
      .flatMap((log) => log.executedActions)
  );

  for (const [preparedIndex, prepared] of match.preparedActions.entries()) {
    const action = prepared.action;

    try {
      if (alreadyExecuted.has(prepared.label)) {
        skippedActions.push(`${prepared.label}: already executed`);
        continue;
      }

      if (action.type === 'sticky_reminder') {
        currentIncident = await coolDownIncident(normalizedPostId, action.text);
        executedActions.push(prepared.label);
        continue;
      }

    if (action.type === 'prepare_temp_ban') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      currentIncident = await banPreparedRuleUser({
        contextId: prepared.targetId,
        durationDays: action.durationDays,
        postId: normalizedPostId,
        reason: action.reason,
        username: prepared.username,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'prepare_permanent_ban') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      currentIncident = await banPreparedRuleUser({
        contextId: prepared.targetId,
        postId: normalizedPostId,
        reason: action.reason,
        username: prepared.username,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'remove_comment') {
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await removeFlaggedComment(
        normalizedPostId,
        prepared.targetId,
        action.reason
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'approve_comment') {
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await approveFlaggedComment(
        normalizedPostId,
        prepared.targetId
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'remove_post') {
      currentIncident = await applyNativePostAction(normalizedPostId, {
        action: 'remove',
        reason: action.reason,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'approve_post') {
      currentIncident = await applyNativePostAction(normalizedPostId, {
        action: 'approve',
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'mark_spam') {
      const updatedIncident = await runPreparedPostOrCommentAction({
        commentAction: {
          action: 'spam',
          reason: `Marked by automation: ${match.ruleName}`,
        },
        postAction: {
          action: 'spam',
          reason: `Marked by automation: ${match.ruleName}`,
        },
        postId: normalizedPostId,
        prepared,
        skippedActions,
        target: action.target,
      });
      if (updatedIncident) {
        currentIncident = updatedIncident;
        executedActions.push(prepared.label);
      }
      continue;
    }

    if (action.type === 'lock_post') {
      currentIncident = await lockIncident(normalizedPostId);
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'set_post_flair') {
      currentIncident = await applyNativePostAction(normalizedPostId, {
        action: 'set-flair',
        flairText: action.flairText,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'ignore_reports') {
      const updatedIncident = await runPreparedPostOrCommentAction({
        commentAction: {
          action: 'ignore-reports',
        },
        postAction: {
          action: 'ignore-reports',
        },
        postId: normalizedPostId,
        prepared,
        skippedActions,
        target: action.target,
      });
      if (updatedIncident) {
        currentIncident = updatedIncident;
        executedActions.push(prepared.label);
      }
      continue;
    }

    if (action.type === 'mute_user') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      const muteReason = action.durationDays
        ? `${action.reason} Requested duration: ${action.durationDays} day${
            action.durationDays === 1 ? '' : 's'
          }.`
        : action.reason;
      currentIncident = await applyNativeUserAction(
        normalizedPostId,
        prepared.username,
        {
          action: 'mute',
          note: muteReason,
          reason: muteReason,
        }
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'mark_resolved') {
      currentIncident = await resolveIncident(normalizedPostId);
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'add_firewatch_strike') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      currentIncident = await addFirewatchStrikeWithAction({
        actor,
        detail: `Added Firewatch strike to ${formatUserHandle(prepared.username)}: ${action.reason}`,
        postId: normalizedPostId,
        reason: action.reason,
        relatedCommentId:
          prepared.targetType === 'comment' ? prepared.targetId : undefined,
        subredditName: currentIncident.subredditName,
        username: prepared.username,
        weight: action.weight ?? 1,
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'add_native_mod_note') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      const detail = `Added Reddit mod note for ${formatUserHandle(prepared.username)} from ${match.ruleName}`;
      const { actionId } = await startIncidentAction(normalizedPostId, {
        type: 'mod_note_added',
        actor,
        detail,
        targetIds: [prepared.username],
      });
      try {
        if (!isDemoUser(currentIncident, prepared.username)) {
          await reddit.addModNote({
            label: 'SPAM_WATCH',
            note: action.note.slice(0, 250),
            redditId: normalizedPostId,
            subreddit: currentIncident.subredditName,
            user: prepared.username,
          });
        }
      } catch (error) {
        await failIncidentAction(
          normalizedPostId,
          actionId,
          error,
          `Automation mod note failed to record failure state for ${normalizedPostId}`,
          { detail, targetIds: [prepared.username] }
        );
        throw error;
      }
      currentIncident = await completeIncidentAction(
        normalizedPostId,
        actionId,
        { status: 'succeeded' },
        `Automation mod note succeeded but failed to refresh incident ${normalizedPostId}`
      );
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'generate_handoff') {
      const draft = ruleDraftSummary(currentIncident, match, action.template);
      const withAction = await appendAction(normalizedPostId, {
        type: 'rule_action_executed',
        actor,
        detail: `Generated draft handoff from ${match.ruleName}`,
        summary: draft,
      });
      currentIncident = {
        ...withAction,
        escalationSummary: draft,
        updatedAt: now(),
      };
      await saveIncident(currentIncident);
      executedActions.push(prepared.label);
      continue;
    }

    if (
      action.type === 'save_firewatch_log' ||
      action.type === 'queue_incident'
    ) {
      currentIncident = await appendAction(normalizedPostId, {
        type: 'rule_action_executed',
        actor,
        detail:
          action.type === 'queue_incident'
            ? `Queued by automation: ${action.reason}`
            : action.message,
        targetIds: [match.targetId],
      });
      executedActions.push(prepared.label);
      continue;
    }

      skippedActions.push(`${prepared.label}: left for mod review`);
    } catch (error) {
      skippedActions.push(
        `${prepared.label}: ${ruleAutomationErrorMessage(error)}`
      );
      for (const remaining of match.preparedActions.slice(preparedIndex + 1)) {
        skippedActions.push(
          `${remaining.label}: skipped after earlier action failed`
        );
      }
      break;
    }
  }

  await recordRuleExecutionLog(
    {
      ruleId: match.ruleId,
      ruleName: match.ruleName,
      ruleUpdatedAt: match.ruleUpdatedAt,
      triggerType: 'prepared_actions_run',
      targetType: match.targetType,
      targetId: match.targetId,
      matchedConditions: match.why,
      preparedActions: match.preparedActions.map((action) => action.label),
      executedActions,
      skippedActions,
      mode: match.mode,
      actor,
    },
    currentIncident.subredditName
  );
  const config = await getConfig(currentIncident.subredditName);
  const refreshedIncident = await saveAndRefreshIncident(
    currentIncident,
    `Prepared automation actions ran but incident ${normalizedPostId} did not refresh`
  );
  const withRuleContext = await attachRuleContext(refreshedIncident, config);
  await saveIncident(withRuleContext);

  return withRuleContext;
};

const ruleAutomationErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown automation action failure';

const runAutoAllRuleActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const autoRunLogs = logs.filter(
    (log) =>
      log.mode === 'auto_run_all_selected_actions' &&
      log.skippedActions.includes(AUTO_RUN_ALL_QUEUED)
  );
  if (autoRunLogs.length === 0) return incident;

  let currentIncident = incident;

  for (const log of autoRunLogs) {
    const actor = currentIncident.claim?.username;
    try {
      if (!actor) {
        throw new Error('Claim this post before auto-running automation actions.');
      }
      currentIncident = await runPreparedRuleActions(
        currentIncident.postId,
        log.ruleId,
        actor,
        log.targetId
      );
    } catch (error) {
      await recordRuleExecutionLog(
        {
          ruleId: log.ruleId,
          ruleName: log.ruleName,
          ruleUpdatedAt: log.ruleUpdatedAt,
          triggerType: 'auto_run_all_failed',
          targetType: log.targetType,
          targetId: log.targetId,
          matchedConditions: log.matchedConditions,
          preparedActions: log.preparedActions,
          executedActions: [],
          skippedActions: [ruleAutomationErrorMessage(error)],
          mode: log.mode,
          actor: actor ?? 'firewatch',
        },
        currentIncident.subredditName
      );
    }
  }

  return currentIncident;
};

export const runRuleAutomationActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const withAutoSafe = await runAutoSafeRuleActions(incident, logs);
  return runAutoAllRuleActions(withAutoSafe, logs);
};
