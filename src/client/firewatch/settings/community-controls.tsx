import { useState, type ComponentProps } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  FIREWATCH_DEMO_SCENARIOS,
} from '../../../shared/firewatch-presets';
import {
  CONFIG_ACTION_CONTROL_GROUPS,
  CONFIG_CORE_ACTION_FIELDS,
  CONFIG_SIGNAL_WEIGHT_FIELDS,
  normalizeConfigList,
  type ConfigActionControlField,
} from '../../../shared/firewatch-config';
import type { FirewatchConfig } from '../../../shared/api';
import type {
  AppResetHandler,
  ConfigSaveHandler,
  DemoCreateHandler,
} from '../types';
import {
  DisclosurePanel,
  FieldBlock,
  FirewatchRatingSelect,
  Input,
  PlaybookButton,
} from '../common';
import { splitList } from '../format';
import {
  RedditAddIcon,
  RedditApproveIcon,
  RedditChevronDownIcon,
  RedditRemoveIcon,
  RedditReportIcon,
} from '../reddit-icons';

export const CommunityFiltersCard = ({
  busy,
  config,
  onSave,
}: {
  busy: boolean;
  config: FirewatchConfig;
  onSave: ConfigSaveHandler;
}) => {
  const [keywords, setKeywords] = useState(() => config.keywords.join(', '));
  const [suspiciousDomains, setSuspiciousDomains] = useState(() =>
    config.suspiciousDomains.join(', ')
  );
  const [heatThreshold, setHeatThreshold] = useState(() =>
    String(config.heatThreshold)
  );
  const [fireThreshold, setFireThreshold] = useState(() =>
    String(config.fireThreshold)
  );
  const [wildfireThreshold, setWildfireThreshold] = useState(() =>
    String(config.wildfireThreshold)
  );
  const [reminderText, setReminderText] = useState(() => config.reminderText);
  const [actionControls, setActionControls] = useState(
    () => config.actionControls
  );
  const [signalWeights, setSignalWeights] = useState(
    () => config.signalWeights
  );

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
  const normalizedKeywordCount = normalizeConfigList(
    splitList(keywords),
    []
  ).length;
  const normalizedDomainCount = normalizeConfigList(
    splitList(suspiciousDomains),
    []
  ).length;

  const saveSettings = () =>
    onSave({
      keywords,
      suspiciousDomains,
      heatThreshold: parsedHeat,
      fireThreshold: parsedFire,
      wildfireThreshold: parsedWildfire,
      reminderText,
      actionControls,
      signalWeights,
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsSaveBar
        busy={busy}
        disabled={invalidThresholds}
        onSave={saveSettings}
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle>Subreddit filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldBlock
            htmlFor="fw-keywords"
            label={`Watched words (${normalizedKeywordCount})`}
          >
            <SettingsTextarea
              id="fw-keywords"
              rows={4}
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
          </FieldBlock>

          <FieldBlock
            htmlFor="fw-domains"
            label={`Watched domains (${normalizedDomainCount})`}
          >
            <SettingsTextarea
              id="fw-domains"
              rows={3}
              value={suspiciousDomains}
              onChange={(event) => setSuspiciousDomains(event.target.value)}
            />
          </FieldBlock>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Firewatch rating</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold leading-5">
              When a post moves up
            </p>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <RatingThresholdSelect
                id="review"
                label="Review starts at"
                score={parsedHeat}
                onChangeScore={(score) => setHeatThreshold(String(score))}
              />
              <RatingThresholdSelect
                id="act"
                label="Priority starts at"
                score={parsedFire}
                onChangeScore={(score) => setFireThreshold(String(score))}
              />
              <RatingThresholdSelect
                id="lock"
                label="Wildfire starts at"
                score={parsedWildfire}
                onChangeScore={(score) => setWildfireThreshold(String(score))}
              />
            </div>
          </div>

          <DisclosurePanel
            description="Advanced controls for how much each signal moves the 0-5 rating."
            title="Signal weights"
          >
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
          </DisclosurePanel>

          {invalidThresholds ? (
            <Alert variant="destructive">
              <RedditReportIcon />
              <AlertTitle>Rating thresholds need ordering</AlertTitle>
              <AlertDescription>
                Review must start below Priority, and Priority must start below
                Wildfire.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Sticky comment</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldBlock htmlFor="fw-reminder-text" label="Comment text">
            <SettingsTextarea
              id="fw-reminder-text"
              maxLength={800}
              rows={4}
              value={reminderText}
              onChange={(event) => setReminderText(event.target.value)}
            />
          </FieldBlock>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Available mod actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ActionPermissionsControl
            actionControls={actionControls}
            onChange={setActionControls}
          />
        </CardContent>
      </Card>
    </div>
  );
};

const SettingsSaveBar = ({
  busy,
  disabled,
  onSave,
}: {
  busy: boolean;
  disabled: boolean;
  onSave: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm leading-5 text-muted-foreground">
      These settings apply across the subreddit.
    </p>
    <PlaybookButton
      className="w-full sm:w-fit"
      disabled={busy || disabled}
      icon={<RedditApproveIcon data-icon="inline-start" />}
      label="Save settings"
      loading={busy}
      loadingLabel="Saving"
      variant="default"
      onClick={onSave}
    />
  </div>
);

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
      <ActionToggleGroup
        actionControls={actionControls}
        fields={CONFIG_CORE_ACTION_FIELDS}
        onChange={toggleAction}
      />

      <DisclosurePanel title="Post, comment, and user actions">
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
          className="group flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent"
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
      'min-h-24 w-full min-w-0 resize-y rounded-md border border-transparent bg-secondary px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
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

const RatingThresholdSelect = ({
  id,
  label,
  onChangeScore,
  score,
}: {
  id: string;
  label: string;
  onChangeScore: (score: number) => void;
  score: number;
}) => (
  <FirewatchRatingSelect
    className="font-semibold"
    description={`Current threshold uses signal score ${score}/100.`}
    id={`fw-rating-threshold-${id}`}
    label={label}
    score={score}
    onChangeScore={onChangeScore}
  />
);

export const CommunityToolsCard = ({
  busyAction,
  hasDemoIncidents,
  onCreateDemo,
  onResetApp,
  onResetDemos,
}: {
  busyAction: string | undefined;
  hasDemoIncidents: boolean;
  onCreateDemo: DemoCreateHandler;
  onResetApp: AppResetHandler;
  onResetDemos: () => void;
}) => {
  const [scenarioId, setScenarioId] = useState(DEFAULT_DEMO_SCENARIO_ID);
  const [confirmReset, setConfirmReset] = useState(false);
  const selectedScenario =
    FIREWATCH_DEMO_SCENARIOS.find((scenario) => scenario.id === scenarioId) ??
    FIREWATCH_DEMO_SCENARIOS[0];

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Demo data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-5 text-muted-foreground">
          Adds a realistic demo thread to the queue. Existing demo threads stay
          in place until you reset demos.
        </p>
        <FieldBlock htmlFor="fw-demo-scenario" label="Demo scenario">
          <div className="relative min-w-0">
            <select
              id="fw-demo-scenario"
              className="h-9 w-full min-w-0 appearance-none rounded-full border border-transparent bg-secondary py-0 pr-11 pl-4 text-sm outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
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
            <RedditChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </FieldBlock>
        {selectedScenario ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {selectedScenario.description}
          </p>
        ) : null}
        {hasDemoIncidents ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Reset demos removes Firewatch demo queue items and deletes their
            Reddit posts.
          </p>
        ) : null}
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <PlaybookButton
            disabled={busyAction === 'demo'}
            icon={<RedditAddIcon data-icon="inline-start" />}
            label="Create demo thread"
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
        <div className="border-t border-border pt-3">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold leading-5">Reset app</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Deletes saved filters, queue data, automations, logs, claims,
              handoff notes, and strike history for this install.
            </p>
            {confirmReset ? (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <PlaybookButton
                  disabled={busyAction === 'reset-app'}
                  icon={<RedditRemoveIcon data-icon="inline-start" />}
                  label="Delete all Firewatch data"
                  loading={busyAction === 'reset-app'}
                  loadingLabel="Deleting"
                  variant="destructive"
                  onClick={() => {
                    setConfirmReset(false);
                    onResetApp();
                  }}
                />
                <PlaybookButton
                  disabled={busyAction === 'reset-app'}
                  label="Cancel"
                  variant="ghost"
                  onClick={() => setConfirmReset(false)}
                />
              </div>
            ) : (
              <PlaybookButton
                icon={<RedditRemoveIcon data-icon="inline-start" />}
                label="Reset app"
                variant="ghost"
                onClick={() => setConfirmReset(true)}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
