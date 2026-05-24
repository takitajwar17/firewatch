import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ConfigResponse,
  DashboardInitResponse,
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
  incidents: [],
  config: emptyConfig,
  postFlairOptions: [],
  rules: [],
  ruleLogs: [],
};

const fetchDashboardInit = () =>
  requestJson<DashboardInitResponse>('/api/init');

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

  const refresh = useCallback(async () => {
    try {
      applyDashboard(await fetchDashboardInit());
    } catch (error) {
      setLoadState({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to load dashboard',
      });
    }
  }, [applyDashboard]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchDashboardInit();
        if (!cancelled) applyDashboard(data);
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
  }, [applyDashboard]);

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

  const updateIncident = (updatedIncident: Incident) => {
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
  };

  const runAction: ActionRunner = async (action, endpoint, body) => {
    setBusyAction(action);
    setNotice(undefined);
    try {
      const payload = await requestJson<{ incident: Incident }>(endpoint, {
        body,
        method: 'POST',
      });
      updateIncident(payload.incident);
      setNotice({ type: 'success', message: actionSuccessMessage(action) });
      if (action.startsWith('rule:') || action.startsWith('clear-strikes:')) {
        void refresh();
      }
      return payload.incident;
    } catch (error) {
      console.error(`Firewatch action failed: ${action}`, error);
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
  };

  const createDemoIncident = (scenarioId?: FirewatchDemoScenarioId) =>
    runAction(
      'demo',
      '/api/demo/incident',
      scenarioId ? { scenarioId } : undefined
    );

  const resetDemoIncidents = async () => {
    setBusyAction('reset-demo');
    setNotice(undefined);
    try {
      const payload = await requestJson<DemoResetResponse>('/api/demo/reset', {
        method: 'POST',
      });
      applyDashboard(payload);
      setNotice({
        type: 'success',
        message:
          payload.resetCount === 1
            ? 'Demo post cleared.'
            : `${payload.resetCount} demo posts cleared.`,
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
  };

  const saveDashboardConfig = async (values: ConfigFormValues) => {
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
      setNotice({ type: 'success', message: 'Settings saved.' });
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
  };

  const applyRulesResponse = (payload: RulesResponse) => {
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
  };

  const saveResponseRule = async (values: FirewatchRuleInput) => {
    setBusyAction('rule-save');
    setNotice(undefined);
    try {
      const payload = await requestJson<RulesResponse>('/api/rules', {
        body: values,
        method: 'POST',
      });
      applyRulesResponse(payload);
      setNotice({ type: 'success', message: 'Automation saved.' });
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
  };

  const importRuleTemplates = async () => {
    setBusyAction('rule-import');
    setNotice(undefined);
    try {
      const payload = await requestJson<RulesResponse>(
        '/api/rules/import-templates',
        { method: 'POST' }
      );
      applyRulesResponse(payload);
      setNotice({
        type: 'success',
        message: 'Automation templates loaded.',
      });
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
  };

  const disableAllRules = async () => {
    setBusyAction('rule-disable-all');
    setNotice(undefined);
    try {
      const payload = await requestJson<RulesResponse>(
        '/api/rules/disable-all',
        { method: 'POST' }
      );
      applyRulesResponse(payload);
      setNotice({ type: 'success', message: 'All automations disabled.' });
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
  };

  const testResponseRule = async (ruleId: string) => {
    setBusyAction(`rule-test:${ruleId}`);
    setNotice(undefined);
    try {
      const payload = await requestJson<RuleTestResponse>(
        `/api/rules/${ruleId}/test`,
        { method: 'POST' }
      );
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
  };

  return {
    busyAction,
    createDemoIncident,
    data,
    disableAllRules,
    importRuleTemplates,
    loadState,
    notice,
    refresh,
    resetDemoIncidents,
    runAction,
    saveDashboardConfig,
    saveResponseRule,
    selectedIncident,
    selectedPostId,
    setSelectedPostId,
    testResponseRule,
  };
};
