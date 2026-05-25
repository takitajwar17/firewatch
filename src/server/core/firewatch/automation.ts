import { reddit } from '@devvit/web/server';
import type { Incident, RuleExecutionLog } from '../../../shared/api';
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
  coolDownIncident,
  getIncidentOrThrow,
  lockIncident,
  refreshIncident,
  resolveIncident,
  ruleDraftSummary,
} from './incidents';
import { actorName, getConfig, saveIncident } from './store';
import { formatUserHandle, normalizePostId, now } from '../firewatch-utils';


// Automation action runner
const runAutoSafeRuleActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const autoRunLogs = logs.filter(
    (log) =>
      log.mode === 'auto_run_safe_actions' && log.executedActions.length > 0
  );
  if (autoRunLogs.length === 0) return incident;

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
        await addUserStrike({
          createdBy: 'firewatch',
          reason: action.reason,
          relatedCommentId:
            prepared.targetType === 'comment' ? prepared.targetId : undefined,
          relatedPostId: normalizePostId(currentIncident.postId),
          source: 'rule_match',
          subredditName: currentIncident.subredditName,
          username: prepared.username,
          weight: action.weight ?? 1,
        });
        currentIncident = await appendAction(currentIncident.postId, {
          type: 'firewatch_strike_added',
          actor: 'firewatch',
          detail: `Auto-ran ${match.ruleName}: added Firewatch strike to ${formatUserHandle(prepared.username)}: ${action.reason}`,
          targetIds: [prepared.username],
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

  const refreshedIncident = await refreshIncident(currentIncident);
  await saveIncident(refreshedIncident);
  return refreshedIncident;
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
  if (!match) throw new Error('Response rule no longer matches this incident');

  const actor = actorOverride ?? (await actorName());
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
          log.targetId === match.targetId &&
          log.matchedConditions.join('|') === match.why.join('|') &&
          log.preparedActions.join('|') ===
            match.preparedActions.map((action) => action.label).join('|')
      )
      .flatMap((log) => log.executedActions)
  );

  for (const prepared of match.preparedActions) {
    const action = prepared.action;

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
      if (action.target === 'post') {
        currentIncident = await applyNativePostAction(normalizedPostId, {
          action: 'spam',
          reason: `Marked by automation: ${match.ruleName}`,
        });
        executedActions.push(prepared.label);
        continue;
      }
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await applyNativeCommentAction(
        normalizedPostId,
        prepared.targetId,
        {
          action: 'spam',
          reason: `Marked by automation: ${match.ruleName}`,
        }
      );
      executedActions.push(prepared.label);
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
      if (action.target === 'post') {
        currentIncident = await applyNativePostAction(normalizedPostId, {
          action: 'ignore-reports',
        });
        executedActions.push(prepared.label);
        continue;
      }
      if (!prepared.targetId || prepared.targetType !== 'comment') {
        skippedActions.push(`${prepared.label}: no comment target`);
        continue;
      }
      currentIncident = await applyNativeCommentAction(
        normalizedPostId,
        prepared.targetId,
        {
          action: 'ignore-reports',
        }
      );
      executedActions.push(prepared.label);
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

    if (action.type === 'mark_handled') {
      currentIncident = await resolveIncident(normalizedPostId);
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'add_firewatch_strike') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      await addUserStrike({
        createdBy: actor,
        reason: action.reason,
        relatedCommentId:
          prepared.targetType === 'comment' ? prepared.targetId : undefined,
        relatedPostId: normalizedPostId,
        source: 'rule_match',
        subredditName: currentIncident.subredditName,
        username: prepared.username,
        weight: action.weight ?? 1,
      });
      currentIncident = await appendAction(normalizedPostId, {
        type: 'firewatch_strike_added',
        actor,
        detail: `Added Firewatch strike to ${formatUserHandle(prepared.username)}: ${action.reason}`,
        targetIds: [prepared.username],
      });
      executedActions.push(prepared.label);
      continue;
    }

    if (action.type === 'add_native_mod_note') {
      if (!prepared.username) {
        skippedActions.push(`${prepared.label}: no user target`);
        continue;
      }
      if (!isDemoUser(currentIncident, prepared.username)) {
        await reddit.addModNote({
          label: 'SPAM_WATCH',
          note: action.note.slice(0, 250),
          redditId: normalizedPostId,
          subreddit: currentIncident.subredditName,
          user: prepared.username,
        });
      }
      currentIncident = await appendAction(normalizedPostId, {
        type: 'mod_note_added',
        actor,
        detail: `Added Reddit mod note for ${formatUserHandle(prepared.username)} from ${match.ruleName}`,
        targetIds: [prepared.username],
      });
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
  }

  await recordRuleExecutionLog({
    ruleId: match.ruleId,
    ruleName: match.ruleName,
    triggerType: 'prepared_actions_run',
    targetType: match.targetType,
    targetId: match.targetId,
    matchedConditions: match.why,
    preparedActions: match.preparedActions.map((action) => action.label),
    executedActions,
    skippedActions,
    mode: match.mode,
    actor,
  });
  const config = await getConfig(currentIncident.subredditName);
  const refreshedIncident = await attachRuleContext(
    await refreshIncident(currentIncident),
    config
  );
  await saveIncident(refreshedIncident);

  return refreshedIncident;
};

const ruleAutomationErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown automation action failure';

const runAutoAllRuleActions = async (
  incident: Incident,
  logs: RuleExecutionLog[]
) => {
  const autoRunLogs = logs.filter(
    (log) => log.mode === 'auto_run_all_selected_actions'
  );
  if (autoRunLogs.length === 0) return incident;

  let currentIncident = incident;

  for (const log of autoRunLogs) {
    try {
      currentIncident = await runPreparedRuleActions(
        currentIncident.postId,
        log.ruleId,
        'firewatch',
        log.targetId
      );
    } catch (error) {
      await recordRuleExecutionLog({
        ruleId: log.ruleId,
        ruleName: log.ruleName,
        triggerType: 'auto_run_all_failed',
        targetType: log.targetType,
        targetId: log.targetId,
        matchedConditions: log.matchedConditions,
        preparedActions: log.preparedActions,
        executedActions: [],
        skippedActions: [ruleAutomationErrorMessage(error)],
        mode: log.mode,
        actor: 'firewatch',
      });
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
