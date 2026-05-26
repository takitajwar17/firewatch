import { reddit } from '@devvit/web/server';
import { normalizeCommentId, normalizePostId } from '../firewatch-utils';

export const redditRuntimeErrorMessage = (error: unknown) => {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  } else if (typeof error === 'string') {
    parts.push(error);
  }

  if (typeof error === 'object' && error !== null) {
    if ('details' in error && typeof error.details === 'string') {
      parts.push(error.details);
    }
    if (
      'code' in error &&
      (typeof error.code === 'number' || typeof error.code === 'string')
    ) {
      parts.push(String(error.code));
    }
  }

  return parts.join(' ');
};

export const isTransientRedditRuntimeError = (error: unknown) =>
  /cancelled|deadline|unavailable|timeout|timed out|econnreset/i.test(
    redditRuntimeErrorMessage(error)
  );

export const isMissingRedditThingError = (error: unknown) =>
  /not found|notfound|does not exist|deleted|forbidden|403|404/i.test(
    redditRuntimeErrorMessage(error)
  );

const waitForRetry = (delayMs: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const withRedditReadRetry = async <Result>(read: () => Promise<Result>) => {
  const retryDelays = [120, 300];

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      const delayMs = retryDelays[attempt];
      if (!isTransientRedditRuntimeError(error) || delayMs === undefined) {
        throw error;
      }
      await waitForRetry(delayMs);
    }
  }

  return read();
};

export const readRedditPost = (postId: string) =>
  withRedditReadRetry(() => reddit.getPostById(normalizePostId(postId)));

export const readRedditComment = (commentId: string) =>
  withRedditReadRetry(() =>
    reddit.getCommentById(normalizeCommentId(commentId))
  );

export const deleteRedditPostIfExists = async (postId: string) => {
  try {
    const post = await readRedditPost(postId);
    await post.delete();
    return true;
  } catch (error) {
    if (isMissingRedditThingError(error)) return false;
    throw error;
  }
};

export type TargetActionResult =
  | {
      status: 'success';
      targetId: string;
    }
  | {
      message: string;
      status: 'failed';
      targetId: string;
    };

export const runTargetedRedditActions = async (
  targetIds: string[],
  action: (targetId: string) => Promise<unknown>
) => {
  const results: TargetActionResult[] = [];

  for (const targetId of targetIds) {
    try {
      await action(targetId);
      results.push({ status: 'success', targetId });
    } catch (error) {
      results.push({
        status: 'failed',
        targetId,
        message: redditRuntimeErrorMessage(error) || 'Reddit action failed',
      });
    }
  }

  return results;
};

export const successfulTargetIds = (results: TargetActionResult[]) =>
  results
    .filter((result) => result.status === 'success')
    .map((result) => result.targetId);

export const failedTargetSummary = (results: TargetActionResult[]) => {
  const failed = results.filter((result) => result.status === 'failed');
  if (failed.length === 0) return undefined;

  return `${failed.length} failed: ${failed
    .slice(0, 3)
    .map((result) => result.targetId)
    .join(', ')}`;
};

export const throwIfNoTargetSucceeded = (
  results: TargetActionResult[],
  message: string
) => {
  if (results.some((result) => result.status === 'success')) return;

  const firstFailure = results.find((result) => result.status === 'failed');
  throw new Error(
    firstFailure?.message ? `${message}: ${firstFailure.message}` : message
  );
};
