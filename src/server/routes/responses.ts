import type { Context as HonoContext } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import type { ErrorResponse } from '../../shared/api';

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
  console.error(logMessage, error);

  return c.json<ErrorResponse>(
    {
      status: 'error',
      message:
        error instanceof Error
          ? `${messagePrefix}${error.message}`
          : fallbackMessage,
    },
    400
  );
};

export const uiErrorResponse = (
  c: HonoContext,
  error: unknown,
  logMessage: string,
  showToast: string
) => {
  console.error(`${logMessage}:`, error);

  return c.json<UiResponse>(
    {
      showToast,
    },
    400
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
