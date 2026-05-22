import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import {
  createDemoIncident,
  createFirewatchPost,
  getConfigFormDefaults,
  upsertIncidentSignal,
} from '../core/firewatch';

export const menu = new Hono();

menu.post('/open-board', async (c) => {
  try {
    const post = await createFirewatchPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    console.error(`Error opening Firewatch board: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to open Firewatch board',
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
      postId: input.targetId,
      reason: 'Manual moderator escalation',
    });
    const post = await createFirewatchPost({ incidentPostId: incident.postId });

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    console.error(`Error escalating post to Firewatch: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to escalate this post',
      },
      400
    );
  }
});

menu.post('/create-demo-incident', async (c) => {
  try {
    const incident = await createDemoIncident();
    const post = await createFirewatchPost({ incidentPostId: incident.postId });

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating Firewatch demo incident: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create Firewatch demo incident',
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
          title: 'Configure Firewatch',
          description:
            'Tune deterministic signals. Keep comma-separated terms specific to this community.',
          acceptLabel: 'Save',
          fields: [
            {
              type: 'paragraph',
              name: 'keywords',
              label: 'Heated keywords',
              defaultValue: defaults.keywords,
            },
            {
              type: 'paragraph',
              name: 'suspiciousDomains',
              label: 'Suspicious domains',
              defaultValue: defaults.suspiciousDomains,
            },
            {
              type: 'number',
              name: 'heatThreshold',
              label: 'Heat threshold',
              defaultValue: defaults.heatThreshold,
            },
            {
              type: 'number',
              name: 'fireThreshold',
              label: 'Fire threshold',
              defaultValue: defaults.fireThreshold,
            },
            {
              type: 'number',
              name: 'wildfireThreshold',
              label: 'Wildfire threshold',
              defaultValue: defaults.wildfireThreshold,
            },
          ],
        },
      },
    });
  } catch (error) {
    console.error(`Error opening Firewatch config: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to open Firewatch settings',
      },
      400
    );
  }
});
