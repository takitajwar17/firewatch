import type {
  FirewatchConfig,
  FirewatchRule,
  Incident,
  MatchedAutomationRule,
  RuleCondition,
  RuleExecutionLog,
  RuleMode,
  RuleScope,
  RuleTestResponse,
  RuleTrigger,
  UserStrikeSummary,
} from '../../../shared/api';
import { firewatchRatingSummary } from '../../../shared/firewatch-rating.js';
import {
  preparedRuleAction,
  ruleTriggerTypeForSignal,
} from '../../../shared/automation-rules';
import { isCommentOpenForReview } from '../../../shared/incidents';
import { linkCount, textContainsTerm } from '../firewatch-detection';
import {
  normalizeCommentId,
  normalizeParentId,
  usernameKey,
} from '../firewatch-utils';
import { currentIso } from './common';
import {
  compareConditionValue,
  inWindow,
  removedCommentCountForUser,
  reportCountInWindow,
  watchedDomainHits,
  watchedWordHits,
} from './metrics';
import {
  approvedUsernames,
  getModeratorUsernames,
  isAutoModerator,
  isIgnoredAuthor,
  postFlairAllowed,
  signalText,
} from './scope';
import {
  getAutomations,
  getRuleExecutionLogs,
  recordRuleExecutionLog,
} from './store';
import { getUserStrikeSummaries } from './strikes';
import { logFirewatchWarn } from '../firewatch/logging';

const triggerTypesForIncident = (incident: Incident) => {
  const triggerTypes = new Set(
    incident.recentSignals.map((signal) => ruleTriggerTypeForSignal(signal))
  );
  if (triggerTypes.size === 0) triggerTypes.add('incident_score_changed');
  return triggerTypes;
};

const AUTO_RUN_CLAIM_REQUIRED =
  'Waiting for a moderator claim before auto-running actions';

export const ruleMatchKey = (
  match: Pick<
    MatchedAutomationRule,
    'ruleId' | 'ruleUpdatedAt' | 'targetId' | 'targetType'
  >
) =>
  `${match.ruleId}:${match.ruleUpdatedAt ?? ''}:${match.targetType}:${match.targetId}`;

const shouldSkipRuleForUnverifiedModeratorScope = (
  rule: FirewatchRule,
  moderatorScopeVerified: boolean
) => rule.enabled && rule.scope.excludeModerators && !moderatorScopeVerified;

type Candidate = {
  targetId: string;
  targetType: MatchedAutomationRule['targetType'];
  text: string;
  username?: string;
};

const candidateUsers = (
  incident: Incident,
  moderatorUsers: Set<string>,
  scope: RuleScope,
  strikeSummaries: UserStrikeSummary[]
) => {
  const users = new Map<string, Candidate>();
  const approvedUsers = approvedUsernames(incident);
  for (const user of incident.involvedUsers) {
    const userKey = usernameKey(user.username);
    if (!userKey) continue;
    if (isIgnoredAuthor(user.username, scope.ignoredAuthors)) continue;
    if (scope.excludeModerators && moderatorUsers.has(userKey)) {
      continue;
    }
    if (scope.excludeAutoModerator && isAutoModerator(user.username)) continue;
    if (scope.excludeApprovedUsers && approvedUsers.has(userKey)) {
      continue;
    }
    users.set(userKey, {
      targetId: user.username,
      targetType: 'user',
      text: signalText(
        incident,
        scope,
        moderatorUsers,
        (signal) => usernameKey(signal.author) === usernameKey(user.username)
      ),
      username: user.username,
    });
  }
  for (const summary of strikeSummaries) {
    const summaryKey = usernameKey(summary.username);
    if (!summaryKey) continue;
    if (isIgnoredAuthor(summary.username, scope.ignoredAuthors)) continue;
    if (scope.excludeModerators && moderatorUsers.has(summaryKey)) {
      continue;
    }
    if (scope.excludeAutoModerator && isAutoModerator(summary.username)) {
      continue;
    }
    if (scope.excludeApprovedUsers && approvedUsers.has(summaryKey)) {
      continue;
    }
    users.set(summaryKey, {
      targetId: summary.username,
      targetType: 'user',
      text: signalText(
        incident,
        scope,
        moderatorUsers,
        (signal) =>
          usernameKey(signal.author) === usernameKey(summary.username)
      ),
      username: summary.username,
    });
  }
  return Array.from(users.values());
};

