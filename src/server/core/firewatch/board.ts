import { context, redis, reddit } from '@devvit/web/server';
import { boardPostKey, normalizePostId } from '../firewatch-utils';
import { getPostSnapshot } from './incidents';


// Custom post entrypoint
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
    splash: {
      appDisplayName: 'Firewatch',
      appIconUri: 'icon.png',
    },
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
      return await reddit.getPostById(normalizePostId(storedPostId));
    } catch (error) {
      console.error(
        `Stored Firewatch review post could not be opened: ${error}`
      );
    }
  }

  return await createFirewatchPost();
};
