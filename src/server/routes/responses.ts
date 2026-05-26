import type { Context as HonoContext } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import type { ErrorResponse } from '../../shared/api';
import { isModeratorPermissionError } from './auth';
import { logFirewatchError } from '../core/firewatch/logging';
import { isTransientRedditRuntimeError } from '../core/firewatch/reddit-runtime';

type ErrorResponseOptions = {
  fallbackMessage: string;
  logMessage: string;
  messagePrefix?: string;
};

const errorMessage = (error: unknown, fallbackMessage: string) =>
  error instanceof Error ? error.message : fallbackMessage;

const responseCodeFor = (error: unknown, message: string) => {
  if (isModeratorPermissionError(error)) return 'permission_denied';
  if (isTransientRedditRuntimeError(error)) return 'reddit_unavailable';
  if (/claimed by|claim this post|only that mod/i.test(message)) {
    return 'conflict';
  }
  if (/not found|not in firewatch|no longer exists/i.test(message)) {
    return 'not_found';
  }
  if (/choose|select|disabled in settings|required/i.test(message)) {
    return 'validation_error';
  }

  return 'action_failed';
};

const statusForCode = (
  code: ReturnType<typeof responseCodeFor>
): 400 | 403 | 404 | 409 | 503 => {
  if (code === 'permission_denied') return 403;
  if (code === 'not_found') return 404;
  if (code === 'conflict') return 409;
  if (code === 'reddit_unavailable') return 503;
  return 400;
};

export const errorResponse = (
  c: HonoContext,
  error: unknown,
  { fallbackMessage, logMessage, messagePrefix = '' }: ErrorResponseOptions
) => {
  const message = errorMessage(error, fallbackMessage);
  const code = responseCodeFor(error, message);
  if (code !== 'permission_denied') {
    logFirewatchError('route.error_response', {
      code,
      logMessage,
      messagePrefix,
      error,
    });
  }
  const status = statusForCode(code);

  return c.json<ErrorResponse>(
    {
      code,
      status: 'error',
      message: `${messagePrefix}${message}`,
      retryable: code === 'reddit_unavailable' ? true : undefined,
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
    logFirewatchError('route.ui_error_response', {
      logMessage,
      error,
    });
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