const candidatesForRule = (
  rule: FirewatchRule,
  incident: Incident,
  moderatorUsers: Set<string>,
  strikeSummaries: UserStrikeSummary[]
): Candidate[] => {
  if (!postFlairAllowed(incident, rule.scope)) return [];

  if (rule.scope.target === 'comment') {
    const approvedUsers = approvedUsernames(incident);
    return incident.flaggedComments
      .filter((comment) => {
        const commentAuthorKey = usernameKey(comment.author);
        if (!isCommentOpenForReview(comment)) return false;
        if (isIgnoredAuthor(comment.author, rule.scope.ignoredAuthors)) {
          return false;
        }
        if (
          rule.scope.excludeModerators &&
          commentAuthorKey &&
          moderatorUsers.has(commentAuthorKey)
        ) {
          return false;
        }
        if (rule.scope.excludeAutoModerator && isAutoModerator(comment.author)) {
          return false;
        }
        if (
          rule.scope.excludeApprovedUsers &&
          commentAuthorKey &&
          approvedUsers.has(commentAuthorKey)
        ) {
          return false;
        }
        if (
          rule.scope.commentAuthors?.length &&
          !rule.scope.commentAuthors.some(
            (author) => usernameKey(author) === commentAuthorKey
          )
        ) {
          return false;
        }
        return true;
      })
      .map((comment) => ({
        targetId: normalizeCommentId(comment.id),
        targetType: 'comment',
        text:
          signalText(
            incident,
            rule.scope,
            moderatorUsers,
            (signal) =>
              signal.commentId
                ? normalizeCommentId(signal.commentId) ===
                  normalizeCommentId(comment.id)
                : false
          ) || comment.body,
        username: comment.author,
      }));
  }

  if (rule.scope.target === 'user') {
    return candidateUsers(
      incident,
      moderatorUsers,
      rule.scope,
      strikeSummaries
    );
  }

  const postText = signalText(
    incident,
    rule.scope,
    moderatorUsers,
    (signal) =>
      signal.type === 'post_create' ||
      signal.type === 'post_update' ||
      signal.type === 'post_report' ||
      !signal.commentId
  );

  return [
    {
      targetId: incident.postId,
      targetType: rule.scope.target,
      text:
        rule.scope.target === 'incident'
          ? signalText(incident, rule.scope, moderatorUsers) || incident.title
          : postText || incident.title,
    },
  ];
};

const textConditionReason = (
  condition: Extract<RuleCondition, { type: 'text_contains' }>,
  text: string
) => {
  if (!textContainsTerm({ ...condition, text })) return undefined;
  return condition.match === 'regex'
    ? `text matched /${condition.value}/`
    : condition.match === 'exact'
      ? `text contains exact phrase "${condition.value}"`
      : `text contains "${condition.value}"`;
};

const replyClusterCount = ({
  candidate,
  condition,
  incident,
}: {
  candidate: Candidate;
  condition: Extract<RuleCondition, { type: 'reply_cluster' }>;
  incident: Incident;
}) => {
  const openCommentIds = new Set(
    incident.flaggedComments
      .filter(isCommentOpenForReview)
      .map((comment) => normalizeCommentId(comment.id))
  );
  const branchCounts = new Map<string, Set<string>>();

  for (const signal of incident.recentSignals) {
    if (
      signal.type !== 'comment_create' ||
      !signal.commentId ||
      !signal.parentId ||
      !openCommentIds.has(normalizeCommentId(signal.commentId)) ||
      !inWindow(signal.createdAt, condition.windowMinutes)
    ) {
      continue;
    }

    const parentId = normalizeParentId(signal.parentId, incident.postId);
    if (!parentId) continue;
    const comments = branchCounts.get(parentId) ?? new Set<string>();
    comments.add(normalizeCommentId(signal.commentId));
    branchCounts.set(parentId, comments);
  }

  if (candidate.targetType === 'comment') {
    return branchCounts.get(normalizeCommentId(candidate.targetId))?.size ?? 0;
  }

  return Math.max(0, ...Array.from(branchCounts.values()).map((ids) => ids.size));
};

