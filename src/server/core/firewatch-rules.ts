import { context, redis } from '@devvit/web/server';
import type {
  FirewatchConfig,
  FirewatchRule,
  FirewatchRuleInput,
  Incident,
  MatchedResponseRule,
  RuleCondition,
  RuleExecutionLog,
  RuleMode,
  RuleTestResponse,
  RuleScope,
  UserStrike,
  UserStrikeSummary,
} from '../../shared/api';
import {
  defaultRuleScope,
  defaultRuleTemplates,
  preparedRuleAction,
} from '../../shared/response-rules';
import {
  makeId,
  normalizeCommentId,
  normalizePostId,
  normalizeUsername,
  now,
  retentionExpiration,
} from './firewatch-utils';

const MAX_RULE_LOGS = 80;
const MAX_STRIKES_PER_USER = 100;
const DEFAULT_STRIKE_WINDOW_DAYS = 7;
const LINK_PATTERN = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})(?:\S*)/gi;

export const responseRulesKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:rules`;
export const ruleLogsKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:rule_logs`;
export const userStrikesKey = (subredditName: string, username: string) =>
  `fw:user:${subredditName}:${username.toLowerCase()}:strikes`;

const currentIso = () => new Date(now()).toISOString();

const compare = (
  actual: number,
  operator: '>=' | '>' | '=',
  expected: number
) => {
  if (operator === '>') return actual > expected;
  if (operator === '=') return actual === expected;
  return actual >= expected;
};

const parseJsonList = <Item>(stored: string | undefined): Item[] => {
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Item => Boolean(item))
      : [];
  } catch {
    return [];
  }
};

const templateRules = (subredditName: string) =>
  defaultRuleTemplates({
    createdAt: currentIso(),
    createdBy: 'firewatch',
    subredditId: subredditName,
  });

export const getResponseRules = async (
  subredditName = context.subredditName
) => {
  const stored = parseJsonList<FirewatchRule>(
    await redis.get(responseRulesKey(subredditName))
  );

  return stored.length > 0 ? stored : templateRules(subredditName);
};

const saveResponseRules = async (
  subredditName: string,
  rules: FirewatchRule[]
) => {
  await redis.set(responseRulesKey(subredditName), JSON.stringify(rules), {
    expiration: retentionExpiration(),
  });
};

const normalizeRuleScope = (
  input: RuleScope | undefined,
  subredditName: string
): RuleScope => ({
  ...defaultRuleScope(subredditName, input?.target ?? 'comment'),
  ...input,
  subredditId: subredditName,
});

export const saveResponseRule = async ({
  input,
  subredditName = context.subredditName,
  username = context.username ?? 'mod',
}: {
  input: FirewatchRuleInput;
  subredditName?: string;
  username?: string;
}) => {
  const rules = await getResponseRules(subredditName);
  const existing = input.id
    ? rules.find((rule) => rule.id === input.id)
    : undefined;
  const timestamp = currentIso();
  const nextRule: FirewatchRule = {
    id: existing?.id ?? input.id ?? makeId('rule'),
    name: input.name.trim() || 'Untitled response rule',
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    enabled: input.enabled,
    trigger: input.trigger,
    scope: normalizeRuleScope(input.scope, subredditName),
    conditions: input.conditions,
    ...(input.counter ? { counter: input.counter } : {}),
    actions: input.actions,
    mode: input.mode,
    createdBy: existing?.createdBy ?? username,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const nextRules = existing
    ? rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
    : [nextRule, ...rules];

  await saveResponseRules(subredditName, nextRules);
  return nextRules;
};

export const importResponseRuleTemplates = async (
  subredditName = context.subredditName
) => {
  const templates = templateRules(subredditName);
  await saveResponseRules(subredditName, templates);
  return templates;
};

export const disableAllResponseRules = async (
  subredditName = context.subredditName
) => {
  const rules = await getResponseRules(subredditName);
  const timestamp = currentIso();
  const nextRules = rules.map((rule) => ({
    ...rule,
    enabled: false,
    updatedAt: timestamp,
  }));

  await saveResponseRules(subredditName, nextRules);
  return nextRules;
};

export const getRuleExecutionLogs = async (
  subredditName = context.subredditName
) =>
  parseJsonList<RuleExecutionLog>(await redis.get(ruleLogsKey(subredditName)));

export const recordRuleExecutionLog = async (
  log: Omit<RuleExecutionLog, 'id' | 'triggeredAt'>
) => {
  const nextLog: RuleExecutionLog = {
    ...log,
    id: makeId('rulelog'),
    triggeredAt: currentIso(),
  };
  const logs = await getRuleExecutionLogs(context.subredditName);
  await redis.set(
    ruleLogsKey(context.subredditName),
    JSON.stringify([nextLog, ...logs].slice(0, MAX_RULE_LOGS)),
    { expiration: retentionExpiration() }
  );
  return nextLog;
};

export const addUserStrike = async ({
  createdBy = 'firewatch',
  expiresAt,
  reason,
  relatedCommentId,
  relatedPostId,
  source,
  subredditName = context.subredditName,
  username,
  weight = 1,
}: {
  createdBy?: 'firewatch' | string;
  expiresAt?: string;
  reason: string;
  relatedCommentId?: string | undefined;
  relatedPostId?: string | undefined;
  source: UserStrike['source'];
  subredditName?: string;
  username: string;
  weight?: number;
}) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot add strike to unknown user');

  const strike: UserStrike = {
    id: makeId('strike'),
    subredditId: subredditName,
    username: normalizedUsername,
    reason,
    source,
    weight,
    ...(relatedPostId ? { relatedPostId: normalizePostId(relatedPostId) } : {}),
    ...(relatedCommentId
      ? { relatedCommentId: normalizeCommentId(relatedCommentId) }
      : {}),
    createdAt: currentIso(),
    ...(expiresAt ? { expiresAt } : {}),
    createdBy,
  };
  const strikes = await getUserStrikes(subredditName, normalizedUsername);
  await redis.set(
    userStrikesKey(subredditName, normalizedUsername),
    JSON.stringify([strike, ...strikes].slice(0, MAX_STRIKES_PER_USER)),
    { expiration: retentionExpiration() }
  );
  return strike;
};

