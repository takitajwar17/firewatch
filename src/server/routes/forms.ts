import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { saveConfig } from '../core/firewatch';

type ConfigFormValues = {
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
  allowCrowdControl?: boolean;
  allowSetPostFlair?: boolean;
  allowApproveUsers?: boolean;
  allowMuteUsers?: boolean;
  allowAddModNotes?: boolean;
  allowRemoveUserContent?: boolean;
  allowHandoffNotes?: boolean;
  allowMarkHandled?: boolean;
};

export const forms = new Hono();

forms.post('/config-submit', async (c) => {
  try {
    const values = await c.req.json<ConfigFormValues>();
    await saveConfig({
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
        crowdControl: values.allowCrowdControl,
        setPostFlair: values.allowSetPostFlair,
        approveUsers: values.allowApproveUsers,
        muteUsers: values.allowMuteUsers,
        addModNotes: values.allowAddModNotes,
        removeUserContent: values.allowRemoveUserContent,
        handoffNotes: values.allowHandoffNotes,
        markHandled: values.allowMarkHandled,
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

    return c.json<UiResponse>(
      {
        showToast: {
          text: 'Firewatch settings saved',
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error saving Firewatch settings: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not save Firewatch settings',
      },
      400
    );
  }
});
