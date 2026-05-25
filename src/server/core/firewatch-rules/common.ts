import { now } from '../firewatch-utils';

export const MAX_RULE_LOGS = 80;
export const MAX_STRIKES_PER_USER = 100;
export const DEFAULT_STRIKE_WINDOW_DAYS = 7;

export const currentIso = () => new Date(now()).toISOString();

export const parseJsonList = <Item>(stored: string | undefined): Item[] => {
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Item => Boolean(item))
      : [];
  } catch {
    return [];
  }
};

export const compare = (
  actual: number,
  operator: '>=' | '>' | '=',
  expected: number
) => {
  if (operator === '>') return actual > expected;
  if (operator === '=') return actual === expected;
  return actual >= expected;
};
