import { ActionPrepPanel, ActionSelect, ActionTextArea } from '../action-prep';
import { formatUsername } from '../format';
import {
  RedditBanIcon,
  RedditRemoveIcon,
  RedditSpamIcon,
  RedditUsersIcon,
} from '../reddit-icons';
import type { ActionRunner } from '../types';
import type { FlaggedComment, Incident } from '../../../shared/api';
import {
  BAN_DURATION_OPTIONS,
  parseBanDuration,
  type CommentPrepKind,
} from './comment-state';

export const CommentActionPrepPanel = ({
  activePrep,
  banDuration,
  busyAction,
  comment,
  incident,
  reason,
  userNote,
  onAction,
  onBanDurationChange,
  onCancel,
  onReasonChange,
  onUserNoteChange,
}: {
  activePrep: CommentPrepKind;
  banDuration: string;
  busyAction: string | undefined;
  comment: FlaggedComment;
  incident: Incident;
  reason: string;
  userNote: string;
  onAction: ActionRunner;
  onBanDurationChange: (value: string) => void;
  onCancel: () => void;
  onReasonChange: (value: string) => void;
  onUserNoteChange: (value: string) => void;
}) => {
  const encodedAuthor = encodeURIComponent(comment.author);
  const commentAction = `comment:${comment.id}:${activePrep}`;
  const removeAction = `remove:${comment.id}`;
  const banAction = `ban:${comment.author}`;
  const userAction = `user:${comment.author}:${activePrep}`;
  const run = (
    action: string,
    endpoint: string,
    body: Record<string, unknown>
  ) => {
    void onAction(action, endpoint, body).then((updatedIncident) => {
      if (updatedIncident) onCancel();
    });
  };

  if (activePrep === 'remove') {
    return (
      <ActionPrepPanel
        busy={busyAction === removeAction}
        primaryIcon={<RedditRemoveIcon data-icon="inline-start" />}
        primaryLabel="Remove"
        title="Remove comment"
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            removeAction,
            `/api/incidents/${incident.postId}/comments/${comment.id}/remove`,
            { reason }
          )
        }
      >
        <ActionTextArea
          id={`fw-remove-reason-${comment.id}`}
          label="Removal reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'ban') {
    return (
      <ActionPrepPanel
        busy={busyAction === banAction}
        primaryIcon={<RedditBanIcon data-icon="inline-start" />}
        primaryLabel="Remove and ban"
        title={`Ban ${formatUsername(comment.author)}`}
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            banAction,
            `/api/incidents/${incident.postId}/users/${encodedAuthor}/ban`,
            {
              durationDays: parseBanDuration(banDuration),
              reason,
            }
          )
        }
      >
        <ActionSelect
          id={`fw-ban-duration-${comment.id}`}
          label="Ban duration"
          value={banDuration}
          onChange={onBanDurationChange}
        >
          {BAN_DURATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ActionSelect>
        <ActionTextArea
          id={`fw-ban-reason-${comment.id}`}
          label="Ban reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'spam' || activePrep === 'thread') {
    const nativeAction = activePrep === 'spam' ? 'spam' : 'remove-thread';

    return (
      <ActionPrepPanel
        busy={busyAction === commentAction}
        primaryIcon={
          activePrep === 'spam' ? (
            <RedditSpamIcon data-icon="inline-start" />
          ) : (
            <RedditRemoveIcon data-icon="inline-start" />
          )
        }
        primaryLabel={activePrep === 'spam' ? 'Spam' : 'Remove thread'}
        title={activePrep === 'spam' ? 'Spam comment' : 'Remove comment thread'}
        variant="destructive"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            commentAction,
            `/api/incidents/${incident.postId}/comments/${comment.id}/native-action`,
            {
              action: nativeAction,
              reason,
            }
          )
        }
      >
        <ActionTextArea
          id={`fw-comment-native-reason-${comment.id}`}
          label="Removal reason"
          value={reason}
          onChange={onReasonChange}
        />
      </ActionPrepPanel>
    );
  }

  if (activePrep === 'mute' || activePrep === 'note') {
    const nativeAction = activePrep === 'mute' ? 'mute' : 'add-mod-note';

    return (
      <ActionPrepPanel
        busy={busyAction === userAction}
        primaryIcon={<RedditUsersIcon data-icon="inline-start" />}
        primaryLabel={activePrep === 'mute' ? 'Mute' : 'Add note'}
        title={
          activePrep === 'mute'
            ? `Mute ${formatUsername(comment.author)}`
            : `Add mod note for ${formatUsername(comment.author)}`
        }
        variant="outline"
        onCancel={onCancel}
        onSubmit={() =>
          run(
            userAction,
            `/api/incidents/${incident.postId}/users/${encodedAuthor}/native-action`,
            {
              action: nativeAction,
              note: userNote,
            }
          )
        }
      >
        <ActionTextArea
          id={`fw-user-note-${comment.id}`}
          label="Note"
          value={userNote}
          onChange={onUserNoteChange}
        />
      </ActionPrepPanel>
    );
  }

  return (
    <ActionPrepPanel
      busy={busyAction === userAction}
      primaryIcon={<RedditBanIcon data-icon="inline-start" />}
      primaryLabel="Remove content"
      title={`Remove recent content from ${formatUsername(comment.author)}`}
      variant="destructive"
      onCancel={onCancel}
      onSubmit={() =>
        run(
          userAction,
          `/api/incidents/${incident.postId}/users/${encodedAuthor}/native-action`,
          {
            action: 'remove-recent-content',
            reason,
          }
        )
      }
    >
      <ActionTextArea
        id={`fw-content-removal-reason-${comment.id}`}
        label="Removal reason"
        value={reason}
        onChange={onReasonChange}
      />
    </ActionPrepPanel>
  );
};
