import type { Incident } from './api';

export const sortIncidentsByPriority = (incidents: Incident[]) =>
  [...incidents].sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
