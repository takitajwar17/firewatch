import type { FirewatchConfig } from '../../shared/api';

export const DEFAULT_CONFIG: FirewatchConfig = {
  keywords: [
    'brigade',
    'dox',
    'fraud',
    'harass',
    'hate',
    'idiot',
    'kill',
    'racist',
    'report',
    'scam',
    'slur',
    'stupid',
    'threat',
  ],
  suspiciousDomains: ['bit.ly', 'tinyurl.com', 'grabify', 'discord.gg'],
  heatThreshold: 35,
  fireThreshold: 65,
  wildfireThreshold: 85,
};

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
export const COOLDOWN_COMMENT_TEXT =
  'Mod note: Please keep this discussion civil, stay on topic, and follow the community rules. Rule-breaking comments may be removed.';

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
