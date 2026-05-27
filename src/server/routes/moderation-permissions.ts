import type {
  FirewatchModeratorPermission,
  IncidentActionType,
  NativePostAction,
  NativeUserAction,
  RuleAction,
} from '../../shared/api';
import {
  FLAIR_MODERATION_PERMISSIONS,
  POST_MODERATION_PERMISSIONS,
  USER_MODERATION_PERMISSIONS,
} from './auth';

const addPermission = (
  permissions: FirewatchModeratorPermission[],
  permission: FirewatchModeratorPermission
) => {
  if (!permissions.includes(permission)) permissions.push(permission);
};

export const mergePermissions = (
  ...groups: FirewatchModeratorPermission[][]
): FirewatchModeratorPermission[] => {
  const permissions: FirewatchModeratorPermission[] = [];
  for (const group of groups) {
    for (const permission of group) {
      addPermission(permissions, permission);
    }
  }
  return permissions;
};

export const postActionPermissions = (action: NativePostAction) =>
  action === 'set-flair' || action === 'clear-flair'
    ? mergePermissions(POST_MODERATION_PERMISSIONS, FLAIR_MODERATION_PERMISSIONS)
    : POST_MODERATION_PERMISSIONS;

export const userActionPermissions = (action: NativeUserAction) =>
  action === 'remove-recent-content'
    ? mergePermissions(POST_MODERATION_PERMISSIONS, USER_MODERATION_PERMISSIONS)
    : USER_MODERATION_PERMISSIONS;

export const ruleActionPermissions = (actions: RuleAction[]) => {
  const permissions = [...POST_MODERATION_PERMISSIONS];

  for (const action of actions) {
    if (
      action.type === 'prepare_temp_ban' ||
      action.type === 'prepare_permanent_ban' ||
      action.type === 'mute_user' ||
      action.type === 'add_native_mod_note' ||
      action.type === 'add_firewatch_strike'
    ) {
      for (const permission of USER_MODERATION_PERMISSIONS) {
        addPermission(permissions, permission);
      }
    }

    if (action.type === 'set_post_flair') {
      for (const permission of FLAIR_MODERATION_PERMISSIONS) {
        addPermission(permissions, permission);
      }
    }
  }

  return permissions;
};

export const undoActionPermissions = (type: IncidentActionType) =>
  type === 'post_flaired' || type === 'post_flair_removed'
    ? mergePermissions(POST_MODERATION_PERMISSIONS, FLAIR_MODERATION_PERMISSIONS)
    : POST_MODERATION_PERMISSIONS;
