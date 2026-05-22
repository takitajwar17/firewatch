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
          text: 'Firewatch filters saved',
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error saving Firewatch filters: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not save Firewatch filters',
      },
      400
    );
  }
});
