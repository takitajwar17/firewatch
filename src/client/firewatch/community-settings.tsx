import { useState, type ComponentProps } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { FieldBlock, SectionHeader } from './common';
import { splitList } from './format';
import type { FirewatchConfig } from '../../shared/api';
import type { ConfigSaveHandler, DemoCreateHandler } from './types';

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
  <div className="flex flex-col gap-5">
    <SectionHeader
      title="Settings"
      description="Subreddit-wide Firewatch settings. These apply to every post in this community."
    />
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <CommunityFiltersCard
        key={`${config.keywords.join('|')}:${config.suspiciousDomains.join('|')}:${config.heatThreshold}:${config.fireThreshold}:${config.wildfireThreshold}`}
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
          These words, domains, and score thresholds apply across the subreddit.
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

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium leading-5">Attention thresholds</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Firewatch uses these scores to label posts for review, action, and
            lockdown-level attention.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
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

        {invalidThresholds ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Scores need ordering</AlertTitle>
            <AlertDescription>
              Use numbers from 1 to 100 where Review is below Act and Act is
              below Lock.
            </AlertDescription>
          </Alert>
        ) : null}

        <Button
          className="h-10 w-fit text-sm font-medium"
          disabled={busy || invalidThresholds}
          onClick={() =>
            onSave({
              keywords,
              suspiciousDomains,
              heatThreshold: parsedHeat,
              fireThreshold: parsedFire,
              wildfireThreshold: parsedWildfire,
            })
          }
        >
          {busy ? (
            <RefreshCw className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {busy ? 'Saving' : 'Save settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

const SettingsTextarea = ({
  className,
  ...props
}: ComponentProps<'textarea'>) => (
  <textarea
    className={cn(
      'min-h-24 w-full resize-y rounded-lg border border-input bg-background/95 px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground/90 hover:border-border/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
      className
    )}
    {...props}
  />
);

const ThresholdInput = ({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <FieldBlock htmlFor={`fw-threshold-${id}`} label={label}>
    <Input
      id={`fw-threshold-${id}`}
      inputMode="numeric"
      max={100}
      min={1}
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
            className="h-10 rounded-lg border border-input bg-background/95 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/15"
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
        <p className="rounded-lg border bg-muted/25 p-3 text-sm leading-6 text-muted-foreground">
          {selectedScenarioDescription}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <Button
            disabled={busyAction === 'demo'}
            variant="outline"
            onClick={() => onCreateDemo(scenarioId)}
          >
            <Sparkles data-icon="inline-start" />
            {busyAction === 'demo' ? 'Creating' : 'Create demo'}
          </Button>
          <Button
            disabled={!hasDemoIncidents || busyAction === 'reset-demo'}
            variant="ghost"
            onClick={onResetDemos}
          >
            <Trash2 data-icon="inline-start" />
            {busyAction === 'reset-demo' ? 'Clearing' : 'Reset demos'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