const conditionReason = ({
  candidate,
  condition,
  config,
  incident,
  strikeSummary,
}: {
  candidate: Candidate;
  condition: RuleCondition;
  config: FirewatchConfig;
  incident: Incident;
  strikeSummary: UserStrikeSummary | undefined;
}) => {
  if (condition.type === 'text_contains') {
    return textConditionReason(condition, candidate.text);
  }
  if (condition.type === 'watched_word_hit') {
    const hits = watchedWordHits(candidate.text, config.keywords);
    return hits >= condition.minHits
      ? `${hits} watched word hit${hits === 1 ? '' : 's'}`
      : undefined;
  }
  if (condition.type === 'watched_domain_hit') {
    const domains = condition.domains?.length
      ? condition.domains
      : config.suspiciousDomains;
    const hits = watchedDomainHits(candidate.text, domains);
    return hits >= condition.minHits
      ? `${hits} watched domain hit${hits === 1 ? '' : 's'}`
      : undefined;
  }
  if (condition.type === 'has_link') {
    const hits = linkCount(candidate.text);
    return hits >= condition.minLinks
      ? `${hits} link${hits === 1 ? '' : 's'} found`
      : undefined;
  }
  if (condition.type === 'user_strikes') {
    const count = strikeSummary?.strikeCount ?? 0;
    return compareConditionValue({
      actual: count,
      expected: condition.value,
      label: 'Firewatch strikes',
      operator: condition.operator,
    });
  }
  if (condition.type === 'user_removed_comments') {
    const count = candidate.username
      ? removedCommentCountForUser(
          incident,
          candidate.username,
          condition.windowMinutes
        )
      : 0;
    return compareConditionValue({
      actual: count,
      expected: condition.value,
      label: 'removed comments',
      operator: condition.operator,
    });
  }
  if (condition.type === 'post_reports') {
    const count = reportCountInWindow(incident, condition.windowMinutes);
    return compareConditionValue({
      actual: count,
      expected: condition.value,
      label: 'reports',
      operator: condition.operator,
    });
  }
  if (condition.type === 'incident_score') {
    const match = compareConditionValue({
      actual: incident.score,
      expected: condition.value,
      label: 'Firewatch score',
      operator: condition.operator,
    });
    return match
      ? `Firewatch rating ${condition.operator} ${firewatchRatingSummary(condition.value)}`
      : undefined;
  }
  if (condition.type === 'repeated_phrase') {
    const maxMatches = Math.max(
      0,
      ...incident.repeatedPhrases.map((phrase) => phrase.count)
    );
    return maxMatches >= condition.minMatches
      ? `${maxMatches} repeated phrase matches`
      : undefined;
  }

  const clusteredComments = replyClusterCount({ candidate, condition, incident });
  return clusteredComments >= condition.minComments
    ? `${clusteredComments} open comments in one reply cluster`
    : undefined;
};

const strikeSummaryForCandidate = (
  candidate: Candidate,
  summaries: UserStrikeSummary[]
) =>
  candidate.username
    ? summaries.find(
        (summary) =>
          usernameKey(summary.username) === usernameKey(candidate.username)
      )
    : undefined;

const counterReason = ({
  candidate,
  config,
  incident,
  rule,
  strikeSummary,
}: {
  candidate: Candidate;
  config: FirewatchConfig;
  incident: Incident;
  rule: FirewatchRule;
  strikeSummary: UserStrikeSummary | undefined;
}) => {
  const counter = rule.counter;
  if (!counter) return undefined;

  const windowedSignals = incident.recentSignals.filter((signal) =>
    inWindow(signal.createdAt, counter.windowMinutes)
  );
  const count =
    counter.countBy === 'user'
      ? (strikeSummary?.strikeCount ?? 0)
      : counter.countBy === 'post'
        ? windowedSignals.filter((signal) => signal.postId === incident.postId)
            .length
        : counter.countBy === 'thread'
          ? candidate.targetType === 'comment'
            ? windowedSignals.filter(
                (signal) =>
                  normalizeParentId(signal.parentId, incident.postId) ===
                  candidate.targetId
              ).length
            : windowedSignals.filter(
                (signal) => signal.postId === incident.postId
              ).length
          : counter.countBy === 'domain'
            ? watchedDomainHits(candidate.text, config.suspiciousDomains)
            : Math.max(
                0,
                ...incident.repeatedPhrases.map((phrase) => phrase.count)
              );

  return count >= counter.threshold
    ? `${counter.countBy} counter ${count}/${counter.threshold}`
    : undefined;
};

