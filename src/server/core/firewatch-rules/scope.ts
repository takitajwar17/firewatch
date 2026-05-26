import { context, reddit } from '@devvit/web/server';
import type { FirewatchRule, Incident, RuleScope } from '../../../shared/api';
import { normalizeSignal, usernameKey } from '../firewatch-utils';

export type ModeratorScopeResolution = {
  usernames: Set<string>;
  verified: boolean;
};

export const isAutoModerator = (username: string | undefined) =>
  usernameKey(username) === 'automoderator';

export const isIgnoredAuthor = (
  username: string | undefined,
  ignoredAuthors: string[] | undefined
) => {
  const normalized = usernameKey(username);
  if (!normalized) return false;
  return (ignoredAuthors ?? []).some(
    (author) => usernameKey(author) === normalized
  );
};

export const approvedUsernames = (incident: Incident) =>
  new Set(
    incident.actions
      .filter((action) => action.type === 'user_approved')
      .flatMap((action) => action.targetIds ?? [])
      .map(usernameKey)
      .filter((username): username is string => Boolean(username))
  );

const knownModeratorUsernames = (incident: Incident) =>
  new Set(
    incident.actions
      .map((action) => usernameKey(action.actor))
      .filter((username): username is string => Boolean(username))
      .filter(
        (username) =>
          username !== 'firewatch' &&
          username !== context.appSlug?.toLowerCase()
      )
  );

export const getModeratorUsernames = async (
  incident: Incident,
  rules: FirewatchRule[]
): Promise<ModeratorScopeResolution> => {
  const moderators = knownModeratorUsernames(incident);
  if (!rules.some((rule) => rule.enabled && rule.scope.excludeModerators)) {
    return { usernames: moderators, verified: true };
  }

  try {
    const redditModerators = await reddit
      .getModerators({
        subredditName: incident.subredditName,
        limit: 1000,
        pageSize: 100,
      })
      .all();

    for (const moderator of redditModerators) {
      const username = usernameKey(moderator.username);
      if (username) moderators.add(username);
    }
  } catch {
    return { usernames: moderators, verified: false };
  }

  return { usernames: moderators, verified: true };
};

export const signalAllowedByScope = ({
  approvedUsers,
  moderatorUsers,
  scope,
  signal,
}: {
  approvedUsers: Set<string>;
  moderatorUsers: Set<string>;
  scope: RuleScope;
  signal: Incident['recentSignals'][number];
}) => {
  const normalizedSignal = normalizeSignal(signal);
  const author = normalizedSignal.author;

  if (
    scope.excludeFirewatchNotices &&
    normalizedSignal.source === 'firewatch_notice'
  ) {
    return false;
  }
  if (
    scope.excludeModerators &&
    (normalizedSignal.source === 'mod_action' ||
      Boolean(author && moderatorUsers.has(author.toLowerCase())))
  ) {
    return false;
  }
  if (
    scope.excludeApprovedUsers &&
    author &&
    approvedUsers.has(author.toLowerCase())
  ) {
    return false;
  }
  if (scope.excludeAutoModerator && isAutoModerator(author)) return false;
  if (isIgnoredAuthor(author, scope.ignoredAuthors)) return false;
  if (
    scope.commentAuthors?.length &&
    !scope.commentAuthors.some(
      (allowedAuthor) =>
        usernameKey(allowedAuthor) === usernameKey(author)
    )
  ) {
    return false;
  }

  return true;
};

export const postFlairAllowed = (incident: Incident, scope: RuleScope) => {
  if (!scope.postFlairs?.length) return true;

  const flair = incident.postState?.flair;
  if (!flair) return false;
  const allowed = new Set(scope.postFlairs.map((item) => item.toLowerCase()));
  return (
    allowed.has(flair.text.toLowerCase()) ||
    Boolean(flair.templateId && allowed.has(flair.templateId.toLowerCase()))
  );
};

export const signalText = (
  incident: Incident,
  scope: RuleScope,
  moderatorUsers: Set<string>,
  filter?: (signal: Incident['recentSignals'][number]) => boolean
) => {
  const approvedUsers = approvedUsernames(incident);

  return incident.recentSignals
    .filter((signal) =>
      signalAllowedByScope({
        approvedUsers,
        moderatorUsers,
        scope,
        signal,
      })
    )
    .filter((signal) => !filter || filter(signal))
    .map((signal) => signal.body)
    .filter((body): body is string => Boolean(body))
    .join('\n');
};
