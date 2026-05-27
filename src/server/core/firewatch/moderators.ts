import { context, reddit } from '@devvit/web/server';
import { normalizeUsername } from '../firewatch-utils';

/**
 * Resolves the current moderator name from Devvit request context, falling back
 * to Reddit when the context is unavailable during local playtests.
 */
export const currentModeratorName = async () =>
  normalizeUsername(
    context.username ?? (await reddit.getCurrentUsername()) ?? undefined
  );
