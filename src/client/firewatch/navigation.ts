const REDDIT_ORIGIN = 'https://www.reddit.com';
const DEVVIT_INTERNAL_MESSAGE = 'devvit-internal';
const CLIENT_SCOPE = 0;
const NAVIGATE_TO_URL_EFFECT = 5;

type RedditNavigateEffect = {
  readonly navigateToUrl: {
    readonly target: '_blank';
    readonly url: string;
  };
  readonly type: typeof NAVIGATE_TO_URL_EFFECT;
};

type RedditNavigateMessage = {
  readonly effect: RedditNavigateEffect;
  readonly navigateToUrl: RedditNavigateEffect['navigateToUrl'];
  readonly scope: typeof CLIENT_SCOPE;
  readonly type: typeof DEVVIT_INTERNAL_MESSAGE;
};

export const toRedditUrl = (permalink: string) =>
  new URL(permalink, REDDIT_ORIGIN).toString();

const emitNewTabNavigation = (url: string) => {
  const effect: RedditNavigateEffect = {
    navigateToUrl: {
      target: '_blank',
      url,
    },
    type: NAVIGATE_TO_URL_EFFECT,
  };
  const message: RedditNavigateMessage = {
    effect,
    navigateToUrl: effect.navigateToUrl,
    scope: CLIENT_SCOPE,
    type: DEVVIT_INTERNAL_MESSAGE,
  };

  globalThis.parent.postMessage(message, '*');
};

export const openRedditUrlInNewTab = (permalink: string) => {
  const url = toRedditUrl(permalink);
  const openedWindow = globalThis.open(url, '_blank');

  if (openedWindow) {
    openedWindow.opener = null;
    return;
  }

  emitNewTabNavigation(url);
};
