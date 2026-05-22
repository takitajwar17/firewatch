import { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Save } from 'lucide-react';
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
import { FieldBlock } from './common';
import { splitList } from './format';
import type { ConfigSaveHandler } from './types';
import type { FirewatchConfig, Incident } from '../../shared/api';

export const SettingsCard = ({
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
        <CardTitle>Community filters</CardTitle>
        <CardDescription>
          Choose what sends posts into this mod queue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldBlock
          description={`${splitList(keywords).length} active terms. Comma-separated words or phrases that should raise mod attention.`}
          htmlFor="fw-keywords"
          label="Watched words"
        >
          <Input
            id="fw-keywords"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </FieldBlock>

        <FieldBlock
          description={`${splitList(suspiciousDomains).length} domains watched in posts, comments, and report reasons.`}
          htmlFor="fw-domains"
          label="Watched domains"
        >
          <Input
            id="fw-domains"
            value={suspiciousDomains}
            onChange={(event) => setSuspiciousDomains(event.target.value)}
          />
        </FieldBlock>

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

export const FilterHelpCard = ({
  config,
  incident,
}: {
  config: FirewatchConfig;
  incident: Incident;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>How posts enter review</CardTitle>
      <CardDescription>
        Firewatch queues posts for mods, but actions stay manual.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          Posts appear here from reports, new comments, watched words, watched
          domains, repeated user wording, reply clusters, or the post menu.
        </p>
        <p>
          This community has {config.keywords.length} watched words and{' '}
          {config.suspiciousDomains.length} watched domains. The selected post
          has {incident.stats.signalCount} recent events and{' '}
          {incident.stats.flaggedCount} comments needing review.
        </p>
      </div>
      <Alert>
        <CheckCircle2 />
        <AlertTitle>No automatic removals</AlertTitle>
        <AlertDescription>
          Firewatch explains why a post needs review. It does not remove
          comments, lock posts, or mark anything handled until a mod clicks the
          action.
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
);
