import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import {
  createDemoIncident,
  getConfigFormDefaults,
  getOrCreateFirewatchBoardPost,
  rememberSelectedIncident,
  upsertIncidentSignal,
} from '../core/firewatch';

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
    console.error(`Error opening Firewatch mod queue: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not open Firewatch mod queue',
      },
      400
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
    console.error(`Error sending post to Firewatch: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not send this post to Firewatch',
      },
      400
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
    console.error(`Error creating Firewatch demo post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not create a demo post',
      },
      400
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
          title: 'Firewatch filters',
          description:
            'Choose the words, domains, and scores that send posts into review.',
          acceptLabel: 'Save',
          fields: [
            {
              type: 'paragraph',
              name: 'keywords',
              label: 'Watched words',
              defaultValue: defaults.keywords,
            },
            {
              type: 'paragraph',
              name: 'suspiciousDomains',
              label: 'Watched domains',
              defaultValue: defaults.suspiciousDomains,
            },
            {
              type: 'number',
              name: 'heatThreshold',
              label: 'Review score',
              defaultValue: defaults.heatThreshold,
            },
            {
              type: 'number',
              name: 'fireThreshold',
              label: 'Act score',
              defaultValue: defaults.fireThreshold,
            },
            {
              type: 'number',
              name: 'wildfireThreshold',
              label: 'Lock score',
              defaultValue: defaults.wildfireThreshold,
            },
          ],
        },
      },
    });
  } catch (error) {
    console.error(`Error opening Firewatch filters: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not open Firewatch filters',
      },
      400
    );
  }
});
