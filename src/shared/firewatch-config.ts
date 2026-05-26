import type { FirewatchConfig } from './api';

type OptionalValue<T> = {
  [Key in keyof T]?: T[Key] | undefined;
};

export const DEFAULT_COOLDOWN_COMMENT_TEXT =
  'Mod note: Please keep this discussion civil, stay on topic, and follow the community rules. Rule-breaking comments may be removed.';

export const DEFAULT_CONFIG: FirewatchConfig = {
  keywords: [
    'account recovery',
    'admin fee',
    'attack',
    'brigade',
    'crypto',
    'dm me',
    'dox',
    'fraud',
    'free money',
    'gift card',
    'harass',
    'hate',
    'idiot',
    'kill',
    'misinfo',
    'off topic',
    'password',
    'personal attack',
    'racist',
    'recovery agent',
    'report',
    'scam',
    'slur',
    'stupid',
    'telegram',
    'threat',
    'troll',
    'violence',
    'wallet',
  ],
  suspiciousDomains: [
    'bit.ly',
    'discord.gg',
    'grabify',
    't.me',
    'tinyurl.com',
    'wa.me',
  ],
  heatThreshold: 35,
  fireThreshold: 65,
  wildfireThreshold: 85,
  reminderText: DEFAULT_COOLDOWN_COMMENT_TEXT,
  actionControls: {
    approveComments: true,
    removeComments: true,
    banUsers: true,
    stickyReminder: true,
    lockPost: true,
    unlockPost: true,
    approvePosts: true,
    removePosts: true,
    markPostSpam: true,
    markPostNsfw: true,
    markPostSpoiler: true,
    ignoreReports: true,
    ignoreCommentReports: true,
    crowdControl: true,
    setPostFlair: true,
    lockComments: true,
    markCommentSpam: true,
    removeCommentThreads: true,
    showComments: true,
    approveUsers: true,
    muteUsers: true,
    addModNotes: true,
    removeUserContent: true,
    handoffNotes: true,
    markResolved: true,
  },
  signalWeights: {
    commentVelocity: 6,
    reports: 15,
    watchedWords: 8,
    watchedDomains: 10,
    replyPileOns: 15,
    repeatedWording: 5,
    recentRemovals: 8,
    manualSend: 25,
  },
};

export const EMPTY_CONFIG: FirewatchConfig = {
  ...DEFAULT_CONFIG,
  keywords: [],
  suspiciousDomains: [],
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const normalizeWeight = (value: unknown, fallback: number, max = 50) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return clamp(Math.round(numericValue), 0, max);
};

const normalizeList = (
  value: FirewatchConfig['keywords'] | undefined,
  fallback: string[]
) => {
  if (!Array.isArray(value)) return fallback;

  return Array.from(
    new Set(
      value
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    )
  );
};

export const normalizeThresholds = (
  heatThreshold: number,
  fireThreshold: number,
  wildfireThreshold: number
) => {
  const heatInput = Number.isFinite(heatThreshold)
    ? heatThreshold
    : DEFAULT_CONFIG.heatThreshold;
  const fireInput = Number.isFinite(fireThreshold)
    ? fireThreshold
    : DEFAULT_CONFIG.fireThreshold;
  const wildfireInput = Number.isFinite(wildfireThreshold)
    ? wildfireThreshold
    : DEFAULT_CONFIG.wildfireThreshold;
  const heat = clamp(heatInput, 1, 98);
  const fire = clamp(fireInput, heat + 1, 99);
  const wildfire = clamp(wildfireInput, fire + 1, 100);

  return {
    heatThreshold: heat,
    fireThreshold: fire,
    wildfireThreshold: wildfire,
  };
};

const legacyResolveControlKey = ['mark', 'Han', 'dled'].join('');

type LegacyActionControls = Partial<FirewatchConfig['actionControls']> &
  Record<string, boolean | undefined>;

type LegacyConfigInput = Partial<Omit<FirewatchConfig, 'actionControls'>> & {
  actionControls?: LegacyActionControls;
};

