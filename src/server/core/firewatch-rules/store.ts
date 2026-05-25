import { context, redis } from '@devvit/web/server';
import type {
  FirewatchRule,
  FirewatchRuleInput,
  RuleExecutionLog,
  RuleScope,
} from '../../../shared/api';
import {
  defaultRuleScope,
  defaultRuleTemplates,
} from '../../../shared/automation-rules';
import { makeId, retentionExpiration } from '../firewatch-utils';
import { currentIso, MAX_RULE_LOGS, parseJsonList } from './common';

export const responseRulesKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:rules`;
export const ruleLogsKey = (subredditName: string) =>
  `fw:subreddit:${subredditName}:rule_logs`;

const templateRules = (subredditName: string) =>
  defaultRuleTemplates({
    createdAt: currentIso(),
    createdBy: 'firewatch',
    subredditId: subredditName,
  });

export const getAutomations = async (
  subredditName = context.subredditName
) => {
  const stored = parseJsonList<FirewatchRule>(
    await redis.get(responseRulesKey(subredditName))
  );

  return stored.length > 0 ? stored : templateRules(subredditName);
};

const saveAutomations = async (
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

export const saveAutomation = async ({
  input,
  subredditName = context.subredditName,
  username = context.username ?? 'mod',
}: {
  input: FirewatchRuleInput;
  subredditName?: string;
  username?: string;
}) => {
  const rules = await getAutomations(subredditName);
  const existing = input.id
    ? rules.find((rule) => rule.id === input.id)
    : undefined;
  const timestamp = currentIso();
  const nextRule: FirewatchRule = {
    id: existing?.id ?? input.id ?? makeId('rule'),
    name: input.name.trim() || 'Untitled automation',
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

  await saveAutomations(subredditName, nextRules);
  return nextRules;
};

export const importAutomationTemplates = async (
  subredditName = context.subredditName
) => {
  const templates = templateRules(subredditName);
  await saveAutomations(subredditName, templates);
  return templates;
};

export const disableAllAutomations = async (
  subredditName = context.subredditName
) => {
  const rules = await getAutomations(subredditName);
  const timestamp = currentIso();
  const nextRules = rules.map((rule) => ({
    ...rule,
    enabled: false,
    updatedAt: timestamp,
  }));

  await saveAutomations(subredditName, nextRules);
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
