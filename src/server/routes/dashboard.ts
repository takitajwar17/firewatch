import { context, reddit } from '@devvit/web/server';
import type {
  DashboardInitResponse,
  FirewatchConfig,
  PostFlairOption,
} from '../../shared/api';
import { EMPTY_CONFIG } from '../../shared/firewatch-config';
import {
  clearRememberedIncident,
  getConfig,
  getIncidentById,
  getIncidents,
  getRememberedIncidentPostId,
} from '../core/firewatch';
import { getAutomations, getRuleExecutionLogs } from '../core/firewatch-rules/store';
import { logFirewatchWarn } from '../core/firewatch/logging';
import { currentModeratorName } from '../core/firewatch/moderators';
import {
  CONFIG_PERMISSIONS,
  DASHBOARD_PERMISSIONS,
  FLAIR_MODERATION_PERMISSIONS,
  getModeratorAccess,
  hasModeratorPermissions,
} from './auth';

type ModeratorAccess = Awaited<ReturnType<typeof getModeratorAccess>>;

export { currentModeratorName };

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

/**
 * Loads the full dashboard payload in one server-side pass. The function keeps
 * mod-only configuration and automation data behind the same permission checks
 * that protect the write endpoints.
 */
export const loadDashboardData = async (
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
