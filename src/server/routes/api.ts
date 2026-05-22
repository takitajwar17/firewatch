import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ActionResponse,
  DashboardInitResponse,
  ErrorResponse,
} from '../../shared/api';
import {
  claimIncident,
  coolDownIncident,
  getConfig,
  getIncidentById,
  getIncidents,
  lockIncident,
  removeFlaggedComment,
  resolveIncident,
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

api.post('/incidents/:postId/lock', async (c) => {
  try {
    const incident = await lockIncident(c.req.param('postId'));
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