const matchRule = ({
  config,
  effectiveTriggerTypes,
  incident,
  rule,
  strikeSummaries,
  moderatorUsers,
}: {
  config: FirewatchConfig;
  effectiveTriggerTypes: Set<RuleTrigger['type']>;
  incident: Incident;
  rule: FirewatchRule;
  strikeSummaries: UserStrikeSummary[];
  moderatorUsers: Set<string>;
}): MatchedAutomationRule[] => {
  if (!rule.enabled) return [];
  if (!effectiveTriggerTypes.has(rule.trigger.type)) return [];

  const matches: MatchedAutomationRule[] = [];
  for (const candidate of candidatesForRule(
    rule,
    incident,
    moderatorUsers,
    strikeSummaries
  )) {
    const strikeSummary = strikeSummaryForCandidate(candidate, strikeSummaries);
    const why: string[] = [];
    let matched = true;

    for (const condition of rule.conditions) {
      const reason = conditionReason({
        candidate,
        condition,
        config,
        incident,
        strikeSummary,
      });
      if (!reason) {
        matched = false;
        break;
      }
      why.push(reason);
    }

    if (!matched) continue;

    const counter = counterReason({
      candidate,
      config,
      incident,
      rule,
      strikeSummary,
    });
    if (rule.counter && !counter) continue;
    if (counter) why.push(counter);

    matches.push({
      id: `${rule.id}:${candidate.targetId}`,
      ruleId: rule.id,
      ruleName: rule.name,
      ruleUpdatedAt: rule.updatedAt,
      mode: rule.mode,
      matchedAt: currentIso(),
      targetId: candidate.targetId,
      targetType: candidate.targetType,
      ...(candidate.username ? { username: candidate.username } : {}),
      why,
      preparedActions: rule.actions.map((action, index) =>
        preparedRuleAction({
          action,
          id: `${rule.id}:${candidate.targetId}:${index}`,
          targetId: candidate.targetId,
          targetType: candidate.targetType,
          username: candidate.username,
        })
      ),
    });
  }

  return matches;
};

export const matchIncidentAutomations = async ({
  config,
  incident,
  triggerType,
}: {
  config: FirewatchConfig;
  incident: Incident;
  triggerType?: RuleTrigger['type'];
}) => {
  const [rules, strikeSummaries] = await Promise.all([
    getAutomations(incident.subredditName),
    getUserStrikeSummaries(incident),
  ]);
  const effectiveTriggerTypes = triggerType
    ? new Set<RuleTrigger['type']>([triggerType])
    : triggerTypesForIncident(incident);
  const moderatorScope = await getModeratorUsernames(incident, rules);
  const matches = rules
    .flatMap((rule) => {
      if (
        shouldSkipRuleForUnverifiedModeratorScope(
          rule,
          moderatorScope.verified
        )
      ) {
        logFirewatchWarn('automation.scope_moderators_unverified', {
          ruleId: rule.id,
          subredditName: incident.subredditName,
        });
        return [];
      }

      return matchRule({
        config,
        effectiveTriggerTypes,
        incident,
        rule,
        strikeSummaries,
        moderatorUsers: moderatorScope.usernames,
      });
    })
    .filter((match): match is MatchedAutomationRule => Boolean(match));

  return { matches, strikeSummaries };
};

export const attachRuleContext = async (
  incident: Incident,
  config: FirewatchConfig
): Promise<Incident> => {
  const { matches, strikeSummaries } = await matchIncidentAutomations({
    config,
    incident,
  });
  const previousMatchedAt = new Map(
    (incident.matchedRules ?? []).map((match) => [
      ruleMatchKey(match),
      match.matchedAt,
    ])
  );
  const hiddenRuleMatchKeys = new Set(incident.hiddenRuleMatchKeys ?? []);

  return {
    ...incident,
    matchedRules: matches
      .filter((match) => !hiddenRuleMatchKeys.has(ruleMatchKey(match)))
      .map((match) => ({
        ...match,
        matchedAt: previousMatchedAt.get(ruleMatchKey(match)) ?? match.matchedAt,
      })),
    userStrikeSummaries: strikeSummaries,
  };
};

