import type { ErrorResponseCode } from '../../shared/api';

export class RouteError extends Error {
  constructor(
    readonly code: ErrorResponseCode,
    message: string,
    readonly retryable?: boolean
  ) {
    super(message);
    this.name = 'RouteError';
  }
}

export const conflictError = (message: string) =>
  new RouteError('conflict', message);

export const notFoundError = (message: string) =>
  new RouteError('not_found', message);

export const validationError = (message: string) =>
  new RouteError('validation_error', message);

export const isRouteError = (error: unknown): error is RouteError =>
  error instanceof RouteError;
