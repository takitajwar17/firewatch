import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ConfigResponse,
  DashboardInitResponse,
  DemoResetResponse,
  FirewatchDemoScenarioId,
  Incident,
} from '../../shared/api';
import { actionLabel, actionSuccessMessage, emptyConfig, readErrorMessage } from './format';
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
        : data.selectedPostId ?? data.incidents[0]?.postId
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/init');
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const data: DashboardInitResponse = await res.json();
      applyDashboard(data);
    } catch (error) {
      setLoadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load dashboard',
      });
    }
  }, [applyDashboard]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(await readErrorMessage(res));

        const data: DashboardInitResponse = await res.json();
        if (!cancelled) applyDashboard(data);
      } catch (error) {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message:
              error instanceof Error ? error.message : 'Failed to load dashboard',
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
            incident.postId === updatedIncident.postId ? updatedIncident : incident
          )
        : [updatedIncident, ...current.data.incidents];

      return {
        status: 'ready',
        data: {
          ...current.data,
          incidents: incidents.sort(
            (a, b) => b.score - a.score || b.updatedAt - a.updatedAt
          ),
        },
      };
    });
    setSelectedPostId(updatedIncident.postId);
  };

  const runAction: ActionRunner = async (action, endpoint, body) => {
    setBusyAction(action);
    setNotice(undefined);
    try {
      const requestInit: RequestInit = {
        method: 'POST',
      };
      if (body) {
        requestInit.headers = { 'content-type': 'application/json' };
        requestInit.body = JSON.stringify(body);
      }

      const res = await fetch(endpoint, requestInit);
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const payload: { incident: Incident } = await res.json();
      updateIncident(payload.incident);
      setNotice({ type: 'success', message: actionSuccessMessage(action) });
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
      const res = await fetch('/api/demo/reset', {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const payload: DemoResetResponse = await res.json();
      applyDashboard(payload);
      setNotice({
        type: 'success',
        message:
          payload.resetCount === 1
            ? 'Demo incident cleared.'
            : `${payload.resetCount} demo incidents cleared.`,
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
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      const payload: ConfigResponse = await res.json();
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

  return {
    busyAction,
    createDemoIncident,
    data,
    loadState,
    notice,
    refresh,
    resetDemoIncidents,
    runAction,
    saveDashboardConfig,
    selectedIncident,
    selectedPostId,
    setSelectedPostId,
  };
};