export const normalizeConfig = (
  value: LegacyConfigInput | undefined
): FirewatchConfig => {
  const thresholds = normalizeThresholds(
    Number(value?.heatThreshold ?? DEFAULT_CONFIG.heatThreshold),
    Number(value?.fireThreshold ?? DEFAULT_CONFIG.fireThreshold),
    Number(value?.wildfireThreshold ?? DEFAULT_CONFIG.wildfireThreshold)
  );
  const actionControls = value?.actionControls;
  const signalWeights = value?.signalWeights;
  const reminderText = value?.reminderText?.trim();

  return {
    keywords: normalizeList(value?.keywords, DEFAULT_CONFIG.keywords),
    suspiciousDomains: normalizeList(
      value?.suspiciousDomains,
      DEFAULT_CONFIG.suspiciousDomains
    ),
    ...thresholds,
    reminderText: reminderText
      ? reminderText.slice(0, 800)
      : DEFAULT_CONFIG.reminderText,
    actionControls: {
      approveComments: normalizeBoolean(
        actionControls?.approveComments,
        DEFAULT_CONFIG.actionControls.approveComments
      ),
      removeComments: normalizeBoolean(
        actionControls?.removeComments,
        DEFAULT_CONFIG.actionControls.removeComments
      ),
      banUsers: normalizeBoolean(
        actionControls?.banUsers,
        DEFAULT_CONFIG.actionControls.banUsers
      ),
      stickyReminder: normalizeBoolean(
        actionControls?.stickyReminder,
        DEFAULT_CONFIG.actionControls.stickyReminder
      ),
      lockPost: normalizeBoolean(
        actionControls?.lockPost,
        DEFAULT_CONFIG.actionControls.lockPost
      ),
      unlockPost: normalizeBoolean(
        actionControls?.unlockPost,
        DEFAULT_CONFIG.actionControls.unlockPost
      ),
      approvePosts: normalizeBoolean(
        actionControls?.approvePosts,
        DEFAULT_CONFIG.actionControls.approvePosts
      ),
      removePosts: normalizeBoolean(
        actionControls?.removePosts,
        DEFAULT_CONFIG.actionControls.removePosts
      ),
      markPostSpam: normalizeBoolean(
        actionControls?.markPostSpam,
        DEFAULT_CONFIG.actionControls.markPostSpam
      ),
      markPostNsfw: normalizeBoolean(
        actionControls?.markPostNsfw,
        DEFAULT_CONFIG.actionControls.markPostNsfw
      ),
      markPostSpoiler: normalizeBoolean(
        actionControls?.markPostSpoiler,
        DEFAULT_CONFIG.actionControls.markPostSpoiler
      ),
      ignoreReports: normalizeBoolean(
        actionControls?.ignoreReports,
        DEFAULT_CONFIG.actionControls.ignoreReports
      ),
      ignoreCommentReports: normalizeBoolean(
        actionControls?.ignoreCommentReports,
        actionControls?.ignoreReports ??
          DEFAULT_CONFIG.actionControls.ignoreCommentReports
      ),
      crowdControl: normalizeBoolean(
        actionControls?.crowdControl,
        DEFAULT_CONFIG.actionControls.crowdControl
      ),
      setPostFlair: normalizeBoolean(
        actionControls?.setPostFlair,
        DEFAULT_CONFIG.actionControls.setPostFlair
      ),
      lockComments: normalizeBoolean(
        actionControls?.lockComments,
        DEFAULT_CONFIG.actionControls.lockComments
      ),
      markCommentSpam: normalizeBoolean(
        actionControls?.markCommentSpam,
        DEFAULT_CONFIG.actionControls.markCommentSpam
      ),
      removeCommentThreads: normalizeBoolean(
        actionControls?.removeCommentThreads,
        DEFAULT_CONFIG.actionControls.removeCommentThreads
      ),
      showComments: normalizeBoolean(
        actionControls?.showComments,
        DEFAULT_CONFIG.actionControls.showComments
      ),
      approveUsers: normalizeBoolean(
        actionControls?.approveUsers,
        DEFAULT_CONFIG.actionControls.approveUsers
      ),
      muteUsers: normalizeBoolean(
        actionControls?.muteUsers,
        DEFAULT_CONFIG.actionControls.muteUsers
      ),
      addModNotes: normalizeBoolean(
        actionControls?.addModNotes,
        DEFAULT_CONFIG.actionControls.addModNotes
      ),
      removeUserContent: normalizeBoolean(
        actionControls?.removeUserContent,
        DEFAULT_CONFIG.actionControls.removeUserContent
      ),
      handoffNotes: normalizeBoolean(
        actionControls?.handoffNotes,
        DEFAULT_CONFIG.actionControls.handoffNotes
      ),
      markResolved: normalizeBoolean(
        actionControls?.markResolved ??
          actionControls?.[legacyResolveControlKey],
        DEFAULT_CONFIG.actionControls.markResolved
      ),
    },
    signalWeights: {
      commentVelocity: normalizeWeight(
        signalWeights?.commentVelocity,
        DEFAULT_CONFIG.signalWeights.commentVelocity
      ),
      reports: normalizeWeight(
        signalWeights?.reports,
        DEFAULT_CONFIG.signalWeights.reports
      ),
      watchedWords: normalizeWeight(
        signalWeights?.watchedWords,
        DEFAULT_CONFIG.signalWeights.watchedWords
      ),
      watchedDomains: normalizeWeight(
        signalWeights?.watchedDomains,
        DEFAULT_CONFIG.signalWeights.watchedDomains
      ),
      replyPileOns: normalizeWeight(
        signalWeights?.replyPileOns,
        DEFAULT_CONFIG.signalWeights.replyPileOns
      ),
      repeatedWording: normalizeWeight(
        signalWeights?.repeatedWording,
        DEFAULT_CONFIG.signalWeights.repeatedWording
      ),
      recentRemovals: normalizeWeight(
        signalWeights?.recentRemovals,
        DEFAULT_CONFIG.signalWeights.recentRemovals
      ),
      manualSend: normalizeWeight(
        signalWeights?.manualSend,
        DEFAULT_CONFIG.signalWeights.manualSend
      ),
    },
  };
};

