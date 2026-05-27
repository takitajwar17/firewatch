import { Hono } from 'hono';
import {
  configUpdateFromFormValues,
  type FirewatchConfigFormValues,
} from '../../shared/firewatch-config';
import { saveConfig } from '../core/firewatch';
import { CONFIG_PERMISSIONS, requireModeratorPermissions } from './auth';
import { uiErrorResponse, uiSuccessToastResponse } from './responses';

/**
 * Devvit form callbacks registered in devvit.json. Form submissions are
 * permission checked because they can change subreddit-wide Firewatch config.
 */
export const forms = new Hono();

forms.post('/config-submit', async (c) => {
  try {
    await requireModeratorPermissions(
      CONFIG_PERMISSIONS,
      'save configuration'
    );
    const values = await c.req.json<FirewatchConfigFormValues>();
    await saveConfig(configUpdateFromFormValues(values));

    return uiSuccessToastResponse(c, 'Settings saved');
  } catch (error) {
    return uiErrorResponse(
      c,
      error,
      'Error saving settings',
      'Could not save settings'
    );
  }
});
