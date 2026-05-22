import type {
  DashboardInitResponse,
  FirewatchDemoScenarioId,
  Incident,
} from '../../shared/api';

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardInitResponse }
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
};

export type ConfigSaveHandler = (values: ConfigFormValues) => Promise<void>;

export type FirewatchView = 'queue' | 'settings';

export type DemoCreateHandler = (
  scenarioId?: FirewatchDemoScenarioId
) => void;

export type Notice = {
  type: 'success' | 'error';
  message: string;
};