export type FirewatchConfigUpdate = OptionalValue<{
  keywords?: string;
  suspiciousDomains?: string;
  heatThreshold?: number;
  fireThreshold?: number;
  wildfireThreshold?: number;
  reminderText?: string;
  actionControls?: OptionalValue<FirewatchConfig['actionControls']>;
  signalWeights?: OptionalValue<FirewatchConfig['signalWeights']>;
}>;

export type FirewatchConfigFormValues = {
  keywords?: string;
  suspiciousDomains?: string;
  heatThreshold?: number;
  fireThreshold?: number;
  wildfireThreshold?: number;
  reminderText?: string;
  weightCommentVelocity?: number;
  weightReports?: number;
  weightWatchedWords?: number;
  weightWatchedDomains?: number;
  weightReplyPileOns?: number;
  weightRepeatedWording?: number;
  weightRecentRemovals?: number;
  weightManualSend?: number;
  allowApproveComments?: boolean;
  allowRemoveComments?: boolean;
  allowMarkCommentSpam?: boolean;
  allowLockComments?: boolean;
  allowRemoveCommentThreads?: boolean;
  allowShowComments?: boolean;
  allowBanUsers?: boolean;
  allowStickyReminder?: boolean;
  allowLockPost?: boolean;
  allowUnlockPost?: boolean;
  allowApprovePosts?: boolean;
  allowRemovePosts?: boolean;
  allowMarkPostSpam?: boolean;
  allowMarkPostNsfw?: boolean;
  allowMarkPostSpoiler?: boolean;
  allowIgnoreReports?: boolean;
  allowIgnoreCommentReports?: boolean;
  allowCrowdControl?: boolean;
  allowSetPostFlair?: boolean;
  allowApproveUsers?: boolean;
  allowMuteUsers?: boolean;
  allowAddModNotes?: boolean;
  allowRemoveUserContent?: boolean;
  allowHandoffNotes?: boolean;
  allowMarkResolved?: boolean;
};

export type ConfigSignalWeightField = {
  id: keyof FirewatchConfig['signalWeights'];
  formName: keyof FirewatchConfigFormValues;
  label: string;
};

export type ConfigActionControlField = {
  id: keyof FirewatchConfig['actionControls'];
  formName: keyof FirewatchConfigFormValues;
  formLabel: string;
  label: string;
};

export type ConfigActionControlGroup = {
  fields: ConfigActionControlField[];
  title?: string;
};

export type FirewatchConfigFormDefaults = {
  keywords: string;
  suspiciousDomains: string;
  heatThreshold: number;
  fireThreshold: number;
  wildfireThreshold: number;
  reminderText: string;
  actionControls: FirewatchConfig['actionControls'];
  signalWeights: FirewatchConfig['signalWeights'];
};

