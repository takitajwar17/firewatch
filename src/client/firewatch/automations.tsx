import { SectionHeader } from './common';
import { ResponseRulesCard } from './community-settings';
import type { FirewatchRule, RuleExecutionLog } from '../../shared/api';
import type { RuleSaveHandler, RuleTestHandler } from './types';

export const AutomationsPage = ({
  busyAction,
  ruleLogs,
  rules,
  subredditName,
  onDisableAllRules,
  onImportRuleTemplates,
  onSaveRule,
  onTestRule,
}: {
  busyAction: string | undefined;
  ruleLogs: RuleExecutionLog[];
  rules: FirewatchRule[];
  subredditName: string;
  onDisableAllRules: () => void;
  onImportRuleTemplates: () => void;
  onSaveRule: RuleSaveHandler;
  onTestRule: RuleTestHandler;
}) => (
  <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
    <SectionHeader title="Automations" />
    <ResponseRulesCard
      busyAction={busyAction}
      ruleLogs={ruleLogs}
      rules={rules}
      subredditId={subredditName}
      onDisableAllRules={onDisableAllRules}
      onImportTemplates={onImportRuleTemplates}
      onSaveRule={onSaveRule}
      onTestRule={onTestRule}
    />
  </div>
);
