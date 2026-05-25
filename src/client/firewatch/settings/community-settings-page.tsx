import { SectionHeader } from '../common';
import type { FirewatchConfig } from '../../../shared/api';
import type { ConfigSaveHandler, DemoCreateHandler } from '../types';
import { CommunityFiltersCard, CommunityToolsCard } from './community-controls';

export const CommunitySettingsPage = ({
  busyAction,
  config,
  hasDemoIncidents,
  onCreateDemo,
  onResetDemos,
  onSaveConfig,
}: {
  busyAction: string | undefined;
  config: FirewatchConfig;
  hasDemoIncidents: boolean;
  onCreateDemo: DemoCreateHandler;
  onResetDemos: () => void;
  onSaveConfig: ConfigSaveHandler;
}) => {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <SectionHeader
        description="Subreddit-wide filters, scoring, sticky text, and action access."
        title="Settings"
      />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CommunityFiltersCard
          key={[
            config.keywords.join('|'),
            config.suspiciousDomains.join('|'),
            config.heatThreshold,
            config.fireThreshold,
            config.wildfireThreshold,
            config.reminderText,
            Object.values(config.actionControls).join('|'),
            Object.values(config.signalWeights).join('|'),
          ].join(':')}
          busy={busyAction === 'config'}
          config={config}
          onSave={onSaveConfig}
        />
        <CommunityToolsCard
          busyAction={busyAction}
          hasDemoIncidents={hasDemoIncidents}
          onCreateDemo={onCreateDemo}
          onResetDemos={onResetDemos}
        />
      </div>
    </div>
  );
};
