import { Hono } from 'hono';
import {
  configUpdateFromFormValues,
  type FirewatchConfigFormValues,
} from '../../shared/firewatch-config';
import { saveConfig } from '../core/firewatch';
import { uiErrorResponse, uiSuccessToastResponse } from './responses';

export const forms = new Hono();

forms.post('/config-submit', async (c) => {
  try {
    const values = await c.req.json<FirewatchConfigFormValues>();
    await saveConfig(configUpdateFromFormValues(values));

    return uiSuccessToastResponse(c, 'Firewatch settings saved');
  } catch (error) {
    return uiErrorResponse(
      c,
      error,
      'Error saving Firewatch settings',
      'Could not save Firewatch settings'
    );
  }
});
