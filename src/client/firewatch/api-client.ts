import { readErrorMessage } from './format';
import type { ErrorResponse } from '../../shared/api';

type JsonRequestOptions = {
  body?: unknown;
  method?: 'GET' | 'POST';
};

export class FirewatchApiError extends Error {
  constructor(
    message: string,
    readonly code?: ErrorResponse['code'],
    readonly retryable?: boolean
  ) {
    super(message);
    this.name = 'FirewatchApiError';
  }
}

const isErrorResponse = (payload: unknown): payload is ErrorResponse => {
  if (typeof payload !== 'object' || payload === null) return false;
  return (
    Reflect.get(payload, 'status') === 'error' &&
    typeof Reflect.get(payload, 'message') === 'string'
  );
};

const readApiError = async (response: Response) => {
  try {
    const payload: unknown = await response.clone().json();
    if (isErrorResponse(payload)) {
      return new FirewatchApiError(
        payload.message,
        payload.code,
        Boolean(payload.retryable)
      );
    }
  } catch {
    // Fall through to the existing plain-text error reader.
  }

  return new FirewatchApiError(await readErrorMessage(response));
};

export const requestJson = async <Payload>(
  endpoint: string,
  { body, method = 'GET' }: JsonRequestOptions = {}
) => {
  const requestInit: RequestInit = { method };
  if (body !== undefined) {
    requestInit.headers = { 'content-type': 'application/json' };
    requestInit.body = JSON.stringify(body);
  }

  const res = await fetch(endpoint, requestInit);
  if (!res.ok) throw await readApiError(res);

  const payload: Payload = await res.json();
  return payload;
};
