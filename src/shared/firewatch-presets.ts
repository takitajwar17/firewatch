import type { FirewatchDemoScenario, FirewatchDemoScenarioId } from './api';

export const DEFAULT_DEMO_SCENARIO_ID: FirewatchDemoScenarioId =
  'suspicious_giveaway_escalating';

const HEATED_THREAD_SCENARIO: FirewatchDemoScenario = {
  id: 'heated_thread',
  label: 'Heated thread',
  description:
    'Repeated wording, personal replies, reports, and one crowded reply branch.',
};

export const FIREWATCH_DEMO_SCENARIOS: FirewatchDemoScenario[] = [
  {
    id: 'suspicious_giveaway_escalating',
    label: 'Suspicious giveaway thread escalating',
    description:
      'A strong incident-response demo with scam links, repeated behavior, strikes, matched automations, and prepared actions.',
  },
  HEATED_THREAD_SCENARIO,
  {
    id: 'scam_link_cleanup',
    label: 'Scam link cleanup',
    description:
      'Watched domains, scam language, multiple reports, and comments ready for remove or ban decisions.',
  },
  {
    id: 'support_safety_cleanup',
    label: 'Support cleanup',
    description:
      'Unsafe advice and personal-info requests in a help thread, with acceptable comments mixed in.',
  },
];

export const getDemoScenario = (
  scenarioId: FirewatchDemoScenarioId | undefined
) =>
  FIREWATCH_DEMO_SCENARIOS.find((scenario) => scenario.id === scenarioId) ??
  HEATED_THREAD_SCENARIO;