export const getUserStrikes = async (
  subredditName: string,
  username: string
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return [];

  const strikes = parseJsonList<UserStrike>(
    await redis.get(userStrikesKey(subredditName, normalizedUsername))
  );
  const nowMs = now();

  return strikes.filter((strike) => {
    if (!strike.expiresAt) return true;
    const expiresAt = Date.parse(strike.expiresAt);
    return Number.isFinite(expiresAt) ? expiresAt > nowMs : true;
  });
};

export const clearUserStrikes = async (
  subredditName: string,
  username: string
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('Cannot clear unknown user');
  await redis.del(userStrikesKey(subredditName, normalizedUsername));
};

const signalText = (incident: Incident, commentId?: string) =>
  incident.recentSignals
    .filter((signal) => !commentId || signal.commentId === commentId)
    .map((signal) => signal.body)
    .filter((body): body is string => Boolean(body))
    .join('\n');

const watchedWordHits = (text: string, keywords: string[]) => {
  const lowered = text.toLowerCase();
  return keywords.filter((keyword) => lowered.includes(keyword.toLowerCase()))
    .length;
};

const watchedDomainHits = (text: string, domains: string[]) => {
  const lowered = text.toLowerCase();
  return domains.filter((domain) => lowered.includes(domain.toLowerCase()))
    .length;
};

const linkHits = (text: string) => text.match(LINK_PATTERN)?.length ?? 0;

const inWindow = (timestamp: number, windowMinutes?: number) => {
  if (!windowMinutes) return true;
  return timestamp >= now() - windowMinutes * 60 * 1000;
};

const removedCommentCountForUser = (
  incident: Incident,
  username: string,
  windowMinutes?: number
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return 0;
  const commentAuthors = new Map(
    incident.flaggedComments.map((comment) => [
      normalizeCommentId(comment.id),
      normalizeUsername(comment.author)?.toLowerCase(),
    ])
  );

  return incident.actions.filter((action) => {
    if (
      action.type !== 'comment_removed' &&
      action.type !== 'comment_spammed' &&
      action.type !== 'comment_thread_removed' &&
      action.type !== 'user_content_removed' &&
      action.type !== 'user_banned'
    ) {
      return false;
    }
    if (!inWindow(action.createdAt, windowMinutes)) return false;
    return (action.targetIds ?? []).some((targetId) => {
      if (targetId.startsWith('t3_')) return false;
      return (
        commentAuthors.get(normalizeCommentId(targetId)) ===
        normalizedUsername.toLowerCase()
      );
    });
  }).length;
};

