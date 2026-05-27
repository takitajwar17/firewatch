import { context, redis, reddit } from '@devvit/web/server';
import { boardPostKey, normalizePostId } from '../firewatch-utils';
import { getPostSnapshot } from './incidents';
import {
  isMissingRedditThingError,
  readRedditPost,
} from './reddit-runtime';
import { logFirewatchWarn } from './logging';

/**
 * Creates the Firewatch custom post that hosts the web view. A board post is
 * reused per subreddit, while incident-specific posts can carry postData that
 * opens the matching incident directly.
 */
export const createFirewatchPost = async (options?: {
  incidentPostId?: string;
}) => {
  const normalizedIncidentPostId = options?.incidentPostId
    ? normalizePostId(options.incidentPostId)
    : undefined;
  const sourcePost = normalizedIncidentPostId
    ? await getPostSnapshot(normalizedIncidentPostId)
    : undefined;

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: sourcePost
      ? `Firewatch review: ${sourcePost.title.slice(0, 220)}`
      : 'Firewatch posts to review',
    entry: 'default',
    postData: normalizedIncidentPostId
      ? {
          incidentPostId: normalizedIncidentPostId,
        }
      : {
          board: true,
        },
    textFallback: {
      text: sourcePost
        ? `Firewatch review for ${sourcePost.title}`
        : 'Firewatch posts to review for this community.',
    },
  });

  if (!options?.incidentPostId) {
    await redis.set(boardPostKey(context.subredditName), post.id);
  }

  return post;
};

export const getOrCreateFirewatchBoardPost = async () => {
  const storedPostId = await redis.get(boardPostKey(context.subredditName));

  if (storedPostId) {
    try {
      return await readRedditPost(storedPostId);
    } catch (error) {
      if (!isMissingRedditThingError(error)) {
        throw error;
      }

      logFirewatchWarn('board.stored_post_missing', {
        postId: storedPostId,
        subredditName: context.subredditName,
        error,
      });
      await redis.del(boardPostKey(context.subredditName));
    }
  }

  return await createFirewatchPost();
};
