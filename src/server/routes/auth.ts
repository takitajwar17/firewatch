import { context, reddit } from '@devvit/web/server';
import type {
  AccessDeniedResponse,
  FirewatchModeratorPermission,
} from '../../shared/api';
import { formatModeratorPermissionList } from '../../shared/api';
import { normalizeUsername } from '../core/firewatch-utils';

export const DASHBOARD_PERMISSIONS: FirewatchModeratorPermission[] = ['posts'];
export const CONFIG_PERMISSIONS: FirewatchModeratorPermission[] = ['config'];
export const POST_MODERATION_PERMISSIONS: FirewatchModeratorPermission[] = [
  'posts',
];
export const USER_MODERATION_PERMISSIONS: FirewatchModeratorPermission[] = [
  'access',
];
export const FLAIR_MODERATION_PERMISSIONS: FirewatchModeratorPermission[] = [
  'flair',
];

export class ModeratorPermissionError extends Error {
  constructor(
    readonly requiredPermissions: FirewatchModeratorPermission[],
    readonly grantedPermissions: FirewatchModeratorPermission[],
    message: string
  ) {
    super(message);
    this.name = 'ModeratorPermissionError';
  }
}

type ModeratorAccess = {
  allowed: boolean;
  grantedPermissions: FirewatchModeratorPermission[];
  requiredPermissions: FirewatchModeratorPermission[];
  subredditName: string;
  username?: string;
};

export const hasModeratorPermissions = (
  grantedPermissions: FirewatchModeratorPermission[],
  requiredPermissions: FirewatchModeratorPermission[]
) =>
  grantedPermissions.includes('all') ||
  requiredPermissions.every((permission) =>
    grantedPermissions.includes(permission)
  );

export const getModeratorAccess = async (
  requiredPermissions: FirewatchModeratorPermission[]
): Promise<ModeratorAccess> => {
  const subredditName = context.subredditName;
  const currentUser = await reddit.getCurrentUser();
  const username = normalizeUsername(
    context.username ?? currentUser?.username ?? undefined
  );

  if (!currentUser || !username) {
    return {
      allowed: false,
      grantedPermissions: [],
      requiredPermissions,
      subredditName,
    };
  }

  try {
    const grantedPermissions =
      await currentUser.getModPermissionsForSubreddit(subredditName);

    return {
      allowed: hasModeratorPermissions(grantedPermissions, requiredPermissions),
      grantedPermissions,
      requiredPermissions,
      subredditName,
      username,
    };
  } catch (error) {
    console.error('Failed to read current moderator permissions', error);

    return {
      allowed: false,
      grantedPermissions: [],
      requiredPermissions,
      subredditName,
      username,
    };
  }
};

export const accessDeniedPayload = (
  access: ModeratorAccess,
  action: string
): AccessDeniedResponse => ({
  type: 'access_denied',
  username: access.username,
  subredditName: access.subredditName,
  requiredPermissions: access.requiredPermissions,
  grantedPermissions: access.grantedPermissions,
  message: 'More mod access needed',
  detail: `Firewatch can only ${action} for mods with ${formatModeratorPermissionList(
    access.requiredPermissions,
    { includeAllFallback: true }
  )}.`,
});

export const requireModeratorPermissions = async (
  requiredPermissions: FirewatchModeratorPermission[],
  action: string
) => {
  const access = await getModeratorAccess(requiredPermissions);
  if (access.allowed) return access;

  throw new ModeratorPermissionError(
    requiredPermissions,
    access.grantedPermissions,
    accessDeniedPayload(access, action).detail
  );
};

export const isModeratorPermissionError = (
  error: unknown
): error is ModeratorPermissionError =>
  error instanceof ModeratorPermissionError;
