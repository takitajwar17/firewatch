import { useCallback, useEffect, useMemo, useState } from 'react';

declare const pendo: { track: (event: string, properties?: Record<string, unknown>) => void } | undefined;
import type {
  AccessDeniedResponse,
  AppResetResponse,
  ConfigResponse,
  DashboardInitResponse,
  DashboardResponse,
  DemoCreateResponse,
  DemoResetResponse,
  FirewatchDemoScenarioId,
  FirewatchRuleInput,
  Incident,
  RulesResponse,
  RuleTestResponse,
} from '../../shared/api';
import { sortIncidentsByPriority } from '../../shared/incidents';
import { requestJson } from './api-client';
import { actionLabel, actionSuccessMessage, emptyConfig } from './format';
import type {
  ActionRunner,
  ConfigFormValues,
  LoadState,
  Notice,
} from './types';

const EMPTY_DASHBOARD: DashboardInitResponse = {
  type: 'dashboard',
  username: 'moderator',
  subredditName: '',
  moderatorPermissions: [],
  incidents: [],
  config: emptyConfig,
  postFlairOptions: [],
  rules: [],
  ruleLogs: [],
};

const fetchDashboardInit = () => requestJson<DashboardResponse>('/api/init');

type RefreshOptions = {
  preserveOnError?: boolean;
};

