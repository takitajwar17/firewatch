import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ActionResponse,
  AppResetResponse,
  BulkCommentReviewInput,
  ConfigResponse,
  CrowdControlLevel,
  DashboardInitResponse,
  DemoResetResponse,
  FirewatchDemoScenarioId,
  FirewatchRuleInput,
  Incident,
  NativeCommentAction,
  NativePostAction,
  NativeUserAction,
  PostFlairOption,
  RulesResponse,
  RuleTestResponse,
} from '../../shared/api';
import type { FirewatchConfigUpdate } from '../../shared/firewatch-config';
import { errorResponse } from './responses';
import {
  applyNativeCommentAction,
  applyNativePostAction,
  applyNativeUserAction,
  approveFlaggedComment,
  banUserAndRemoveComments,
  bulkReviewComments,
  claimIncident,
  clearIncidentUserStrikes,
  coolDownIncident,
  createDemoIncident,
  escalateIncident,
  getConfig,
  getIncidentById,
  getIncidents,
  getRememberedIncidentPostId,
  lockIncident,
  removeFlaggedComment,
  resetAppData,
  resetDemoIncidents,
  resolveIncident,
  runPreparedRuleActions,
  saveConfig,
  undoIncidentAction,
  unclaimIncident,
} from '../core/firewatch';
import {
  disableAllAutomations,
  getAutomations,
  getRuleExecutionLogs,
  importAutomationTemplates,
  saveAutomation,
} from '../core/firewatch-rules/store';
import { testAutomation } from '../core/firewatch-rules/matching';
import { normalizeUsername } from '../core/firewatch-utils';

export const api = new Hono();

const currentModeratorName = async () =>
  normalizeUsername(
    context.username ?? (await reddit.getCurrentUsername()) ?? undefined
  );

const loadDashboardData = async (): Promise<DashboardInitResponse> => {
  const contextSelectedPostId =
    typeof context.postData?.incidentPostId === 'string'
      ? context.postData.incidentPostId
      : undefined;
  const subredditName = context.subredditName;
  const [incidents, config, username, postFlairOptions, rules, ruleLogs] =
    await Promise.all([
      getIncidents(),
      getConfig(),
      currentModeratorName(),
      getPostFlairOptions(subredditName),
      getAutomations(subredditName),
      getRuleExecutionLogs(subredditName),
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
    subredditName,
    selectedPostId,
    incidents: mergedIncidents,
    config,
    postFlairOptions,
    rules,
    ruleLogs,
  };
};

const getPostFlairOptions = async (
  subredditName: string
): Promise<PostFlairOption[]> => {
  try {
    const templates = await reddit.getPostFlairTemplates(subredditName);
    const options: PostFlairOption[] = [];

    for (const template of templates) {
      const text = template.text.trim();
      if (text.length === 0) continue;

      options.push({
        id: template.id,
        text,
        backgroundColor: template.backgroundColor,
        textColor: template.textColor,
        modOnly: template.modOnly,
        allowUserEdits: template.allowUserEdits,
      });
    }

    return options;
  } catch (error) {
    console.error('Could not load post flair templates:', error);
    return [];
  }
};

const readOptionalJson = async <Body extends object>(
  c: HonoContext
): Promise<Partial<Body>> => c.req.json<Partial<Body>>().catch(() => ({}));

api.get('/init', async (c) => {
  try {
    return c.json<DashboardInitResponse>(await loadDashboardData());
  } catch (error) {
    return errorResponse(c, error, {
      fallbackMessage: 'Unknown error during initialization',
      logMessage: 'API Init Error:',
      messagePrefix: 'Initialization failed: ',
    });
  }
});

api.post('/incidents/:postId/claim', async (c) => {
  return incidentAction(c, () => claimIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/unclaim', async (c) => {
  return claimedIncidentAction(c, () => unclaimIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/cool-down', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body = await readOptionalJson<{ reminderText: string }>(c);
    return coolDownIncident(c.req.param('postId'), body.reminderText);
  });
});

api.post('/incidents/:postId/lock', async (c) => {
  return claimedIncidentAction(c, () => lockIncident(c.req.param('postId')));
});

api.post('/incidents/:postId/post-action', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body: {
      action: NativePostAction;
      crowdControlLevel?: CrowdControlLevel;
      flairTemplateId?: string;
      flairText?: string;
      reason?: string;
    } = await c.req.json();
    return applyNativePostAction(c.req.param('postId'), body);
  });
});

api.post('/incidents/:postId/escalate', async (c) => {
  return claimedIncidentAction(c, () =>
    escalateIncident(c.req.param('postId'))
  );
});

api.post('/incidents/:postId/resolve', async (c) => {
  return claimedIncidentAction(c, () =>
    resolveIncident(c.req.param('postId'))
  );
});

api.post('/incidents/:postId/actions/:actionId/undo', async (c) => {
  return claimedIncidentAction(c, () =>
    undoIncidentAction(c.req.param('postId'), c.req.param('actionId'))
  );
});

