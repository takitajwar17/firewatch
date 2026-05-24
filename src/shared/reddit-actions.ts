import type {
  CrowdControlLevel,
  FirewatchConfig,
  IncidentActionType,
  NativeCommentAction,
  NativePostAction,
  NativeUserAction,
} from './api';

export const CROWD_CONTROL_OPTIONS: {
  label: string;
  value: CrowdControlLevel;
}[] = [
  { label: 'Off', value: 'OFF' },
  { label: 'Lenient', value: 'LENIENT' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Strict', value: 'STRICT' },
];

export const parseCrowdControlLevel = (
  value: string | undefined
): CrowdControlLevel => {
  if (
    value === 'OFF' ||
    value === 'LENIENT' ||
    value === 'MEDIUM' ||
    value === 'STRICT'
  ) {
    return value;
  }
  return 'MEDIUM';
};

export const postActionControl = (
  action: NativePostAction
): keyof FirewatchConfig['actionControls'] => {
  switch (action) {
    case 'approve':
      return 'approvePosts';
    case 'remove':
      return 'removePosts';
    case 'spam':
      return 'markPostSpam';
    case 'unlock':
      return 'unlockPost';
    case 'mark-nsfw':
    case 'unmark-nsfw':
      return 'markPostNsfw';
    case 'mark-spoiler':
    case 'unmark-spoiler':
      return 'markPostSpoiler';
    case 'ignore-reports':
    case 'unignore-reports':
      return 'ignoreReports';
    case 'crowd-control':
      return 'crowdControl';
    case 'set-flair':
      return 'setPostFlair';
  }
};

export const nativePostActionType = (
  action: NativePostAction
): IncidentActionType => {
  switch (action) {
    case 'approve':
      return 'post_approved';
    case 'remove':
      return 'post_removed';
    case 'spam':
      return 'post_spammed';
    case 'unlock':
      return 'post_unlocked';
    case 'mark-nsfw':
      return 'post_marked_nsfw';
    case 'unmark-nsfw':
      return 'post_unmarked_nsfw';
    case 'mark-spoiler':
      return 'post_marked_spoiler';
    case 'unmark-spoiler':
      return 'post_unmarked_spoiler';
    case 'ignore-reports':
      return 'post_reports_ignored';
    case 'unignore-reports':
      return 'post_reports_unignored';
    case 'crowd-control':
      return 'post_crowd_control';
    case 'set-flair':
      return 'post_flaired';
  }
};

export const postActionDetail = ({
  action,
  crowdControlLevel,
  flairText,
  reason,
}: {
  action: NativePostAction;
  crowdControlLevel?: CrowdControlLevel | undefined;
  flairText?: string | undefined;
  reason?: string | undefined;
}) => {
  switch (action) {
    case 'approve':
      return 'Approved post';
    case 'remove':
      return `Removed post${reason ? `: ${reason}` : ''}`;
    case 'spam':
      return `Removed post as spam${reason ? `: ${reason}` : ''}`;
    case 'unlock':
      return 'Unlocked post';
    case 'mark-nsfw':
      return 'Marked post NSFW';
    case 'unmark-nsfw':
      return 'Removed NSFW tag';
    case 'mark-spoiler':
      return 'Marked post spoiler';
    case 'unmark-spoiler':
      return 'Removed spoiler tag';
    case 'ignore-reports':
      return 'Ignored future reports on post';
    case 'unignore-reports':
      return 'Stopped ignoring post reports';
    case 'crowd-control':
      return `Set crowd control to ${crowdControlLevel ?? 'MEDIUM'}`;
    case 'set-flair':
      return flairText ? `Set post flair to "${flairText}"` : 'Set post flair';
  }
};

export const commentActionControl = (
  action: NativeCommentAction
): keyof FirewatchConfig['actionControls'] => {
  switch (action) {
    case 'spam':
      return 'markCommentSpam';
    case 'lock':
    case 'unlock':
      return 'lockComments';
    case 'ignore-reports':
    case 'unignore-reports':
      return 'ignoreCommentReports';
    case 'remove-thread':
      return 'removeCommentThreads';
    case 'show-comment':
      return 'showComments';
  }
};

export const nativeCommentActionType = (
  action: NativeCommentAction
): IncidentActionType => {
  switch (action) {
    case 'spam':
      return 'comment_spammed';
    case 'lock':
      return 'comment_locked';
    case 'unlock':
      return 'comment_unlocked';
    case 'ignore-reports':
      return 'comment_reports_ignored';
    case 'unignore-reports':
      return 'comment_reports_unignored';
    case 'remove-thread':
      return 'comment_thread_removed';
    case 'show-comment':
      return 'comment_shown';
  }
};

export const commentActionDetail = ({
  action,
  count,
  reason,
}: {
  action: NativeCommentAction;
  count: number;
  reason?: string | undefined;
}) => {
  switch (action) {
    case 'spam':
      return `Removed comment as spam${reason ? `: ${reason}` : ''}`;
    case 'lock':
      return 'Locked comment';
    case 'unlock':
      return 'Unlocked comment';
    case 'ignore-reports':
      return 'Ignored future reports on comment';
    case 'unignore-reports':
      return 'Stopped ignoring comment reports';
    case 'remove-thread':
      return `Removed comment thread (${count} comment${count === 1 ? '' : 's'})${
        reason ? `: ${reason}` : ''
      }`;
    case 'show-comment':
      return 'Marked comment as shown';
  }
};

export const userActionControl = (
  action: NativeUserAction
): keyof FirewatchConfig['actionControls'] => {
  switch (action) {
    case 'approve':
      return 'approveUsers';
    case 'mute':
      return 'muteUsers';
    case 'add-mod-note':
      return 'addModNotes';
    case 'remove-recent-content':
      return 'removeUserContent';
  }
};

export const nativeUserActionType = (
  action: NativeUserAction
): IncidentActionType => {
  switch (action) {
    case 'approve':
      return 'user_approved';
    case 'mute':
      return 'user_muted';
    case 'add-mod-note':
      return 'mod_note_added';
    case 'remove-recent-content':
      return 'user_content_removed';
  }
};

export const userActionDetail = ({
  action,
  count,
  note,
  username,
}: {
  action: NativeUserAction;
  count: number;
  note?: string | undefined;
  username: string;
}) => {
  switch (action) {
    case 'approve':
      return `Approved u/${username} in this subreddit`;
    case 'mute':
      return `Muted u/${username} from modmail${note ? `: ${note}` : ''}`;
    case 'add-mod-note':
      return `Added Reddit mod note for u/${username}${note ? `: ${note}` : ''}`;
    case 'remove-recent-content':
      return `Removed ${count} recent item${count === 1 ? '' : 's'} from u/${username}`;
  }
};
