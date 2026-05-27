import { navigateTo } from '@devvit/web/client';

const REDDIT_ORIGIN = 'https://www.reddit.com';

export const toRedditUrl = (permalink: string) =>
  new URL(permalink, REDDIT_ORIGIN).toString();

export const openRedditUrl = (permalink: string) => {
  navigateTo(toRedditUrl(permalink));
};