api.post('/demo/incident', async (c) => {
  return incidentAction(c, async () => {
    const body = await readOptionalJson<{
      scenarioId: FirewatchDemoScenarioId;
    }>(c);
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

api.post('/app/reset', async (c) => {
  try {
    const resetSummary = await resetAppData();
    const dashboard = await loadDashboardData();
    return c.json<AppResetResponse>({ ...dashboard, ...resetSummary });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/config', async (c) => {
  try {
    const values = await c.req.json<FirewatchConfigUpdate>();
    const config = await saveConfig(values);
    return c.json<ConfigResponse>({ type: 'config', config });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules', async (c) => {
  try {
    const input = await c.req.json<FirewatchRuleInput>();
    const [rules, ruleLogs] = await Promise.all([
      saveAutomation({
        input,
        subredditName: context.subredditName,
        username: context.username ?? 'mod',
      }),
      getRuleExecutionLogs(context.subredditName),
    ]);
    return c.json<RulesResponse>({ type: 'rules', rules, ruleLogs });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules/import-templates', async (c) => {
  try {
    const [rules, ruleLogs] = await Promise.all([
      importAutomationTemplates(context.subredditName),
      getRuleExecutionLogs(context.subredditName),
    ]);
    return c.json<RulesResponse>({ type: 'rules', rules, ruleLogs });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules/disable-all', async (c) => {
  try {
    const [rules, ruleLogs] = await Promise.all([
      disableAllAutomations(context.subredditName),
      getRuleExecutionLogs(context.subredditName),
    ]);
    return c.json<RulesResponse>({ type: 'rules', rules, ruleLogs });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules/:ruleId/test', async (c) => {
  try {
    const [incidents, config] = await Promise.all([
      getIncidents(),
      getConfig(),
    ]);
    return c.json<RuleTestResponse>(
      await testAutomation({
        config,
        incidents,
        ruleId: c.req.param('ruleId'),
      })
    );
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/incidents/:postId/comments/:commentId/remove', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body = await readOptionalJson<{ reason: string }>(c);
    return removeFlaggedComment(
      c.req.param('postId'),
      c.req.param('commentId'),
      body.reason
    );
  });
});

api.post('/incidents/:postId/comments/:commentId/approve', async (c) => {
  return claimedIncidentAction(c, () =>
    approveFlaggedComment(c.req.param('postId'), c.req.param('commentId'))
  );
});

api.post('/incidents/:postId/comments/bulk-review', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body = await readOptionalJson<BulkCommentReviewInput>(c);
    return bulkReviewComments(c.req.param('postId'), body);
  });
});

api.post('/incidents/:postId/comments/:commentId/native-action', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body: { action: NativeCommentAction; reason?: string } =
      await c.req.json();
    return applyNativeCommentAction(
      c.req.param('postId'),
      c.req.param('commentId'),
      body
    );
  });
});

api.post('/incidents/:postId/users/:username/ban', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body = await readOptionalJson<{
      durationDays: number;
      reason: string;
    }>(c);
    return banUserAndRemoveComments(
      c.req.param('postId'),
      c.req.param('username'),
      body.reason,
      body.durationDays
    );
  });
});

api.post('/incidents/:postId/users/:username/native-action', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body: { action: NativeUserAction; note?: string; reason?: string } =
      await c.req.json();
    return applyNativeUserAction(
      c.req.param('postId'),
      c.req.param('username'),
      body
    );
  });
});

api.post('/incidents/:postId/rules/:ruleId/run', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body = await readOptionalJson<{ targetId: string }>(c);
    return runPreparedRuleActions(
      c.req.param('postId'),
      c.req.param('ruleId'),
      undefined,
      body.targetId
    );
  });
});

api.post('/incidents/:postId/users/:username/strikes/clear', async (c) => {
  return claimedIncidentAction(c, () =>
    clearIncidentUserStrikes(c.req.param('postId'), c.req.param('username'))
  );
});

const claimKeyFor = (username: string | undefined) =>
  normalizeUsername(username)?.toLowerCase();

const requireIncidentClaim = async (postId: string) => {
  const incident = await getIncidentById(postId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await currentModeratorName();
  if (!actor) throw new Error('Could not identify the current moderator');

  const claimOwner = incident.claim?.username;
  if (!claimOwner) {
    throw new Error('Claim this post before taking mod actions.');
  }

  if (claimKeyFor(claimOwner) !== claimKeyFor(actor)) {
    throw new Error(
      `Claimed by u/${claimOwner}. Only that mod can take actions.`
    );
  }
};

const claimedIncidentAction = async (
  c: HonoContext,
  run: () => Promise<Incident>
) => {
  try {
    const postId = c.req.param('postId');
    if (!postId) throw new Error('Missing post id');

    await requireIncidentClaim(postId);
    const incident = await run();
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
};

const incidentAction = async (c: HonoContext, run: () => Promise<Incident>) => {
  try {
    const incident = await run();
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
};

const incidentActionError = (c: HonoContext, error: unknown) =>
  errorResponse(c, error, {
    fallbackMessage: 'Action failed',
    logMessage: 'Firewatch action failed:',
  });