type ParagraphConfigFormField = {
  defaultValue: string;
  label: string;
  name: keyof FirewatchConfigFormValues;
  type: 'paragraph';
};

type NumberConfigFormField = {
  defaultValue: number;
  label: string;
  name: keyof FirewatchConfigFormValues;
  type: 'number';
};

type BooleanConfigFormField = {
  defaultValue: boolean;
  label: string;
  name: keyof FirewatchConfigFormValues;
  type: 'boolean';
};

export type FirewatchConfigFormField =
  | BooleanConfigFormField
  | NumberConfigFormField
  | ParagraphConfigFormField;

const approveCommentsField: ConfigActionControlField = {
  id: 'approveComments',
  formName: 'allowApproveComments',
  formLabel: 'Allow comment approvals',
  label: 'Approve comments',
};

const removeCommentsField: ConfigActionControlField = {
  id: 'removeComments',
  formName: 'allowRemoveComments',
  formLabel: 'Allow comment removals',
  label: 'Remove comments',
};

const markCommentSpamField: ConfigActionControlField = {
  id: 'markCommentSpam',
  formName: 'allowMarkCommentSpam',
  formLabel: 'Allow marking comments as spam',
  label: 'Spam comments',
};

const lockCommentsField: ConfigActionControlField = {
  id: 'lockComments',
  formName: 'allowLockComments',
  formLabel: 'Allow comment locking',
  label: 'Lock comments',
};

const removeCommentThreadsField: ConfigActionControlField = {
  id: 'removeCommentThreads',
  formName: 'allowRemoveCommentThreads',
  formLabel: 'Allow comment thread removal',
  label: 'Remove comment threads',
};

const showCommentsField: ConfigActionControlField = {
  id: 'showComments',
  formName: 'allowShowComments',
  formLabel: 'Allow showing comments',
  label: 'Show comments',
};

const banUsersField: ConfigActionControlField = {
  id: 'banUsers',
  formName: 'allowBanUsers',
  formLabel: 'Allow user bans',
  label: 'Ban users',
};

const stickyReminderField: ConfigActionControlField = {
  id: 'stickyReminder',
  formName: 'allowStickyReminder',
  formLabel: 'Allow sticky comments',
  label: 'Sticky comments',
};

const lockPostField: ConfigActionControlField = {
  id: 'lockPost',
  formName: 'allowLockPost',
  formLabel: 'Allow post locking',
  label: 'Lock posts',
};

const unlockPostField: ConfigActionControlField = {
  id: 'unlockPost',
  formName: 'allowUnlockPost',
  formLabel: 'Allow post unlocking',
  label: 'Unlock posts',
};

const approvePostsField: ConfigActionControlField = {
  id: 'approvePosts',
  formName: 'allowApprovePosts',
  formLabel: 'Allow post approvals',
  label: 'Approve posts',
};

const removePostsField: ConfigActionControlField = {
  id: 'removePosts',
  formName: 'allowRemovePosts',
  formLabel: 'Allow post removals',
  label: 'Remove posts',
};

const markPostSpamField: ConfigActionControlField = {
  id: 'markPostSpam',
  formName: 'allowMarkPostSpam',
  formLabel: 'Allow marking posts as spam',
  label: 'Spam posts',
};

const markPostNsfwField: ConfigActionControlField = {
  id: 'markPostNsfw',
  formName: 'allowMarkPostNsfw',
  formLabel: 'Allow NSFW post tags',
  label: 'Mark posts NSFW',
};

const markPostSpoilerField: ConfigActionControlField = {
  id: 'markPostSpoiler',
  formName: 'allowMarkPostSpoiler',
  formLabel: 'Allow spoiler post tags',
  label: 'Mark posts spoiler',
};

const ignoreReportsField: ConfigActionControlField = {
  id: 'ignoreReports',
  formName: 'allowIgnoreReports',
  formLabel: 'Allow ignoring reports',
  label: 'Ignore post reports',
};

const ignoreCommentReportsField: ConfigActionControlField = {
  id: 'ignoreCommentReports',
  formName: 'allowIgnoreCommentReports',
  formLabel: 'Allow ignoring comment reports',
  label: 'Ignore comment reports',
};

const crowdControlField: ConfigActionControlField = {
  id: 'crowdControl',
  formName: 'allowCrowdControl',
  formLabel: 'Allow Crowd Control',
  label: 'Crowd Control',
};

