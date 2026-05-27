const BOARD_POST_FORMAT_VERSION = 'inline-splash-v1';

type StoredBoardPost = {
  formatVersion: typeof BOARD_POST_FORMAT_VERSION;
  postId: string;
};

const isCurrentBoardPostRecord = (
  value: unknown
): value is StoredBoardPost => {
  if (typeof value !== 'object' || value === null) return false;

  return (
    Reflect.get(value, 'formatVersion') === BOARD_POST_FORMAT_VERSION &&
    typeof Reflect.get(value, 'postId') === 'string'
  );
};

export const serializeBoardPostReference = (postId: string) =>
  JSON.stringify({
    formatVersion: BOARD_POST_FORMAT_VERSION,
    postId,
  } satisfies StoredBoardPost);

type BoardPostParseOptions = {
  allowLegacyPlainString?: boolean;
};

/**
 * Board posts created before the inline splash entrypoint was restored can
 * open directly into the expanded dashboard. Treat legacy plain-string values
 * as stale so the next open creates a fresh post with the cover screen.
 */
export const parseBoardPostReference = (
  value: string | undefined,
  options?: BoardPostParseOptions
) => {
  if (!value) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    return isCurrentBoardPostRecord(parsed) ? parsed.postId : undefined;
  } catch {
    return options?.allowLegacyPlainString ? value : undefined;
  }
};
