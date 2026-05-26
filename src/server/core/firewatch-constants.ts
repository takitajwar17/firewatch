export {
  DEFAULT_CONFIG,
  DEFAULT_COOLDOWN_COMMENT_TEXT,
} from '../../shared/firewatch-config';

export const INDEX_KEY = 'fw:index';
export const MAX_ACTIONS = 30;
export const MAX_FLAGGED_COMMENTS = 12;
export const MAX_INVOLVED_USERS = 8;
export const MAX_REPEATED_PHRASES = 6;
export const MAX_RECENT_SIGNALS = 80;
export const MAX_TREND_POINTS = 8;
export const VELOCITY_BASELINE_COMMENTS = 4;
export const INCIDENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const TREND_BUCKET_MS = 10 * 60 * 1000;

export const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'because',
  'been',
  'being',
  'could',
  'from',
  'have',
  'here',
  'into',
  'just',
  'like',
  'more',
  'only',
  'people',
  'really',
  'should',
  'that',
  'their',
  'there',
  'the',
  'they',
  'this',
  'thread',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'your',
]);
