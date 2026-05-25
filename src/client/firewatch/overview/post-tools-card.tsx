import { useState } from 'react';
import {
  ActionInput,
  ActionPrepPanel,
  ActionSelect,
  ActionTextArea,
} from '../action-prep';
import {
  PlaybookButton,
  RedditMenuItem,
  RedditOverflowMenu,
} from '../common';
import { isTerminalStatus } from '../format';
import {
  RedditApproveIcon,
  RedditCautionIcon,
  RedditCrowdControlIcon,
  RedditLockIcon,
  RedditNsfwIcon,
  RedditPinIcon,
  RedditRemoveIcon,
  RedditReportIcon,
  RedditSpamIcon,
  RedditTagIcon,
} from '../reddit-icons';
import type { ActionRunner } from '../types';
import type {
  CrowdControlLevel,
  FirewatchConfig,
  Incident,
  NativePostAction,
  PostFlairOption,
} from '../../../shared/api';
import {
  CROWD_CONTROL_OPTIONS,
  parseCrowdControlLevel,
} from '../../../shared/reddit-actions';

type PostPrepKind = NativePostAction | 'sticky';

const isPostLocked = (incident: Incident) =>
  incident.postState?.locked ?? incident.status === 'locked';

export const NativePostControlsCard = ({
  actionLocked,
  actionLockReason,
  busyAction,
  config,
  incident,
  postFlairOptions,
  onAction,
}: {
  actionLocked: boolean;
  actionLockReason: string;
  busyAction: string | undefined;
  config: FirewatchConfig;
  incident: Incident;
  postFlairOptions: PostFlairOption[];
  onAction: ActionRunner;
}) => {
  const [activePrep, setActivePrep] = useState<PostPrepKind | undefined>();
  const [reason, setReason] = useState('Rule-breaking post');
  const [stickyText, setStickyText] = useState(config.reminderText);
  const [flairText, setFlairText] = useState('Needs mod review');
  const [flairTemplateId, setFlairTemplateId] = useState('');
  const [crowdControlLevel, setCrowdControlLevel] =
    useState<CrowdControlLevel>('MEDIUM');
  const controls = config.actionControls;
  const disabled = Boolean(busyAction) || actionLocked;
  const terminal = isTerminalStatus(incident.status);
  const postState = incident.postState;
  const postApproved = Boolean(
    postState?.approved && !postState.removed && !postState.spam
  );
  const postRemoved = Boolean(postState?.removed || postState?.spam);
  const postSpam = Boolean(postState?.spam);
  const postNsfw = Boolean(postState?.nsfw);
  const postSpoiler = Boolean(postState?.spoiler);
  const postIgnoringReports = Boolean(postState?.ignoringReports);
  const postLocked = isPostLocked(incident);
  const canToggleLock = postLocked ? controls.unlockPost : controls.lockPost;
  const reminderAlreadyPosted = incident.actions.some(
    (action) => action.type === 'cool_down'
  );
  const nsfwAction: NativePostAction = postNsfw ? 'unmark-nsfw' : 'mark-nsfw';
  const spoilerAction: NativePostAction = postSpoiler
    ? 'unmark-spoiler'
    : 'mark-spoiler';
  const reportsAction: NativePostAction = postIgnoringReports
    ? 'unignore-reports'
    : 'ignore-reports';
  const hasPrimaryActions =
    controls.approvePosts ||
    controls.removePosts ||
    controls.markPostSpam ||
    canToggleLock ||
    controls.setPostFlair;
  const hasAdvancedActions =
    controls.stickyReminder ||
    (controls.setPostFlair && Boolean(postState?.flair)) ||
    controls.markPostNsfw ||
    controls.markPostSpoiler ||
    controls.ignoreReports ||
    controls.crowdControl;
  const runPostAction = (
    action: NativePostAction,
    body: Record<string, unknown> = {}
  ) => {
    if (actionLocked) return;

    void onAction(
      `post:${action}`,
      `/api/incidents/${incident.postId}/post-action`,
      {
        action,
        reason,
        ...body,
      }
    ).then((updatedIncident) => {
      if (updatedIncident) setActivePrep(undefined);
    });
  };
  const toggleLock = () => {
    if (actionLocked) return;

    if (postLocked) {
      void onAction(
        'post:unlock',
        `/api/incidents/${incident.postId}/post-action`,
        { action: 'unlock' }
      );
      return;
    }

    void onAction('lock', `/api/incidents/${incident.postId}/lock`);
  };
  const postStickyComment = () => {
    if (actionLocked) return;

    void onAction('cool-down', `/api/incidents/${incident.postId}/cool-down`, {
      reminderText: stickyText,
    }).then((updatedIncident) => {
      if (updatedIncident) setActivePrep(undefined);
    });
  };
  const selectFlairTemplate = (value: string) => {
    setFlairTemplateId(value);
    const selected = postFlairOptions.find((option) => option.id === value);
    if (selected) setFlairText(selected.text);
  };
  const selectedFlair = postFlairOptions.find(
    (option) => option.id === flairTemplateId
  );

  if (!hasPrimaryActions && !hasAdvancedActions) return null;

  return (
    <section className="rounded-md border border-border bg-background">
      <div className="border-b border-border px-3 py-2.5">
        <h3 className="text-sm font-semibold leading-5">Post tools</h3>
      </div>
      <div className="flex flex-col gap-3 p-3">
        {hasPrimaryActions ? (
          <div>
            <div className="flex flex-wrap gap-2">
              {controls.approvePosts ? (
                <PlaybookButton
                  disabled={disabled || postApproved}
                  icon={<RedditApproveIcon data-icon="inline-start" />}
                  label={postApproved ? 'Approved' : postRemoved ? 'Restore' : 'Approve'}
                  loading={busyAction === 'post:approve'}
                  title={actionLocked ? actionLockReason : undefined}
                  variant="secondary"
                  onClick={() => runPostAction('approve')}
                />
              ) : null}
              {controls.removePosts ? (
                <PlaybookButton
                  disabled={disabled || postRemoved}
                  icon={<RedditRemoveIcon data-icon="inline-start" />}
                  label={postRemoved ? 'Removed' : 'Remove'}
                  loading={busyAction === 'post:remove'}
                  title={actionLocked ? actionLockReason : undefined}
                  variant="destructive"
                  onClick={() => setActivePrep('remove')}
                />
              ) : null}
              {controls.markPostSpam ? (
                <PlaybookButton
                  disabled={disabled || postSpam}
                  icon={<RedditSpamIcon data-icon="inline-start" />}
                  label={postSpam ? 'Spam' : 'Spam post'}
                  loading={busyAction === 'post:spam'}
                  title={actionLocked ? actionLockReason : undefined}
                  variant="destructive"
                  onClick={() => setActivePrep('spam')}
                />
              ) : null}
              {canToggleLock ? (
                <PlaybookButton
                  disabled={disabled || terminal}
                  icon={<RedditLockIcon data-icon="inline-start" />}
                  label={postLocked ? 'Unlock' : 'Lock'}
                  loading={busyAction === (postLocked ? 'post:unlock' : 'lock')}
                  title={actionLocked ? actionLockReason : undefined}
                  variant={postLocked ? 'outline' : 'secondary'}
                  onClick={toggleLock}
                />
              ) : null}
              {controls.setPostFlair ? (
                <PlaybookButton
                  disabled={disabled}
                  icon={<RedditTagIcon data-icon="inline-start" />}
                  label={postState?.flair?.text ? 'Change flair' : 'Set flair'}
                  loading={busyAction === 'post:set-flair'}
                  title={actionLocked ? actionLockReason : undefined}
                  variant="secondary"
                  onClick={() => setActivePrep('set-flair')}
                />
              ) : null}
            </div>
            {activePrep === 'remove' || activePrep === 'spam' ? (
              <ActionPrepPanel
                busy={busyAction === `post:${activePrep}`}
                description={actionLocked ? actionLockReason : undefined}
                disabled={actionLocked}
                primaryIcon={
                  activePrep === 'spam' ? (
                    <RedditSpamIcon data-icon="inline-start" />
                  ) : (
                    <RedditRemoveIcon data-icon="inline-start" />
                  )
                }
                primaryLabel={activePrep === 'spam' ? 'Spam post' : 'Remove'}
                title={activePrep === 'spam' ? 'Spam post' : 'Remove post'}
                variant="destructive"
                onCancel={() => setActivePrep(undefined)}
                onSubmit={() => runPostAction(activePrep)}
              >
                <ActionTextArea
                  id="fw-post-removal-reason"
                  label="Removal reason"
                  value={reason}
                  onChange={setReason}
                />
              </ActionPrepPanel>
            ) : null}
            {activePrep === 'set-flair' ? (
              <ActionPrepPanel
                busy={busyAction === 'post:set-flair'}
                description={actionLocked ? actionLockReason : undefined}
                disabled={
                  actionLocked ||
                  (flairText.trim().length === 0 && !selectedFlair)
                }
                primaryIcon={<RedditTagIcon data-icon="inline-start" />}
                primaryLabel="Set flair"
                title="Set post flair"
                variant="outline"
                onCancel={() => setActivePrep(undefined)}
                onSubmit={() =>
                  runPostAction('set-flair', {
                    flairTemplateId: selectedFlair?.id,
                    flairText,
                  })
                }
              >
                <ActionSelect
                  id="fw-post-flair-template"
                  label="Flair template"
                  value={flairTemplateId}
                  onChange={selectFlairTemplate}
                >
                  <option value="">Custom flair text</option>
                  {postFlairOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.text}
                    </option>
                  ))}
                </ActionSelect>
                <ActionInput
                  id="fw-post-flair-text"
                  label="Flair text"
                  value={flairText}
                  onChange={setFlairText}
                />
              </ActionPrepPanel>
            ) : null}
          </div>
        ) : null}

        {hasAdvancedActions ? (
          <div className="flex justify-start">
            <RedditOverflowMenu label="More post actions">
              {controls.stickyReminder ? (
                <RedditMenuItem
                  disabled={disabled || terminal || reminderAlreadyPosted}
                  icon={<RedditPinIcon />}
                  label={
                    reminderAlreadyPosted
                      ? 'Sticky comment posted'
                      : 'Add sticky comment'
                  }
                  description={actionLocked ? actionLockReason : undefined}
                  onSelect={() => {
                    setStickyText(config.reminderText);
                    setActivePrep('sticky');
                  }}
                />
              ) : null}
              {controls.markPostNsfw ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditNsfwIcon />}
                  label={postNsfw ? 'Remove NSFW tag' : 'Add NSFW tag'}
                  description={actionLocked ? actionLockReason : undefined}
                  onSelect={() => runPostAction(nsfwAction)}
                />
              ) : null}
              {controls.markPostSpoiler ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditCautionIcon />}
                  label={postSpoiler ? 'Remove spoiler tag' : 'Add spoiler tag'}
                  description={actionLocked ? actionLockReason : undefined}
                  onSelect={() => runPostAction(spoilerAction)}
                />
              ) : null}
              {controls.ignoreReports ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditReportIcon />}
                  label={
                    postIgnoringReports
                      ? 'Unignore reports'
                      : 'Ignore reports'
                  }
                  description={actionLocked ? actionLockReason : undefined}
                  onSelect={() => runPostAction(reportsAction)}
                />
              ) : null}
              {controls.crowdControl ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditCrowdControlIcon />}
                  label="Adjust Crowd Control"
                  description={actionLocked ? actionLockReason : undefined}
                  onSelect={() => setActivePrep('crowd-control')}
                />
              ) : null}
              {controls.setPostFlair && postState?.flair ? (
                <RedditMenuItem
                  disabled={disabled}
                  icon={<RedditTagIcon />}
                  label={
                    busyAction === 'post:clear-flair'
                      ? 'Working'
                      : 'Remove flair'
                  }
                  description={actionLocked ? actionLockReason : undefined}
                  onSelect={() => runPostAction('clear-flair')}
                />
              ) : null}
            </RedditOverflowMenu>
          </div>
        ) : null}
        {activePrep === 'sticky' ? (
          <ActionPrepPanel
            busy={busyAction === 'cool-down'}
            description={actionLocked ? actionLockReason : undefined}
            disabled={actionLocked || stickyText.trim().length === 0}
            primaryIcon={<RedditPinIcon data-icon="inline-start" />}
            primaryLabel="Post sticky"
            title="Add sticky comment"
            variant="outline"
            onCancel={() => setActivePrep(undefined)}
            onSubmit={postStickyComment}
          >
            <ActionTextArea
              id="fw-sticky-reminder"
              label="Comment text"
              rows={4}
              value={stickyText}
              onChange={setStickyText}
            />
          </ActionPrepPanel>
        ) : null}

        {activePrep === 'crowd-control' ? (
          <ActionPrepPanel
            busy={busyAction === 'post:crowd-control'}
            description={actionLocked ? actionLockReason : undefined}
            disabled={actionLocked}
            primaryIcon={<RedditCrowdControlIcon data-icon="inline-start" />}
            primaryLabel="Apply"
            title="Set Crowd Control"
            variant="outline"
            onCancel={() => setActivePrep(undefined)}
            onSubmit={() =>
              runPostAction('crowd-control', { crowdControlLevel })
            }
          >
            <ActionSelect
              id="fw-crowd-control"
              label="Crowd Control level"
              value={crowdControlLevel}
              onChange={(value) =>
                setCrowdControlLevel(parseCrowdControlLevel(value))
              }
            >
              {CROWD_CONTROL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </ActionSelect>
          </ActionPrepPanel>
        ) : null}
      </div>
    </section>
  );
};
