import { useState, type ComponentProps } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  FIREWATCH_DEMO_SCENARIOS,
} from '../../shared/firewatch-presets';
import {
  CONFIG_ACTION_CONTROL_GROUPS,
  CONFIG_CORE_ACTION_FIELDS,
  CONFIG_SIGNAL_WEIGHT_FIELDS,
  type ConfigActionControlField,
} from '../../shared/firewatch-config';
import {
  DisclosurePanel,
  FieldBlock,
  PlaybookButton,
  SectionHeader,
} from './common';
import { splitList } from './format';
import type { FirewatchConfig } from '../../shared/api';
import type { ConfigSaveHandler, DemoCreateHandler } from './types';
import {
  RedditAddIcon,
  RedditApproveIcon,
  RedditRemoveIcon,
  RedditReportIcon,
} from './reddit-icons';

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
}) => (
  <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
    <SectionHeader
      title="Settings"
      description="Watched terms, thresholds, and mod actions."
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

const CommunityFiltersCard = ({
  busy,
  config,
  onSave,
}: {
  busy: boolean;
  config: FirewatchConfig;
  onSave: ConfigSaveHandler;
}) => {
  const [keywords, setKeywords] = useState(config.keywords.join(', '));
  const [suspiciousDomains, setSuspiciousDomains] = useState(
    config.suspiciousDomains.join(', ')
  );
  const [heatThreshold, setHeatThreshold] = useState(
    String(config.heatThreshold)
  );
  const [fireThreshold, setFireThreshold] = useState(
    String(config.fireThreshold)
  );
  const [wildfireThreshold, setWildfireThreshold] = useState(
    String(config.wildfireThreshold)
  );
  const [reminderText, setReminderText] = useState(config.reminderText);
  const [actionControls, setActionControls] = useState(config.actionControls);
  const [signalWeights, setSignalWeights] = useState(config.signalWeights);

  const parsedHeat = Number(heatThreshold);
  const parsedFire = Number(fireThreshold);
  const parsedWildfire = Number(wildfireThreshold);
  const invalidThresholds =
    !Number.isFinite(parsedHeat) ||
    !Number.isFinite(parsedFire) ||
    !Number.isFinite(parsedWildfire) ||
    parsedHeat < 1 ||
    parsedFire <= parsedHeat ||
    parsedWildfire <= parsedFire ||
    parsedWildfire > 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What Firewatch watches</CardTitle>
        <CardDescription>
          These words and domains are the main subreddit-wide triggers.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldBlock
          description={`${splitList(keywords).length} active terms. Comma-separated words or phrases that should raise mod attention.`}
          htmlFor="fw-keywords"
          label="Watched words"
        >
          <SettingsTextarea
            id="fw-keywords"
            rows={4}
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </FieldBlock>

        <FieldBlock
          description={`${splitList(suspiciousDomains).length} domains watched in posts, comments, and report reasons.`}
          htmlFor="fw-domains"
          label="Watched domains"
        >
          <SettingsTextarea
            id="fw-domains"
            rows={3}
            value={suspiciousDomains}
            onChange={(event) => setSuspiciousDomains(event.target.value)}
          />
        </FieldBlock>

        <DisclosurePanel
          description="Thresholds, signal weights, and the sticky reminder copy."
          title="Scoring and reminder"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold leading-5">
                Attention thresholds
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                Firewatch uses these scores to label posts for review, action,
                and lockdown-level attention.
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <ThresholdInput
                  id="review"
                  label="Review at"
                  value={heatThreshold}
                  onChange={setHeatThreshold}
                />
                <ThresholdInput
                  id="act"
                  label="Act at"
                  value={fireThreshold}
                  onChange={setFireThreshold}
                />
                <ThresholdInput
                  id="lock"
                  label="Lock at"
                  value={wildfireThreshold}
                  onChange={setWildfireThreshold}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold leading-5">Signal weights</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Set a weight to 0 to ignore that signal. Higher weights make
                Firewatch raise attention faster.
              </p>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {CONFIG_SIGNAL_WEIGHT_FIELDS.map((field) => (
                  <ThresholdInput
                    key={field.id}
                    id={`weight-${field.id}`}
                    label={field.label}
                    max={50}
                    min={0}
                    value={String(signalWeights[field.id])}
                    onChange={(value) =>
                      setSignalWeights((current) => ({
                        ...current,
                        [field.id]: parseNumberInput(value, current[field.id]),
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <FieldBlock
              description="Posted as a distinguished sticky comment when mods use Sticky reminder."
              htmlFor="fw-reminder-text"
              label="Sticky reminder text"
            >
              <SettingsTextarea
                id="fw-reminder-text"
                maxLength={800}
                rows={4}
                value={reminderText}
                onChange={(event) => setReminderText(event.target.value)}
              />
            </FieldBlock>
          </div>
        </DisclosurePanel>

        <ActionPermissionsControl
          actionControls={actionControls}
          onChange={setActionControls}
        />

        {invalidThresholds ? (
          <Alert variant="destructive">
            <RedditReportIcon />
            <AlertTitle>Scores need ordering</AlertTitle>
            <AlertDescription>
              Use numbers from 1 to 100 where Review is below Act and Act is
              below Lock.
            </AlertDescription>
          </Alert>
        ) : null}

        <PlaybookButton
          className="w-full sm:w-fit"
          disabled={busy || invalidThresholds}
          icon={<RedditApproveIcon data-icon="inline-start" />}
          label="Save settings"
          loading={busy}
          loadingLabel="Saving"
          variant="default"
          onClick={() =>
            onSave({
              keywords,
              suspiciousDomains,
              heatThreshold: parsedHeat,
              fireThreshold: parsedFire,
              wildfireThreshold: parsedWildfire,
              reminderText,
              actionControls,
              signalWeights,
            })
          }
        />
      </CardContent>
    </Card>
  );
};

const ActionPermissionsControl = ({
  actionControls,
  onChange,
}: {
  actionControls: FirewatchConfig['actionControls'];
  onChange: (value: FirewatchConfig['actionControls']) => void;
}) => {
  const toggleAction = (
    id: keyof FirewatchConfig['actionControls'],
    checked: boolean
  ) => {
    onChange({
      ...actionControls,
      [id]: checked,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold leading-5">Allowed mod actions</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose which Reddit actions appear in post and comment review.
        </p>
      </div>

      <ActionToggleGroup
        actionControls={actionControls}
        fields={CONFIG_CORE_ACTION_FIELDS}
        onChange={toggleAction}
      />

      <DisclosurePanel
        description="Post, comment, and user tools shown in contextual action menus."
        title="Advanced Reddit permissions"
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {CONFIG_ACTION_CONTROL_GROUPS.slice(1).map((group) => (
            <ActionToggleGroup
              key={
                group.title ?? group.fields.map((field) => field.id).join(':')
              }
              actionControls={actionControls}
              fields={group.fields}
              title={group.title ?? ''}
              onChange={toggleAction}
            />
          ))}
        </div>
      </DisclosurePanel>
    </div>
  );
};

const ActionToggleGroup = ({
  actionControls,
  fields,
  onChange,
  title,
}: {
  actionControls: FirewatchConfig['actionControls'];
  fields: ConfigActionControlField[];
  onChange: (
    id: keyof FirewatchConfig['actionControls'],
    checked: boolean
  ) => void;
  title?: string;
}) => (
  <div className="flex flex-col gap-2">
    {title ? (
      <p className="text-xs font-semibold leading-5 text-muted-foreground">
        {title}
      </p>
    ) : null}
    <div className="grid min-w-0 gap-2 md:grid-cols-2">
      {fields.map((field) => (
        <label
          key={field.id}
          className="group flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent"
        >
          <span className="min-w-0 truncate">{field.label}</span>
          <span className="relative inline-flex h-6 w-10 shrink-0 items-center">
            <input
              checked={actionControls[field.id]}
              className="peer sr-only"
              type="checkbox"
              onChange={(event) => onChange(field.id, event.target.checked)}
            />
            <span className="absolute inset-0 rounded-full bg-muted ring-1 ring-border transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/35" />
            <span className="absolute left-0.5 size-5 rounded-full bg-card shadow-sm transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
      ))}
    </div>
  </div>
);

const parseNumberInput = (value: string, fallback: number) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const SettingsTextarea = ({
  className,
  ...props
}: ComponentProps<'textarea'>) => (
  <textarea
    className={cn(
      'min-h-24 w-full min-w-0 resize-y rounded-lg border border-transparent bg-secondary px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const ThresholdInput = ({
  id,
  label,
  max = 100,
  min = 1,
  onChange,
  value,
}: {
  id: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  value: string;
}) => (
  <FieldBlock htmlFor={`fw-threshold-${id}`} label={label}>
    <Input
      id={`fw-threshold-${id}`}
      inputMode="numeric"
      max={max}
      min={min}
      step={1}
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </FieldBlock>
);

const CommunityToolsCard = ({
  busyAction,
  hasDemoIncidents,
  onCreateDemo,
  onResetDemos,
}: {
  busyAction: string | undefined;
  hasDemoIncidents: boolean;
  onCreateDemo: DemoCreateHandler;
  onResetDemos: () => void;
}) => {
  const [scenarioId, setScenarioId] = useState(DEFAULT_DEMO_SCENARIO_ID);
  const selectedScenarioDescription =
    FIREWATCH_DEMO_SCENARIOS.find((scenario) => scenario.id === scenarioId)
      ?.description ?? '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo tools</CardTitle>
        <CardDescription>
          Create or clear demo incidents for this subreddit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <FieldBlock htmlFor="fw-demo-scenario" label="Demo scenario">
          <select
            id="fw-demo-scenario"
            className="h-9 w-full min-w-0 rounded-full border border-transparent bg-secondary px-4 text-sm outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
            value={scenarioId}
            onChange={(event) => {
              const nextScenario = FIREWATCH_DEMO_SCENARIOS.find(
                (scenario) => scenario.id === event.target.value
              );
              if (nextScenario) setScenarioId(nextScenario.id);
            }}
          >
            {FIREWATCH_DEMO_SCENARIOS.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
        </FieldBlock>
        <p className="rounded-lg border bg-muted/60 p-3 text-sm leading-5 text-muted-foreground">
          {selectedScenarioDescription}
        </p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <PlaybookButton
            disabled={busyAction === 'demo'}
            icon={<RedditAddIcon data-icon="inline-start" />}
            label="Create demo"
            loading={busyAction === 'demo'}
            loadingLabel="Creating"
            variant="outline"
            onClick={() => onCreateDemo(scenarioId)}
          />
          <PlaybookButton
            disabled={!hasDemoIncidents || busyAction === 'reset-demo'}
            icon={<RedditRemoveIcon data-icon="inline-start" />}
            label="Reset demos"
            loading={busyAction === 'reset-demo'}
            loadingLabel="Clearing"
            variant="ghost"
            onClick={onResetDemos}
          />
        </div>
      </CardContent>
    </Card>
  );
};