const setPostFlairField: ConfigActionControlField = {
  id: 'setPostFlair',
  formName: 'allowSetPostFlair',
  formLabel: 'Allow post flair changes',
  label: 'Set post flair',
};

const approveUsersField: ConfigActionControlField = {
  id: 'approveUsers',
  formName: 'allowApproveUsers',
  formLabel: 'Allow user approvals',
  label: 'Approve users',
};

const muteUsersField: ConfigActionControlField = {
  id: 'muteUsers',
  formName: 'allowMuteUsers',
  formLabel: 'Allow modmail mutes',
  label: 'Mute users',
};

const addModNotesField: ConfigActionControlField = {
  id: 'addModNotes',
  formName: 'allowAddModNotes',
  formLabel: 'Allow Reddit mod notes',
  label: 'Add mod notes',
};

const removeUserContentField: ConfigActionControlField = {
  id: 'removeUserContent',
  formName: 'allowRemoveUserContent',
  formLabel: 'Allow removing recent user content',
  label: 'Remove user content',
};

const handoffNotesField: ConfigActionControlField = {
  id: 'handoffNotes',
  formName: 'allowHandoffNotes',
  formLabel: 'Allow handoff notes',
  label: 'Handoff notes',
};

const markResolvedField: ConfigActionControlField = {
  id: 'markResolved',
  formName: 'allowMarkResolved',
  formLabel: 'Allow mark resolved',
  label: 'Mark resolved',
};

export const CONFIG_SIGNAL_WEIGHT_FIELDS: ConfigSignalWeightField[] = [
  {
    id: 'commentVelocity',
    formName: 'weightCommentVelocity',
    label: 'New comments',
  },
  { id: 'reports', formName: 'weightReports', label: 'Reports' },
  {
    id: 'watchedWords',
    formName: 'weightWatchedWords',
    label: 'Watched words',
  },
  {
    id: 'watchedDomains',
    formName: 'weightWatchedDomains',
    label: 'Watched domains',
  },
  {
    id: 'replyPileOns',
    formName: 'weightReplyPileOns',
    label: 'Reply clusters',
  },
  {
    id: 'repeatedWording',
    formName: 'weightRepeatedWording',
    label: 'Repeated wording',
  },
  {
    id: 'recentRemovals',
    formName: 'weightRecentRemovals',
    label: 'Recent removals',
  },
  {
    id: 'manualSend',
    formName: 'weightManualSend',
    label: 'Manual send',
  },
];

export const CONFIG_CORE_ACTION_FIELDS: ConfigActionControlField[] = [
  approveCommentsField,
  removeCommentsField,
  banUsersField,
  stickyReminderField,
  lockPostField,
  handoffNotesField,
  markResolvedField,
];

export const CONFIG_POST_ACTION_FIELDS: ConfigActionControlField[] = [
  approvePostsField,
  removePostsField,
  markPostSpamField,
  unlockPostField,
  markPostNsfwField,
  markPostSpoilerField,
  ignoreReportsField,
  crowdControlField,
  setPostFlairField,
];

export const CONFIG_COMMENT_ACTION_FIELDS: ConfigActionControlField[] = [
  markCommentSpamField,
  lockCommentsField,
  ignoreCommentReportsField,
  removeCommentThreadsField,
  showCommentsField,
];

export const CONFIG_USER_ACTION_FIELDS: ConfigActionControlField[] = [
  approveUsersField,
  muteUsersField,
  addModNotesField,
  removeUserContentField,
];

export const CONFIG_ACTION_CONTROL_GROUPS: ConfigActionControlGroup[] = [
  { fields: CONFIG_CORE_ACTION_FIELDS },
  { fields: CONFIG_POST_ACTION_FIELDS, title: 'Post' },
  { fields: CONFIG_COMMENT_ACTION_FIELDS, title: 'Comment' },
  { fields: CONFIG_USER_ACTION_FIELDS, title: 'User' },
];

const CONFIG_FORM_ACTION_FIELDS: ConfigActionControlField[] = [
  approveCommentsField,
  removeCommentsField,
  markCommentSpamField,
  lockCommentsField,
  removeCommentThreadsField,
  showCommentsField,
  banUsersField,
  stickyReminderField,
  lockPostField,
  unlockPostField,
  approvePostsField,
  removePostsField,
  markPostSpamField,
  markPostNsfwField,
  markPostSpoilerField,
  ignoreReportsField,
  ignoreCommentReportsField,
  crowdControlField,
  setPostFlairField,
  approveUsersField,
  muteUsersField,
  addModNotesField,
  removeUserContentField,
  handoffNotesField,
  markResolvedField,
];

