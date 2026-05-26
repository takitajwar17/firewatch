import type { Context as HonoContext } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import type { ErrorResponse } from '../../shared/api';
import { isModeratorPermissionError } from './auth';

type ErrorResponseOptions = {
  fallbackMessage: string;
  logMessage: string;
  messagePrefix?: string;
};

export const errorResponse = (
  c: HonoContext,
  error: unknown,
  { fallbackMessage, logMessage, messagePrefix = '' }: ErrorResponseOptions
) => {
  const permissionError = isModeratorPermissionError(error);
  if (!permissionError) {
    console.error(logMessage, error);
  }
  const status = permissionError ? 403 : 400;

  return c.json<ErrorResponse>(
    {
      status: 'error',
      message:
        error instanceof Error
          ? `${messagePrefix}${error.message}`
          : fallbackMessage,
    },
    status
  );
};

export const uiErrorResponse = (
  c: HonoContext,
  error: unknown,
  logMessage: string,
  showToast: string
) => {
  const permissionError = isModeratorPermissionError(error);
  if (!permissionError) {
    console.error(`${logMessage}:`, error);
  }

  return c.json<UiResponse>(
    {
      showToast: permissionError ? error.message : showToast,
    },
    permissionError ? 403 : 400
  );
};

export const uiSuccessToastResponse = (c: HonoContext, text: string) =>
  c.json<UiResponse>(
    {
      showToast: {
        text,
        appearance: 'success',
      },
    },
    200
  );
