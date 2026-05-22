import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ActionResponse,
  ConfigResponse,
  DashboardInitResponse,
  DemoResetResponse,
  ErrorResponse,
  FirewatchDemoScenarioId,
  Incident,
} from '../../shared/api';
import {
  approveFlaggedComment,
  banUserAndRemoveComments,
  claimIncident,
  coolDownIncident,
  createDemoIncident,
  escalateIncident,
  getConfig,
  getIncidentById,
  getIncidents,
  getRememberedIncidentPostId,
  lockIncident,
  removeFlaggedComment,
  resetDemoIncidents,
  resolveIncident,
  saveConfig,
} from '../core/firewatch';

export const api = new Hono();

const loadDashboardData = async (): Promise<DashboardInitResponse> => {
  const contextSelectedPostId =
    typeof context.postData?.incidentPostId === 'string'
      ? context.postData.incidentPostId
      : undefined;
  const [incidents, config, username] = await Promise.all([
    getIncidents(),
    getConfig(),
    reddit.getCurrentUsername(),
  ]);
  const selectedPostId =
    contextSelectedPostId ??
    (await getRememberedIncidentPostId(username ?? undefined));
  const selectedIncident = selectedPostId
    ? await getIncidentById(selectedPostId)
    : undefined;
  const mergedIncidents =
    selectedIncident &&
    !incidents.some((incident) => incident.postId === selectedIncident.postId)
      ? [selectedIncident, ...incidents]
      : incidents;

  return {
    type: 'dashboard',
    username: username ?? 'anonymous',
    subredditName: context.subredditName,
    selectedPostId,
    incidents: mergedIncidents,
    config,
  };
};

api.get('/init', async (c) => {
  try {
    return c.json<DashboardInitResponse>(await loadDashboardData());
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
  return incidentAction(c, () => claimIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/cool-down', async (c) => {
  return incidentAction(c, () => coolDownIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/lock', async (c) => {
  return incidentAction(c, () => lockIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/escalate', async (c) => {
  return incidentAction(c, () => escalateIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/resolve', async (c) => {
  return incidentAction(c, () => resolveIncident(c.req.param('postId')));
});

api.post('/demo/incident', async (c) => {
  return incidentAction(c, async () => {
    const body: { scenarioId?: FirewatchDemoScenarioId } = await c.req
      .json<{ scenarioId?: FirewatchDemoScenarioId }>()
      .catch(() => ({}));
    return createDemoIncident(body.scenarioId);
  });
});

api.post('/demo/reset', async (c) => {
  try {
    const resetCount = await resetDemoIncidents();
    const dashboard = await loadDashboardData();
    return c.json<DemoResetResponse>({ ...dashboard, resetCount });
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
  return incidentAction(c, async () => {
    const body: { reason?: string } = await c.req
      .json<{ reason?: string }>()
      .catch(() => ({}));
    return removeFlaggedComment(
      c.req.param('postId'),
      c.req.param('commentId'),
      body.reason
    );
  });
});

api.post('/incidents/:postId/comments/:commentId/approve', async (c) => {
  return incidentAction(c, () =>
    approveFlaggedComment(c.req.param('postId'), c.req.param('commentId'))
  );
});

api.post('/incidents/:postId/users/:username/ban', async (c) => {
  return incidentAction(c, async () => {
    const body: { reason?: string } = await c.req
      .json<{ reason?: string }>()
      .catch(() => ({}));
    return banUserAndRemoveComments(
      c.req.param('postId'),
      c.req.param('username'),
      body.reason
    );
  });
});

const incidentAction = async (
  c: HonoContext,
  run: () => Promise<Incident>
) => {
  try {
    const incident = await run();
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
};

const incidentActionError = (
  c: HonoContext,
  error: unknown
) => {
  console.error('Firewatch action failed:', error);
  return c.json<ErrorResponse>(
    {
      status: 'error',
      message: error instanceof Error ? error.message : 'Action failed',
    },
    400
  );
};
