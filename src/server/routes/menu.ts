import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { buildConfigFormFields } from '../../shared/firewatch-config';
import {
  createDemoIncident,
  getConfigFormDefaults,
  getOrCreateFirewatchBoardPost,
  rememberSelectedIncident,
  upsertIncidentSignal,
} from '../core/firewatch';
import {
  CONFIG_PERMISSIONS,
  POST_MODERATION_PERMISSIONS,
  requireModeratorPermissions,
} from './auth';
import { uiErrorResponse } from './responses';

/**
 * Devvit menu action endpoints registered in devvit.json. These routes return
 * UiResponse payloads instead of normal iframe API responses.
 */
export const menu = new Hono();

menu.post('/open-board', async (c) => {
  try {
    await requireModeratorPermissions(
      POST_MODERATION_PERMISSIONS,
      'open Firewatch review data'
    );
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    return uiErrorResponse(
      c,
      error,
      'Error opening Firewatch review post',
      'Could not open Firewatch review post'
    );
  }
});

menu.post('/escalate-post', async (c) => {
  try {
    await requireModeratorPermissions(
      POST_MODERATION_PERMISSIONS,
      'send posts to Firewatch'
    );
    const input = await c.req.json<MenuItemRequest>();
    const incident = await upsertIncidentSignal({
      type: 'manual_escalation',
      source: 'mod_action',
      postId: input.targetId,
      reason: 'Sent from the post menu by a mod',
    });
    await rememberSelectedIncident(incident.postId);
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    return uiErrorResponse(
      c,
      error,
      'Error sending post to Firewatch',
      'Could not send this post to Firewatch'
    );
  }
});

menu.post('/create-demo-incident', async (c) => {
  try {
    await requireModeratorPermissions(
      POST_MODERATION_PERMISSIONS,
      'create demo review posts'
    );
    const incident = await createDemoIncident();
    await rememberSelectedIncident(incident.postId);
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    return uiErrorResponse(
      c,
      error,
      'Error creating Firewatch demo post',
      'Could not create a demo post'
    );
  }
});

menu.post('/configure', async (c) => {
  try {
    await requireModeratorPermissions(
      CONFIG_PERMISSIONS,
      'open configuration'
    );
    const defaults = await getConfigFormDefaults();

    return c.json<UiResponse>({
      showForm: {
        name: 'firewatchConfig',
        form: {
          title: 'Settings',
          description:
            'Choose watched words, domains, scores, and mod actions.',
          acceptLabel: 'Save',
          fields: buildConfigFormFields(defaults),
        },
      },
    });
  } catch (error) {
    return uiErrorResponse(
      c,
      error,
      'Error opening settings',
      'Could not open settings'
    );
  }
});
