import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { saveConfig } from '../core/firewatch';

type ConfigFormValues = {
  keywords?: string;
  suspiciousDomains?: string;
  heatThreshold?: number;
  fireThreshold?: number;
  wildfireThreshold?: number;
};

export const forms = new Hono();

forms.post('/config-submit', async (c) => {
  try {
    const values = await c.req.json<ConfigFormValues>();
    await saveConfig(values);

    return c.json<UiResponse>(
      {
        showToast: {
          text: 'Firewatch settings saved',
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error saving Firewatch config: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to save Firewatch settings',
      },
      400
    );
  }
});
