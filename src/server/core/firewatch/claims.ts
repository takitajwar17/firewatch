import type { Incident } from '../../../shared/api';

export type IncidentClaim = NonNullable<Incident['claim']>;

type ParseStoredIncidentClaimOptions = {
  fallback?: IncidentClaim;
  onError?: (error: unknown) => void;
  value?: string;
};

export const parseStoredIncidentClaim = ({
  fallback,
  onError,
  value,
}: ParseStoredIncidentClaimOptions): IncidentClaim | undefined => {
  if (!value) return fallback;

  try {
    const parsed: Partial<IncidentClaim> = JSON.parse(value);
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.claimedAt === 'number'
    ) {
      return {
        username: parsed.username,
        claimedAt: parsed.claimedAt,
      };
    }
  } catch (error) {
    onError?.(error);
  }

  return fallback;
};
