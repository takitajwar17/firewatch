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
import { uiErrorResponse } from './responses';

export const menu = new Hono();

menu.post('/open-board', async (c) => {
  try {
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
      'Error opening Firewatch mod queue',
      'Could not open Firewatch mod queue'
    );
  }
});

menu.post('/escalate-post', async (c) => {
  try {
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
    const defaults = await getConfigFormDefaults();

    return c.json<UiResponse>({
      showForm: {
        name: 'firewatchConfig',
        form: {
          title: 'Settings',
          description:
            'Choose what Firewatch watches, how strongly each signal counts, and which actions mods can take from the queue.',
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
