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
  DashboardResponse,
  DemoCreateResponse,
  DemoResetResponse,
  FirewatchConfig,
  FirewatchDemoScenarioId,
  IncidentActionType,
  FirewatchModeratorPermission,
  FirewatchRuleInput,
  Incident,
  NativeCommentAction,
  NativePostAction,
  NativeUserAction,
  PostFlairOption,
  RuleAction,
  RulesResponse,
  RuleTestResponse,
} from '../../shared/api';
import {
  EMPTY_CONFIG,
  type FirewatchConfigUpdate,
} from '../../shared/firewatch-config';
import { errorResponse } from './responses';
import {
  applyNativeCommentAction,
  applyNativePostAction,
  applyNativeUserAction,
  approveFlaggedComment,
  banUserAndRemoveComments,
  bulkReviewComments,
  claimIncident,
  clearRememberedIncident,
  clearIncidentUserStrikes,
  coolDownIncident,
  createDemoIncidents,
  createDemoIncidentBatch,
  escalateIncident,
  getConfig,
  getIncidentById,
  getIncidents,
  getRememberedIncidentPostId,
  hideMatchedRule,
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
import { normalizeUsername, usernameKey } from '../core/firewatch-utils';
import { logFirewatchWarn } from '../core/firewatch/logging';
import {
  CONFIG_PERMISSIONS,
  DASHBOARD_PERMISSIONS,
  FLAIR_MODERATION_PERMISSIONS,
  POST_MODERATION_PERMISSIONS,
  USER_MODERATION_PERMISSIONS,
  accessDeniedPayload,
  getModeratorAccess,
  hasModeratorPermissions,
  requireModeratorPermissions,
} from './auth';

/**
 * Client-facing API for the Firewatch web view. Every response shape is typed
 * in src/shared/api.ts so the iframe and server stay in lockstep.
 */
export const api = new Hono();

const currentModeratorName = async () =>
  normalizeUsername(
    context.username ?? (await reddit.getCurrentUsername()) ?? undefined
  );

const reviewVisibleConfig = (
  config: FirewatchConfig,
  canConfigure: boolean
): FirewatchConfig =>
  canConfigure
    ? config
    : {
        ...EMPTY_CONFIG,
        actionControls: config.actionControls,
        reminderText: config.reminderText,
      };

type ModeratorAccess = Awaited<ReturnType<typeof getModeratorAccess>>;

const loadDashboardData = async (
  initialAccess?: ModeratorAccess
): Promise<DashboardInitResponse> => {
  const contextSelectedPostId =
    typeof context.postData?.incidentPostId === 'string'
      ? context.postData.incidentPostId
      : undefined;
  const subredditName = context.subredditName;
  const [access, incidents, config, username] = await Promise.all([
    initialAccess ?? getModeratorAccess(DASHBOARD_PERMISSIONS),
    getIncidents(),
    getConfig(),
    currentModeratorName(),
  ]);
  const canConfigure = hasModeratorPermissions(
    access.grantedPermissions,
    CONFIG_PERMISSIONS
  );
  const canUseFlair = hasModeratorPermissions(
    access.grantedPermissions,
    FLAIR_MODERATION_PERMISSIONS
  );
  const [postFlairOptions, rules, ruleLogs] = await Promise.all([
    canUseFlair ? getPostFlairOptions(subredditName) : Promise.resolve([]),
    canConfigure ? getAutomations(subredditName) : Promise.resolve([]),
    canConfigure ? getRuleExecutionLogs(subredditName) : Promise.resolve([]),
  ]);
  const requestedSelectedPostId =
    contextSelectedPostId ??
    (await getRememberedIncidentPostId(username ?? undefined));
  const selectedIncident = requestedSelectedPostId
    ? await getIncidentById(requestedSelectedPostId)
    : undefined;
  if (requestedSelectedPostId && !contextSelectedPostId && !selectedIncident) {
    await clearRememberedIncident();
  }
  const selectedPostId = selectedIncident?.postId;
  const mergedIncidents =
    selectedIncident &&
    !incidents.some((incident) => incident.postId === selectedIncident.postId)
      ? [selectedIncident, ...incidents]
      : incidents;

  return {
    type: 'dashboard',
    username: username ?? 'anonymous',
    subredditName,
    moderatorPermissions: access.grantedPermissions,
    selectedPostId,
    incidents: mergedIncidents,
    config: reviewVisibleConfig(config, canConfigure),
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
    logFirewatchWarn('api.post_flair_templates_failed', {
      subredditName,
      error,
    });
    return [];
  }
};

const readOptionalJson = async <Body extends object>(
  c: HonoContext
): Promise<Partial<Body>> => c.req.json<Partial<Body>>().catch(() => ({}));

const addPermission = (
  permissions: FirewatchModeratorPermission[],
  permission: FirewatchModeratorPermission
) => {
  if (!permissions.includes(permission)) permissions.push(permission);
};

const mergePermissions = (
  ...groups: FirewatchModeratorPermission[][]
): FirewatchModeratorPermission[] => {
  const permissions: FirewatchModeratorPermission[] = [];
  for (const group of groups) {
    for (const permission of group) {
      addPermission(permissions, permission);
    }
  }
  return permissions;
};

const postActionPermissions = (action: NativePostAction) =>
  action === 'set-flair' || action === 'clear-flair'
    ? mergePermissions(POST_MODERATION_PERMISSIONS, FLAIR_MODERATION_PERMISSIONS)
    : POST_MODERATION_PERMISSIONS;

const userActionPermissions = (action: NativeUserAction) =>
  action === 'remove-recent-content'
    ? mergePermissions(POST_MODERATION_PERMISSIONS, USER_MODERATION_PERMISSIONS)
    : USER_MODERATION_PERMISSIONS;

const ruleActionPermissions = (actions: RuleAction[]) => {
  const permissions = [...POST_MODERATION_PERMISSIONS];

  for (const action of actions) {
    if (
      action.type === 'prepare_temp_ban' ||
      action.type === 'prepare_permanent_ban' ||
      action.type === 'mute_user' ||
      action.type === 'add_native_mod_note' ||
      action.type === 'add_firewatch_strike'
    ) {
      for (const permission of USER_MODERATION_PERMISSIONS) {
        addPermission(permissions, permission);
      }
    }

    if (action.type === 'set_post_flair') {
      for (const permission of FLAIR_MODERATION_PERMISSIONS) {
        addPermission(permissions, permission);
      }
    }
  }

  return permissions;
};

const undoActionPermissions = (type: IncidentActionType) =>
  type === 'post_flaired' || type === 'post_flair_removed'
    ? mergePermissions(POST_MODERATION_PERMISSIONS, FLAIR_MODERATION_PERMISSIONS)
    : POST_MODERATION_PERMISSIONS;

const rulesResponse = async (
  rules: Promise<RulesResponse['rules']>
): Promise<RulesResponse> => {
  const [savedRules, ruleLogs] = await Promise.all([
    rules,
    getRuleExecutionLogs(context.subredditName),
  ]);
  return { type: 'rules', rules: savedRules, ruleLogs };
};

api.get('/init', async (c) => {
  try {
    const access = await getModeratorAccess(DASHBOARD_PERMISSIONS);
    if (!access.allowed) {
      return c.json<DashboardResponse>(
        accessDeniedPayload(access, 'view moderation review data')
      );
    }

    return c.json<DashboardInitResponse>(await loadDashboardData(access));
  } catch (error) {
    return errorResponse(c, error, {
      fallbackMessage: 'Unknown error during initialization',
      logMessage: 'API Init Error:',
      messagePrefix: 'Initialization failed: ',
    });
  }
});

api.post('/incidents/:postId/claim', async (c) => {
  return incidentAction(
    c,
    () => claimIncident(c.req.param('postId')),
    POST_MODERATION_PERMISSIONS,
    'claim a Firewatch post'
  );
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
    await requireModeratorPermissions(
      postActionPermissions(body.action),
      'perform this post action'
    );
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
  return claimedIncidentAction(c, async () => {
    const incident = await getIncidentById(c.req.param('postId'));
    const action = incident?.actions.find(
      (item) => item.id === c.req.param('actionId')
    );
    if (!action) throw new Error('Action was not found');
    await requireModeratorPermissions(
      undoActionPermissions(action.type),
      'undo this action'
    );
    return undoIncidentAction(c.req.param('postId'), c.req.param('actionId'));
  });
});

api.post('/demo/incident', async (c) => {
  try {
    await requireModeratorPermissions(
      POST_MODERATION_PERMISSIONS,
      'create demo review posts'
    );
      const body = await readOptionalJson<{
        scenarioId: FirewatchDemoScenarioId;
        scenarioIds: FirewatchDemoScenarioId[];
      }>(c);
      const scenarioIds =
        body.scenarioIds && body.scenarioIds.length > 0
          ? body.scenarioIds
          : body.scenarioId
          ? [body.scenarioId]
          : undefined;

      if (body.scenarioIds && body.scenarioIds.length > 1) {
        const result = await createDemoIncidentBatch(scenarioIds);
        const latestIncident = result.createdIncidents.at(-1);
        if (!latestIncident) {
          throw new Error('No Firewatch demo posts could be created.');
        }
        return c.json<DemoCreateResponse>({
          type: 'demo-create',
          incident: latestIncident,
          createdIncidents: result.createdIncidents,
          failures: result.failures,
        });
      }

      const incident = await createDemoIncidents(scenarioIds);
      return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/demo/reset', async (c) => {
  try {
    await requireModeratorPermissions(
      mergePermissions(CONFIG_PERMISSIONS, POST_MODERATION_PERMISSIONS),
      'reset Firewatch demo data'
    );
    const resetCount = await resetDemoIncidents();
    const dashboard = await loadDashboardData();
    return c.json<DemoResetResponse>({ ...dashboard, resetCount });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/app/reset', async (c) => {
  try {
    await requireModeratorPermissions(
      mergePermissions(CONFIG_PERMISSIONS, POST_MODERATION_PERMISSIONS),
      'reset all Firewatch data'
    );
    const resetSummary = await resetAppData();
    const dashboard = await loadDashboardData();
    return c.json<AppResetResponse>({ ...dashboard, ...resetSummary });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/config', async (c) => {
  try {
    await requireModeratorPermissions(
      CONFIG_PERMISSIONS,
      'change configuration'
    );
    const values = await c.req.json<FirewatchConfigUpdate>();
    const config = await saveConfig(values);
    return c.json<ConfigResponse>({ type: 'config', config });
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules', async (c) => {
  try {
    await requireModeratorPermissions(
      CONFIG_PERMISSIONS,
      'change Firewatch automations'
    );
    const input = await c.req.json<FirewatchRuleInput>();
    return c.json<RulesResponse>(
      await rulesResponse(
        saveAutomation({
          input,
          subredditName: context.subredditName,
          username: context.username ?? 'mod',
        })
      )
    );
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules/import-templates', async (c) => {
  try {
    await requireModeratorPermissions(
      CONFIG_PERMISSIONS,
      'import Firewatch automations'
    );
    return c.json<RulesResponse>(
      await rulesResponse(importAutomationTemplates(context.subredditName))
    );
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules/disable-all', async (c) => {
  try {
    await requireModeratorPermissions(
      CONFIG_PERMISSIONS,
      'disable Firewatch automations'
    );
    return c.json<RulesResponse>(
      await rulesResponse(disableAllAutomations(context.subredditName))
    );
  } catch (error) {
    return incidentActionError(c, error);
  }
});

api.post('/rules/:ruleId/test', async (c) => {
  try {
    await requireModeratorPermissions(
      mergePermissions(CONFIG_PERMISSIONS, POST_MODERATION_PERMISSIONS),
      'test Firewatch automations'
    );
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
    await requireModeratorPermissions(
      USER_MODERATION_PERMISSIONS,
      'ban users from this subreddit'
    );
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
    await requireModeratorPermissions(
      userActionPermissions(body.action),
      'perform this user action'
    );
    return applyNativeUserAction(
      c.req.param('postId'),
      c.req.param('username'),
      body
    );
  });
});

api.post('/incidents/:postId/rules/:ruleId/run', async (c) => {
  return claimedIncidentAction(c, async () => {
    const rule = (await getAutomations(context.subredditName)).find(
      (automation) => automation.id === c.req.param('ruleId')
    );
    if (!rule) throw new Error('Automation not found');
    await requireModeratorPermissions(
      ruleActionPermissions(rule.actions),
      'run prepared automation actions'
    );
    const body = await readOptionalJson<{ targetId: string }>(c);
    return runPreparedRuleActions(
      c.req.param('postId'),
      c.req.param('ruleId'),
      undefined,
      body.targetId
    );
  });
});

api.post('/incidents/:postId/rules/:ruleId/hide', async (c) => {
  return claimedIncidentAction(c, async () => {
    const body = await c.req.json<{
      ruleUpdatedAt?: string;
      targetId?: string;
      targetType?: string;
    }>();
    if (
      !body.targetId ||
      (body.targetType !== 'post' &&
        body.targetType !== 'comment' &&
        body.targetType !== 'user' &&
        body.targetType !== 'incident')
    ) {
      throw new Error('Automation match target was missing');
    }

    return hideMatchedRule(c.req.param('postId'), {
      ruleId: c.req.param('ruleId'),
      ruleUpdatedAt: body.ruleUpdatedAt,
      targetId: body.targetId,
      targetType: body.targetType,
    });
  });
});

api.post('/incidents/:postId/users/:username/strikes/clear', async (c) => {
  return claimedIncidentAction(c, async () => {
    await requireModeratorPermissions(
      USER_MODERATION_PERMISSIONS,
      'clear user strike summaries'
    );
    return clearIncidentUserStrikes(
      c.req.param('postId'),
      c.req.param('username')
    );
  });
});

const requireIncidentClaim = async (postId: string) => {
  const incident = await getIncidentById(postId);
  if (!incident) throw new Error('Post is not in Firewatch yet');

  const actor = await currentModeratorName();
  if (!actor) throw new Error('Could not identify the current moderator');

  const claimOwner = incident.claim?.username;
  if (!claimOwner) {
    throw new Error('Claim this post before taking mod actions.');
  }

  if (usernameKey(claimOwner) !== usernameKey(actor)) {
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

    await requireModeratorPermissions(
      POST_MODERATION_PERMISSIONS,
      'use Firewatch incident actions'
    );
    await requireIncidentClaim(postId);
    const incident = await run();
    return c.json<ActionResponse>({ type: 'action', incident });
  } catch (error) {
    return incidentActionError(c, error);
  }
};

const incidentAction = async (
  c: HonoContext,
  run: () => Promise<Incident>,
  requiredPermissions = POST_MODERATION_PERMISSIONS,
  action = 'use Firewatch'
) => {
  try {
    await requireModeratorPermissions(requiredPermissions, action);
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