const reportCountInWindow = (incident: Incident, windowMinutes?: number) =>
  incident.recentSignals.filter(
    (signal) =>
      (signal.type === 'comment_report' || signal.type === 'post_report') &&
      inWindow(signal.createdAt, windowMinutes)
  ).length;

const compareConditionValue = ({
  actual,
  label,
  operator,
  expected,
}: {
  actual: number;
  expected: number;
  label: string;
  operator: '>=' | '>' | '=';
}) =>
  compare(actual, operator, expected)
    ? `${label} ${operator} ${expected} (${actual})`
    : undefined;

type Candidate = {
  targetId: string;
  targetType: MatchedResponseRule['targetType'];
  text: string;
  username?: string;
};

const candidateUsers = (
  incident: Incident,
  strikeSummaries: UserStrikeSummary[]
) => {
  const users = new Map<string, Candidate>();
  for (const user of incident.involvedUsers) {
    users.set(user.username.toLowerCase(), {
      targetId: user.username,
      targetType: 'user',
      text: signalText(incident),
      username: user.username,
    });
  }
  for (const summary of strikeSummaries) {
    users.set(summary.username.toLowerCase(), {
      targetId: summary.username,
      targetType: 'user',
      text: signalText(incident),
      username: summary.username,
    });
  }
  return Array.from(users.values());
};

const candidatesForRule = (
  rule: FirewatchRule,
  incident: Incident,
  strikeSummaries: UserStrikeSummary[]
): Candidate[] => {
  if (rule.scope.target === 'comment') {
    return incident.flaggedComments
      .filter((comment) => !comment.removed && !comment.reviewed)
      .map((comment) => ({
        targetId: comment.id,
        targetType: 'comment',
        text: signalText(incident, comment.id) || comment.body,
        username: comment.author,
      }));
  }

  if (rule.scope.target === 'user') {
    return candidateUsers(incident, strikeSummaries);
  }

  return [
    {
      targetId: incident.postId,
      targetType: rule.scope.target,
      text: signalText(incident) || incident.title,
    },
  ];
};

const textConditionReason = (
  condition: Extract<RuleCondition, { type: 'text_contains' }>,
  text: string
) => {
  const haystack = condition.caseSensitive ? text : text.toLowerCase();
  const needle = condition.caseSensitive
    ? condition.value
    : condition.value.toLowerCase();

  if (condition.match === 'regex') {
    try {
      const regex = new RegExp(
        condition.value,
        condition.caseSensitive ? '' : 'i'
      );
      return regex.test(text) ? `text matched /${condition.value}/` : undefined;
    } catch {
      return undefined;
    }
  }

  if (condition.match === 'exact') {
    return haystack.includes(needle)
      ? `text contains exact phrase "${condition.value}"`
      : undefined;
  }

  return haystack.includes(needle)
    ? `text contains "${condition.value}"`
    : undefined;
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
    const hits = linkHits(candidate.text);
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
    return compareConditionValue({
      actual: incident.score,
      expected: condition.value,
      label: 'incident score',
      operator: condition.operator,
    });
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

  return incident.stats.branchPileOns > 0 &&
    incident.flaggedComments.length >= condition.minComments
    ? `${incident.flaggedComments.length} flagged comments in clustered replies`
    : undefined;
};

const strikeSummaryForCandidate = (
  candidate: Candidate,
  summaries: UserStrikeSummary[]
) =>
  candidate.username
    ? summaries.find(
        (summary) =>
          summary.username.toLowerCase() === candidate.username?.toLowerCase()
      )
    : undefined;

const matchRule = ({
  config,
  incident,
  rule,
  strikeSummaries,
}: {
  config: FirewatchConfig;
  incident: Incident;
  rule: FirewatchRule;
  strikeSummaries: UserStrikeSummary[];
}) => {
  if (!rule.enabled) return undefined;

  for (const candidate of candidatesForRule(rule, incident, strikeSummaries)) {
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

    return {
      id: `${rule.id}:${candidate.targetId}`,
      ruleId: rule.id,
      ruleName: rule.name,
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
    };
  }

  return undefined;
};

