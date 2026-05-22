import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import {
  createDemoIncident,
  getConfigFormDefaults,
  getOrCreateFirewatchBoardPost,
  rememberSelectedIncident,
  upsertIncidentSignal,
} from '../core/firewatch';

export const menu = new Hono();

menu.post('/open-board', async (c) => {
  try {
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    console.error(`Error opening Firewatch mod queue: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not open Firewatch mod queue',
      },
      400
    );
  }
});

menu.post('/escalate-post', async (c) => {
  try {
    const input = await c.req.json<MenuItemRequest>();
    const incident = await upsertIncidentSignal({
      type: 'manual_escalation',
      source: 'mod_action',
      postId: input.targetId,
      reason: 'Sent from the post menu by a mod',
    });
    await rememberSelectedIncident(incident.postId);
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    console.error(`Error sending post to Firewatch: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not send this post to Firewatch',
      },
      400
    );
  }
});

menu.post('/create-demo-incident', async (c) => {
  try {
    const incident = await createDemoIncident();
    await rememberSelectedIncident(incident.postId);
    const post = await getOrCreateFirewatchBoardPost();

    return c.json<UiResponse>(
      {
        navigateTo: post,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating Firewatch demo post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not create a demo post',
      },
      400
    );
  }
});

menu.post('/configure', async (c) => {
  try {
    const defaults = await getConfigFormDefaults();

    return c.json<UiResponse>({
      showForm: {
        name: 'firewatchConfig',
        form: {
          title: 'Firewatch settings',
          description:
            'Choose what Firewatch watches, how strongly each signal counts, and which actions mods can take from the queue.',
          acceptLabel: 'Save',
          fields: [
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
              label: 'Review score',
              defaultValue: defaults.heatThreshold,
            },
            {
              type: 'number',
              name: 'fireThreshold',
              label: 'Act score',
              defaultValue: defaults.fireThreshold,
            },
            {
              type: 'number',
              name: 'wildfireThreshold',
              label: 'Lock score',
              defaultValue: defaults.wildfireThreshold,
            },
            {
              type: 'number',
              name: 'weightCommentVelocity',
              label: 'New comments weight',
              defaultValue: defaults.signalWeights.commentVelocity,
            },
            {
              type: 'number',
              name: 'weightReports',
              label: 'Reports weight',
              defaultValue: defaults.signalWeights.reports,
            },
            {
              type: 'number',
              name: 'weightWatchedWords',
              label: 'Watched words weight',
              defaultValue: defaults.signalWeights.watchedWords,
            },
            {
              type: 'number',
              name: 'weightWatchedDomains',
              label: 'Watched domains weight',
              defaultValue: defaults.signalWeights.watchedDomains,
            },
            {
              type: 'number',
              name: 'weightReplyPileOns',
              label: 'Reply clusters weight',
              defaultValue: defaults.signalWeights.replyPileOns,
            },
            {
              type: 'number',
              name: 'weightRepeatedWording',
              label: 'Repeated wording weight',
              defaultValue: defaults.signalWeights.repeatedWording,
            },
            {
              type: 'number',
              name: 'weightRecentRemovals',
              label: 'Recent removals weight',
              defaultValue: defaults.signalWeights.recentRemovals,
            },
            {
              type: 'number',
              name: 'weightManualSend',
              label: 'Manual send weight',
              defaultValue: defaults.signalWeights.manualSend,
            },
            {
              type: 'paragraph',
              name: 'reminderText',
              label: 'Sticky reminder text',
              defaultValue: defaults.reminderText,
            },
            {
              type: 'boolean',
              name: 'allowApproveComments',
              label: 'Allow comment approvals',
              defaultValue: defaults.actionControls.approveComments,
            },
            {
              type: 'boolean',
              name: 'allowRemoveComments',
              label: 'Allow comment removals',
              defaultValue: defaults.actionControls.removeComments,
            },
            {
              type: 'boolean',
              name: 'allowMarkCommentSpam',
              label: 'Allow marking comments as spam',
              defaultValue: defaults.actionControls.markCommentSpam,
            },
            {
              type: 'boolean',
              name: 'allowLockComments',
              label: 'Allow comment locking',
              defaultValue: defaults.actionControls.lockComments,
            },
            {
              type: 'boolean',
              name: 'allowRemoveCommentThreads',
              label: 'Allow comment thread removal',
              defaultValue: defaults.actionControls.removeCommentThreads,
            },
            {
              type: 'boolean',
              name: 'allowShowComments',
              label: 'Allow showing comments',
              defaultValue: defaults.actionControls.showComments,
            },
            {
              type: 'boolean',
              name: 'allowBanUsers',
              label: 'Allow user bans',
              defaultValue: defaults.actionControls.banUsers,
            },
            {
              type: 'boolean',
              name: 'allowStickyReminder',
              label: 'Allow sticky reminders',
              defaultValue: defaults.actionControls.stickyReminder,
            },
            {
              type: 'boolean',
              name: 'allowLockPost',
              label: 'Allow post locking',
              defaultValue: defaults.actionControls.lockPost,
            },
            {
              type: 'boolean',
              name: 'allowUnlockPost',
              label: 'Allow post unlocking',
              defaultValue: defaults.actionControls.unlockPost,
            },
            {
              type: 'boolean',
              name: 'allowApprovePosts',
              label: 'Allow post approvals',
              defaultValue: defaults.actionControls.approvePosts,
            },
            {
              type: 'boolean',
              name: 'allowRemovePosts',
              label: 'Allow post removals',
              defaultValue: defaults.actionControls.removePosts,
            },
            {
              type: 'boolean',
              name: 'allowMarkPostSpam',
              label: 'Allow marking posts as spam',
              defaultValue: defaults.actionControls.markPostSpam,
            },
            {
              type: 'boolean',
              name: 'allowMarkPostNsfw',
              label: 'Allow NSFW post tags',
              defaultValue: defaults.actionControls.markPostNsfw,
            },
            {
              type: 'boolean',
              name: 'allowMarkPostSpoiler',
              label: 'Allow spoiler post tags',
              defaultValue: defaults.actionControls.markPostSpoiler,
            },
            {
              type: 'boolean',
              name: 'allowIgnoreReports',
              label: 'Allow ignoring reports',
              defaultValue: defaults.actionControls.ignoreReports,
            },
            {
              type: 'boolean',
              name: 'allowCrowdControl',
              label: 'Allow Crowd Control',
              defaultValue: defaults.actionControls.crowdControl,
            },
            {
              type: 'boolean',
              name: 'allowSetPostFlair',
              label: 'Allow post flair changes',
              defaultValue: defaults.actionControls.setPostFlair,
            },
            {
              type: 'boolean',
              name: 'allowApproveUsers',
              label: 'Allow user approvals',
              defaultValue: defaults.actionControls.approveUsers,
            },
            {
              type: 'boolean',
              name: 'allowMuteUsers',
              label: 'Allow modmail mutes',
              defaultValue: defaults.actionControls.muteUsers,
            },
            {
              type: 'boolean',
              name: 'allowAddModNotes',
              label: 'Allow native mod notes',
              defaultValue: defaults.actionControls.addModNotes,
            },
            {
              type: 'boolean',
              name: 'allowRemoveUserContent',
              label: 'Allow removing recent user content',
              defaultValue: defaults.actionControls.removeUserContent,
            },
            {
              type: 'boolean',
              name: 'allowHandoffNotes',
              label: 'Allow handoff notes',
              defaultValue: defaults.actionControls.handoffNotes,
            },
            {
              type: 'boolean',
              name: 'allowMarkHandled',
              label: 'Allow mark handled',
              defaultValue: defaults.actionControls.markHandled,
            },
          ],
        },
      },
    });
  } catch (error) {
    console.error(`Error opening Firewatch settings: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Could not open Firewatch settings',
      },
      400
    );
  }
});