export const useDashboard = () => {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [selectedPostId, setSelectedPostId] = useState<string | undefined>();
  const [busyAction, setBusyAction] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();

  const applyDashboard = useCallback((data: DashboardInitResponse) => {
    setLoadState({ status: 'ready', data });
    setSelectedPostId((current) =>
      current && data.incidents.some((incident) => incident.postId === current)
        ? current
        : (data.selectedPostId ?? data.incidents[0]?.postId)
    );
  }, []);

  const applyAccessDenied = useCallback((data: AccessDeniedResponse) => {
    setLoadState({ status: 'access_denied', data });
    setSelectedPostId(undefined);
  }, []);

  const applyDashboardResponse = useCallback(
    (payload: DashboardResponse) => {
      if (payload.type === 'access_denied') {
        applyAccessDenied(payload);
        return;
      }

      applyDashboard(payload);
    },
    [applyAccessDenied, applyDashboard]
  );

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    try {
      applyDashboardResponse(await fetchDashboardInit());
      return true;
    } catch (error) {
      if (!options.preserveOnError) {
        setLoadState({
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to load dashboard',
        });
      }
      return false;
    }
  }, [applyDashboardResponse]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchDashboardInit();
        if (!cancelled) applyDashboardResponse(data);
      } catch (error) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Failed to load dashboard',
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyDashboardResponse]);

  useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(
      () => setNotice((current) => (current === notice ? undefined : current)),
      notice.type === 'success' ? 2800 : 6000
    );

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const data = loadState.status === 'ready' ? loadState.data : EMPTY_DASHBOARD;

  const selectedIncident = useMemo(
    () =>
      data.incidents.find((incident) => incident.postId === selectedPostId) ??
      data.incidents[0],
    [data.incidents, selectedPostId]
  );

  const updateIncident = useCallback((updatedIncident: Incident) => {
    setLoadState((current) => {
      if (current.status !== 'ready') return current;

      const currentHasIncident = current.data.incidents.some(
        (incident) => incident.postId === updatedIncident.postId
      );
      const incidents = currentHasIncident
        ? current.data.incidents.map((incident) =>
            incident.postId === updatedIncident.postId
              ? updatedIncident
              : incident
          )
        : [updatedIncident, ...current.data.incidents];

      return {
        status: 'ready',
        data: {
          ...current.data,
          incidents: sortIncidentsByPriority(incidents),
        },
      };
    });
    setSelectedPostId(updatedIncident.postId);
  }, []);

  const runAction: ActionRunner = useCallback(async (action, endpoint, body) => {
    setBusyAction(action);
    setNotice(undefined);
    try {
      const payload = await requestJson<{ incident: Incident }>(endpoint, {
        body,
        method: 'POST',
      });
      updateIncident(payload.incident);
      setNotice({ type: 'success', message: actionSuccessMessage(action) });
      await refresh({ preserveOnError: true });
      return payload.incident;
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `${actionLabel(action)} failed: ${error.message}`
            : `${actionLabel(action)} failed.`,
      });
      return undefined;
    } finally {
      setBusyAction(undefined);
    }
  }, [refresh, updateIncident]);

  const createDemoIncident = useCallback(
    async (scenarioIds?: FirewatchDemoScenarioId | FirewatchDemoScenarioId[]) => {
      const selectedScenarioIds = Array.isArray(scenarioIds)
        ? scenarioIds
        : scenarioIds
          ? [scenarioIds]
          : [];

      if (selectedScenarioIds.length <= 1) {
        const body = selectedScenarioIds[0]
          ? { scenarioId: selectedScenarioIds[0] }
          : undefined;

        const result = await runAction('demo', '/api/demo/incident', body);
        if (result && typeof pendo !== 'undefined') {
          pendo.track('demo_incident_created', {
            scenarioIds: selectedScenarioIds,
            createdCount: 1,
            failedCount: 0,
            isBatch: false,
            moderatorUsername: data.username,
            subredditName: data.subredditName,
          });
        }
        return result;
      }

      setBusyAction('demo');
      setNotice(undefined);

      let createdIncidents: Incident[];
      let failedCount: number;
      try {
        const payload = await requestJson<DemoCreateResponse>(
          '/api/demo/incident',
          {
            body: { scenarioIds: selectedScenarioIds },
            method: 'POST',
          }
        );
        createdIncidents = payload.createdIncidents;
        failedCount = payload.failures.length;
        payload.createdIncidents.forEach(updateIncident);
        if (typeof pendo !== 'undefined') {
          pendo.track('demo_incident_created', {
            scenarioIds: selectedScenarioIds,
            createdCount: payload.createdIncidents.length,
            failedCount: payload.failures.length,
            isBatch: true,
            moderatorUsername: data.username,
            subredditName: data.subredditName,
          });
        }
      } catch (error) {
        createdIncidents = [];
        failedCount = selectedScenarioIds.length;
      }

      try {
        await refresh({ preserveOnError: true });
      } finally {
        setBusyAction(undefined);
      }

      const createdCount = createdIncidents.length;
      if (createdCount > 0) {
        setNotice({
          type: failedCount > 0 ? 'error' : 'success',
          message:
            failedCount > 0
              ? `${createdCount} demo threads created. ${failedCount} failed.`
              : `${createdCount} demo threads created.`,
        });
        return createdIncidents.at(-1);
      }

      setNotice({
        type: 'error',
        message:
          failedCount === 1
            ? 'Create demo thread failed.'
            : 'Create demo threads failed.',
      });
      return undefined;
    },
    [data.username, data.subredditName, refresh, runAction, updateIncident]
  );

  const resetDemoIncidents = useCallback(async () => {
    setBusyAction('reset-demo');
    setNotice(undefined);
    try {
      const payload = await requestJson<DemoResetResponse>('/api/demo/reset', {
        method: 'POST',
      });
      applyDashboard(payload);
      if (typeof pendo !== 'undefined') {
        pendo.track('demo_data_reset', {
          resetCount: payload.resetCount,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({
        type: 'success',
        message:
          payload.resetCount === 1
            ? 'Demo post deleted.'
            : `${payload.resetCount} demo posts deleted.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not reset demos: ${error.message}`
            : 'Could not reset demos.',
      });
    } finally {
      setBusyAction(undefined);
    }
  }, [applyDashboard, data.username, data.subredditName]);

  const resetAppData = useCallback(async () => {
    setBusyAction('reset-app');
    setNotice(undefined);
    try {
      const payload = await requestJson<AppResetResponse>('/api/app/reset', {
        method: 'POST',
      });
      applyDashboard(payload);
      if (typeof pendo !== 'undefined') {
        pendo.track('app_data_reset', {
          deletedKeys: payload.deletedKeys,
          incidentCount: payload.incidentCount,
          redditPostDeleteCount: payload.redditPostDeleteCount,
          redditPostDeleteFailures: payload.redditPostDeleteFailures,
          userCount: payload.userCount,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({
        type: 'success',
        message: `Firewatch data reset. Deleted ${payload.deletedKeys} stored record${
          payload.deletedKeys === 1 ? '' : 's'
        }.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not reset Firewatch: ${error.message}`
            : 'Could not reset Firewatch.',
      });
    } finally {
      setBusyAction(undefined);
    }
  }, [applyDashboard, data.username, data.subredditName]);

  const saveDashboardConfig = useCallback(async (values: ConfigFormValues) => {
    setBusyAction('config');
    setNotice(undefined);
    try {
      const payload = await requestJson<ConfigResponse>('/api/config', {
        body: values,
        method: 'POST',
      });
      setLoadState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              data: {
                ...current.data,
                config: payload.config,
              },
            }
          : current
      );
      if (typeof pendo !== 'undefined') {
        const keywords = values.keywords?.split('\n').filter(Boolean) ?? [];
        const domains = values.suspiciousDomains?.split('\n').filter(Boolean) ?? [];
        pendo.track('community_config_saved', {
          keywordCount: keywords.length,
          suspiciousDomainCount: domains.length,
          heatThreshold: values.heatThreshold,
          fireThreshold: values.fireThreshold,
          wildfireThreshold: values.wildfireThreshold,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({ type: 'success', message: 'Settings saved.' });
      await refresh({ preserveOnError: true });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not save settings: ${error.message}`
            : 'Could not save settings.',
      });
    } finally {
      setBusyAction(undefined);
    }
  }, [data.username, data.subredditName, refresh]);

  const applyRulesResponse = useCallback((payload: RulesResponse) => {
    setLoadState((current) =>
      current.status === 'ready'
        ? {
            status: 'ready',
            data: {
              ...current.data,
              rules: payload.rules,
              ruleLogs: payload.ruleLogs,
            },
          }
        : current
    );
  }, []);

  const saveAutomation = useCallback(async (values: FirewatchRuleInput) => {
    setBusyAction('rule-save');
    setNotice(undefined);
    try {
      const payload = await requestJson<RulesResponse>('/api/rules', {
        body: values,
        method: 'POST',
      });
      applyRulesResponse(payload);
      if (typeof pendo !== 'undefined') {
        pendo.track('automation_rule_saved', {
          ruleId: values.id,
          ruleName: values.name,
          isNew: !values.id,
          enabled: values.enabled,
          triggerType: values.trigger,
          conditionCount: values.conditions?.length ?? 0,
          actionCount: values.actions?.length ?? 0,
          mode: values.mode,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({ type: 'success', message: 'Automation saved.' });
      await refresh({ preserveOnError: true });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not save automation: ${error.message}`
            : 'Could not save automation.',
      });
    } finally {
      setBusyAction(undefined);
    }
  }, [applyRulesResponse, data.username, data.subredditName, refresh]);

  const importRuleTemplates = useCallback(async () => {
    setBusyAction('rule-import');
    setNotice(undefined);
    try {
      const payload = await requestJson<RulesResponse>(
        '/api/rules/import-templates',
        { method: 'POST' }
      );
      applyRulesResponse(payload);
      if (typeof pendo !== 'undefined') {
        pendo.track('automation_templates_imported', {
          importedRuleCount: payload.rules?.length ?? 0,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({
        type: 'success',
        message: 'Automation templates loaded.',
      });
      await refresh({ preserveOnError: true });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not import templates: ${error.message}`
            : 'Could not import templates.',
      });
    } finally {
      setBusyAction(undefined);
    }
  }, [applyRulesResponse, data.username, data.subredditName, refresh]);

  const disableAllRules = useCallback(async () => {
    setBusyAction('rule-disable-all');
    setNotice(undefined);
    try {
      const payload = await requestJson<RulesResponse>(
        '/api/rules/disable-all',
        { method: 'POST' }
      );
      applyRulesResponse(payload);
      if (typeof pendo !== 'undefined') {
        pendo.track('automations_bulk_disabled', {
          disabledRuleCount: payload.rules?.length ?? 0,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({ type: 'success', message: 'All automations disabled.' });
      await refresh({ preserveOnError: true });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not disable automations: ${error.message}`
            : 'Could not disable automations.',
      });
    } finally {
      setBusyAction(undefined);
    }
  }, [applyRulesResponse, data.username, data.subredditName, refresh]);

  const testAutomation = useCallback(async (ruleId: string) => {
    setBusyAction(`rule-test:${ruleId}`);
    setNotice(undefined);
    try {
      const payload = await requestJson<RuleTestResponse>(
        `/api/rules/${ruleId}/test`,
        { method: 'POST' }
      );
      if (typeof pendo !== 'undefined') {
        pendo.track('automation_rule_tested', {
          ruleId,
          ruleName: payload.ruleName,
          matchedCount: payload.matchedCount,
          moderatorUsername: data.username,
          subredditName: data.subredditName,
        });
      }
      setNotice({
        type: 'success',
        message: `${payload.ruleName} matched ${payload.matchedCount} item${
          payload.matchedCount === 1 ? '' : 's'
        }.`,
      });
      return payload;
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? `Could not test automation: ${error.message}`
            : 'Could not test automation.',
      });
      return undefined;
    } finally {
      setBusyAction(undefined);
    }
  }, [data.username, data.subredditName]);

  return {
    busyAction,
    createDemoIncident,
    data,
    disableAllRules,
    importRuleTemplates,
    loadState,
    notice,
    refresh,
    resetAppData,
    resetDemoIncidents,
    runAction,
    saveAutomation,
    saveDashboardConfig,
    selectedIncident,
    selectedPostId,
    setSelectedPostId,
    testAutomation,
  };
};