export const getUserStrikeSummaries = async (
  incident: Incident
): Promise<UserStrikeSummary[]> => {
  const usernames = Array.from(
    new Set(
      [
        ...incident.involvedUsers.map((user) => user.username),
        ...incident.flaggedComments.map((comment) => comment.author),
      ]
        .map(normalizeUsername)
        .filter((username): username is string => Boolean(username))
    )
  );

  return Promise.all(
    usernames.map(async (username) => {
      const strikes = await getUserStrikes(incident.subredditName, username);
      const windowStart =
        now() - DEFAULT_STRIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const recentStrikes = strikes.filter((strike) => {
        const createdAt = Date.parse(strike.createdAt);
        return Number.isFinite(createdAt) ? createdAt >= windowStart : true;
      });
      const removedComments = removedCommentCountForUser(
        incident,
        username,
        DEFAULT_STRIKE_WINDOW_DAYS * 24 * 60
      );
      const suspiciousDomainHits = recentStrikes.filter(
        (strike) => strike.source === 'watched_domain'
      ).length;
      const totalWeight = recentStrikes.reduce(
        (total, strike) => total + strike.weight,
        0
      );

      return {
        username,
        totalWeight,
        strikeCount: recentStrikes.length,
        recentWindowDays: DEFAULT_STRIKE_WINDOW_DAYS,
        removedComments,
        suspiciousDomainHits,
        strikes: recentStrikes,
        ...(totalWeight >= 2 ? { preparedAction: 'temp ban review' } : {}),
      };
    })
  );
};

export const matchIncidentResponseRules = async ({
  config,
  incident,
}: {
  config: FirewatchConfig;
  incident: Incident;
}) => {
  const [rules, strikeSummaries] = await Promise.all([
    getResponseRules(incident.subredditName),
    getUserStrikeSummaries(incident),
  ]);
  const matches = rules
    .map((rule) =>
      matchRule({
        config,
        incident,
        rule,
        strikeSummaries,
      })
    )
    .filter((match): match is MatchedResponseRule => Boolean(match));

  return { matches, strikeSummaries };
};

export const attachRuleContext = async (
  incident: Incident,
  config: FirewatchConfig
): Promise<Incident> => {
  const { matches, strikeSummaries } = await matchIncidentResponseRules({
    config,
    incident,
  });

  return {
    ...incident,
    matchedRules: matches,
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
  triggerType: string;
}) => {
  if (incident.recentSignals[0]?.source === 'firewatch_notice') return [];

  const { matches } = await matchIncidentResponseRules({ config, incident });
  const existingLogs = await getRuleExecutionLogs(incident.subredditName);
  const newLogs: RuleExecutionLog[] = [];

  for (const match of matches) {
    const alreadyLogged = existingLogs.some(
      (log) => log.ruleId === match.ruleId && log.targetId === match.targetId
    );
    if (alreadyLogged) continue;

    const executedActions: string[] = [];
    const skippedActions: string[] = [];
    const mode = modeOverride ?? match.mode;
    if (mode === 'auto_run_safe_actions') {
      for (const action of match.preparedActions) {
        if (action.risk === 'safe') executedActions.push(action.label);
        else skippedActions.push(`${action.label} requires mod approval`);
      }
    } else if (mode === 'auto_run_all_selected_actions') {
      skippedActions.push('Auto-run all selected actions queued');
    } else if (mode === 'suggest_only' || mode === 'prepare_for_approval') {
      skippedActions.push('Waiting for moderator approval');
    }

    newLogs.push(
      await recordRuleExecutionLog({
        ruleId: match.ruleId,
        ruleName: match.ruleName,
        triggerType,
        targetType: match.targetType,
        targetId: match.targetId,
        matchedConditions: match.why,
        preparedActions: match.preparedActions.map((action) => action.label),
        executedActions,
        skippedActions,
        mode,
        actor,
      })
    );
  }

  return newLogs;
};

export const testResponseRule = async ({
  config,
  incidents,
  ruleId,
}: {
  config: FirewatchConfig;
  incidents: Incident[];
  ruleId: string;
}): Promise<RuleTestResponse> => {
  const rules = await getResponseRules();
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error('Rule not found');

  const examples: { label: string; detail: string }[] = [];
  const preparedActions = new Set<string>();

  for (const incident of incidents) {
    const strikeSummaries = await getUserStrikeSummaries(incident);
    const match = matchRule({
      config,
      incident,
      rule,
      strikeSummaries,
    });
    if (!match) continue;

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

  return {
    type: 'rule-test',
    ruleId: rule.id,
    ruleName: rule.name,
    matchedCount: examples.length,
    examples: examples.slice(0, 3),
    preparedActions: Array.from(preparedActions),
  };
};