const signalWeightFormField = (
  field: ConfigSignalWeightField,
  defaults: FirewatchConfigFormDefaults
): NumberConfigFormField => ({
  type: 'number',
  name: field.formName,
  label: field.label,
  defaultValue: defaults.signalWeights[field.id],
});

const actionControlFormField = (
  field: ConfigActionControlField,
  defaults: FirewatchConfigFormDefaults
): BooleanConfigFormField => ({
  type: 'boolean',
  name: field.formName,
  label: field.formLabel,
  defaultValue: defaults.actionControls[field.id],
});

export const buildConfigFormFields = (
  defaults: FirewatchConfigFormDefaults
): FirewatchConfigFormField[] => [
  {
    type: 'paragraph',
    name: 'keywords',
    label: 'Watched words',
    defaultValue: defaults.keywords,
  },
  {
    type: 'paragraph',
    name: 'suspiciousDomains',
    label: 'Watched domains',
    defaultValue: defaults.suspiciousDomains,
  },
  {
    type: 'number',
    name: 'heatThreshold',
    label: 'Review rating threshold score',
    defaultValue: defaults.heatThreshold,
  },
  {
    type: 'number',
    name: 'fireThreshold',
    label: 'Priority rating threshold score',
    defaultValue: defaults.fireThreshold,
  },
  {
    type: 'number',
    name: 'wildfireThreshold',
    label: 'Wildfire rating threshold score',
    defaultValue: defaults.wildfireThreshold,
  },
  ...CONFIG_SIGNAL_WEIGHT_FIELDS.map((field) =>
    signalWeightFormField(field, defaults)
  ),
  {
    type: 'paragraph',
    name: 'reminderText',
    label: 'Sticky comment text',
    defaultValue: defaults.reminderText,
  },
  ...CONFIG_FORM_ACTION_FIELDS.map((field) =>
    actionControlFormField(field, defaults)
  ),
];

export const configUpdateFromFormValues = (
  values: FirewatchConfigFormValues
): FirewatchConfigUpdate => ({
  keywords: values.keywords,
  suspiciousDomains: values.suspiciousDomains,
  heatThreshold: values.heatThreshold,
  fireThreshold: values.fireThreshold,
  wildfireThreshold: values.wildfireThreshold,
  reminderText: values.reminderText,
  actionControls: {
    approveComments: values.allowApproveComments,
    removeComments: values.allowRemoveComments,
    markCommentSpam: values.allowMarkCommentSpam,
    lockComments: values.allowLockComments,
    removeCommentThreads: values.allowRemoveCommentThreads,
    showComments: values.allowShowComments,
    banUsers: values.allowBanUsers,
    stickyReminder: values.allowStickyReminder,
    lockPost: values.allowLockPost,
    unlockPost: values.allowUnlockPost,
    approvePosts: values.allowApprovePosts,
    removePosts: values.allowRemovePosts,
    markPostSpam: values.allowMarkPostSpam,
    markPostNsfw: values.allowMarkPostNsfw,
    markPostSpoiler: values.allowMarkPostSpoiler,
    ignoreReports: values.allowIgnoreReports,
    ignoreCommentReports: values.allowIgnoreCommentReports,
    crowdControl: values.allowCrowdControl,
    setPostFlair: values.allowSetPostFlair,
    approveUsers: values.allowApproveUsers,
    muteUsers: values.allowMuteUsers,
    addModNotes: values.allowAddModNotes,
    removeUserContent: values.allowRemoveUserContent,
    handoffNotes: values.allowHandoffNotes,
    markResolved: values.allowMarkResolved,
  },
  signalWeights: {
    commentVelocity: values.weightCommentVelocity,
    reports: values.weightReports,
    watchedWords: values.weightWatchedWords,
    watchedDomains: values.weightWatchedDomains,
    replyPileOns: values.weightReplyPileOns,
    repeatedWording: values.weightRepeatedWording,
    recentRemovals: values.weightRecentRemovals,
    manualSend: values.weightManualSend,
  },
});