export const recordRuleMatches = async ({
  actor = 'firewatch',
  config,
  incident,
  modeOverride,
  triggerType,
}: {
  actor?: 'firewatch' | string;
  config: FirewatchConfig;
  incident: Incident;
  modeOverride?: RuleMode;
  triggerType: RuleTrigger['type'];
}) => {
  const latestSignal = incident.recentSignals[0];
  if (
    latestSignal?.source === 'firewatch_notice' &&
    ruleTriggerTypeForSignal(latestSignal) === triggerType
  ) {
    return [];
  }

  const { matches } = await matchIncidentAutomations({
    config,
    incident,
    triggerType,
  });
  const existingLogs = await getRuleExecutionLogs(incident.subredditName);
  const newLogs: RuleExecutionLog[] = [];

  for (const match of matches) {
    const mode = modeOverride ?? match.mode;
    const incidentClaimed = Boolean(incident.claim?.username);
    const alreadyLogged = existingLogs.some((log) => {
      const sameMatch =
        log.ruleId === match.ruleId &&
        log.ruleUpdatedAt === match.ruleUpdatedAt &&
        log.targetId === match.targetId &&
        log.triggerType === triggerType &&
        log.mode === mode &&
        log.matchedConditions.join('|') === match.why.join('|') &&
        log.preparedActions.join('|') ===
          match.preparedActions.map((action) => action.label).join('|');
      if (!sameMatch) return false;

      return !(
        incidentClaimed &&
        log.skippedActions.includes(AUTO_RUN_CLAIM_REQUIRED)
      );
    });
    if (alreadyLogged) continue;

    const executedActions: string[] = [];
    const skippedActions: string[] = [];
    if (mode === 'auto_run_safe_actions') {
      if (!incident.claim?.username) {
        skippedActions.push(AUTO_RUN_CLAIM_REQUIRED);
      } else {
        for (const action of match.preparedActions) {
          if (action.risk === 'safe') executedActions.push(action.label);
          else skippedActions.push(`${action.label} requires mod approval`);
        }
      }
    } else if (mode === 'auto_run_all_selected_actions') {
      skippedActions.push(
        incident.claim?.username
          ? 'Auto-run all selected actions queued'
          : AUTO_RUN_CLAIM_REQUIRED
      );
    } else if (mode === 'suggest_only' || mode === 'prepare_for_approval') {
      skippedActions.push('Waiting for moderator approval');
    }

    newLogs.push(
      await recordRuleExecutionLog(
        {
          ruleId: match.ruleId,
          ruleName: match.ruleName,
          ruleUpdatedAt: match.ruleUpdatedAt,
          triggerType,
          targetType: match.targetType,
          targetId: match.targetId,
          matchedConditions: match.why,
          preparedActions: match.preparedActions.map((action) => action.label),
          executedActions,
          skippedActions,
          mode,
          actor,
        },
        incident.subredditName
      )
    );
  }

  return newLogs;
};

export const testAutomation = async ({
  config,
  incidents,
  ruleId,
}: {
  config: FirewatchConfig;
  incidents: Incident[];
  ruleId: string;
}): Promise<RuleTestResponse> => {
  const rules = await getAutomations();
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error('Rule not found');

  const examples: { label: string; detail: string }[] = [];
  const preparedActions = new Set<string>();

  for (const incident of incidents) {
    const strikeSummaries = await getUserStrikeSummaries(incident);
    const moderatorScope = await getModeratorUsernames(incident, [rule]);
    if (
      shouldSkipRuleForUnverifiedModeratorScope(rule, moderatorScope.verified)
    ) {
      logFirewatchWarn('automation.test_scope_moderators_unverified', {
        ruleId: rule.id,
        subredditName: incident.subredditName,
      });
      continue;
    }
    const matches = matchRule({
      config,
      effectiveTriggerTypes: new Set<RuleTrigger['type']>([rule.trigger.type]),
      incident,
      rule,
      strikeSummaries,
      moderatorUsers: moderatorScope.usernames,
    });

    for (const match of matches) {
      examples.push({
        label:
          match.username ??
          (match.targetType === 'incident' ? incident.title : match.targetId),
        detail: match.why.join(' • '),
      });
      for (const action of match.preparedActions) {
        preparedActions.add(action.label);
      }
    }
  }

  return {
    type: 'rule-test',
    ruleId: rule.id,
    ruleName: rule.name,
    matchedCount: examples.length,
    examples: examples.slice(0, 3),
    preparedActions: Array.from(preparedActions),
  };
};
