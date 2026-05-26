export const normalizeUsername = (username: string | undefined) => {
  const normalized = username?.trim().replace(/^u\//i, '');
  if (
    !normalized ||
    normalized.startsWith('t2_') ||
    normalized.toLowerCase() === 'unknown user'
  ) {
    return undefined;
  }

  return normalized;
};

export const usernameKey = (username: string | undefined) =>
  normalizeUsername(username)?.toLowerCase();

export const formatUserHandle = (username: string | undefined) => {
  const normalized = normalizeUsername(username);
  return normalized ? `u/${normalized}` : 'unknown user';
};
