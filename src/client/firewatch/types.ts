import type {
  AccessDeniedResponse,
  DashboardInitResponse,
  FirewatchDemoScenarioId,
  FirewatchRuleInput,
  Incident,
  RuleTestResponse,
} from '../../shared/api';

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardInitResponse }
  | { status: 'access_denied'; data: AccessDeniedResponse }
  | { status: 'error'; message: string };

export type ActionRunner = (
  action: string,
  endpoint: string,
  body?: Record<string, unknown>
) => Promise<Incident | undefined>;

export type ConfigFormValues = {
  keywords: string;
  suspiciousDomains: string;
  heatThreshold: number;
  fireThreshold: number;
  wildfireThreshold: number;
  reminderText: string;
  actionControls: DashboardInitResponse['config']['actionControls'];
  signalWeights: DashboardInitResponse['config']['signalWeights'];
};

export type ConfigSaveHandler = (values: ConfigFormValues) => Promise<void>;

export type FirewatchView = 'queue' | 'automations' | 'settings';

export type QueueFilter = 'all' | 'claimed' | 'resolved';

export type QueueFilterCounts = Record<QueueFilter, number>;

export type DemoCreateHandler = (scenarioId?: FirewatchDemoScenarioId) => void;

export type AppResetHandler = () => void;

export type RuleSaveHandler = (values: FirewatchRuleInput) => Promise<void>;

export type RuleTestHandler = (
  ruleId: string
) => Promise<RuleTestResponse | undefined>;

export type Notice = {
  type: 'success' | 'error';
  message: string;
};
