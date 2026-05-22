import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ActionResponse,
  ConfigResponse,
  DashboardInitResponse,
  ErrorResponse,
} from '../../shared/api';
import {
  claimIncident,
  cleanUpIncident,
  coolDownIncident,
  createDemoIncident,
  escalateIncident,
  getConfig,
  getIncidentById,
  getIncidents,
  lockIncident,
  lockdownIncident,
  removeFlaggedComment,
  resolveIncident,
  saveConfig,
} from '../core/firewatch';

export const api = new Hono();

api.get('/init', async (c) => {
  try {
    const selectedPostId =
      typeof context.postData?.incidentPostId === 'string'
        ? context.postData.incidentPostId
        : undefined;
    const [incidents, selectedIncident, config, username] = await Promise.all([
      getIncidents(),
      selectedPostId ? getIncidentById(selectedPostId) : undefined,
      getConfig(),
      reddit.getCurrentUsername(),
    ]);
    const mergedIncidents =
      selectedIncident &&
      !incidents.some((incident) => incident.postId === selectedIncident.postId)
        ? [selectedIncident, ...incidents]
        : incidents;

    return c.json<DashboardInitResponse>({
      type: 'dashboard',
      username: username ?? 'anonymous',
      subredditName: context.subredditName,
      selectedPostId,
      incidents: mergedIncidents,
      config,
    });
  } catch (error) {
    console.error('API Init Error:', error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    return c.json<ErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/incidents/:postId/claim', async (c) => {
  try {
    const incident = await claimIncident(c.req.param('postId'));
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/cool-down', async (c) => {
  try {
    const incident = await coolDownIncident(c.req.param('postId'));
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/cleanup', async (c) => {
  try {
    const body = await c.req.json<{
      commentIds?: string[];
      reason?: string;
    }>();
    const incident = await cleanUpIncident(
      c.req.param('postId'),
      body.commentIds ?? [],
      body.reason
    );
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/lock', async (c) => {
  try {
    const incident = await lockIncident(c.req.param('postId'));
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/lockdown', async (c) => {
  try {
    const incident = await lockdownIncident(c.req.param('postId'));
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/escalate', async (c) => {
  try {
    const incident = await escalateIncident(c.req.param('postId'));
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/resolve', async (c) => {
  try {
    const incident = await resolveIncident(c.req.param('postId'));
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/demo/incident', async (c) => {
  try {
    const incident = await createDemoIncident();
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/config', async (c) => {
  try {
    const values = await c.req.json<{
      keywords?: string;
      suspiciousDomains?: string;
      heatThreshold?: number;
      fireThreshold?: number;
      wildfireThreshold?: number;
    }>();
    const config = await saveConfig(values);
    return c.json<ConfigResponse>({ type: 'config', config });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/comments/:commentId/remove', async (c) => {
  try {
    const incident = await removeFlaggedComment(
      c.req.param('postId'),
      c.req.param('commentId')
    );
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

const incidentActionError = (
  c: HonoContext,
  error: unknown
) => {
  console.error('Incident action failed:', error);
  return c.json<ErrorResponse>(
    {
      status: 'error',
      message: error instanceof Error ? error.message : 'Incident action failed',
    },
    400
  );
};
