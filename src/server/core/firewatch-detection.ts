const DOMAIN_PATTERN =
  /\b(?:(?:https?|hxxps?):\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi;

const WORD_PATTERN = /[a-z0-9']+/g;

export type DetectionMatch = {
  term: string;
  count: number;
};

const normalizeSpace = (value: string) => value.replace(/\s+/g, ' ').trim();

export const normalizeDetectionText = (text: string) =>
  normalizeSpace(
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
  );

const normalizeTerm = (term: string) => normalizeDetectionText(term);

export const detectionTokens = (text: string) =>
  Array.from(normalizeDetectionText(text).matchAll(WORD_PATTERN)).map(
    (match) => match[0]
  );

const tokenMatchesTerm = (token: string, term: string) => {
  if (token === term) return true;
  if (term.length < 4) return false;
  if (!token.startsWith(term)) return false;
  return token.length <= term.length + 8;
};

const countMatchingTokenSequence = (
  tokens: string[],
  termTokens: string[],
  matchesToken: (token: string, termToken: string) => boolean
) => {
  if (termTokens.length === 0 || tokens.length < termTokens.length) return 0;

  let count = 0;
  for (let index = 0; index <= tokens.length - termTokens.length; index += 1) {
    const matched = termTokens.every((termToken, offset) =>
      matchesToken(tokens[index + offset] ?? '', termToken)
    );
    if (matched) count += 1;
  }

  return count;
};

const countTokenSequence = (tokens: string[], termTokens: string[]) =>
  countMatchingTokenSequence(tokens, termTokens, tokenMatchesTerm);

const countExactTokenSequence = (tokens: string[], termTokens: string[]) =>
  countMatchingTokenSequence(
    tokens,
    termTokens,
    (token, termToken) => token === termToken
  );

export const watchedWordMatches = (
  text: string,
  watchedWords: string[]
): DetectionMatch[] => {
  const tokens = detectionTokens(text);

  return watchedWords
    .map((word) => normalizeTerm(word))
    .filter(Boolean)
    .map((term) => ({
      term,
      count: countTokenSequence(tokens, detectionTokens(term)),
    }))
    .filter((match) => match.count > 0);
};

const urlForMatch = (match: string) => {
  const normalized = match
    .replace(/^hxxps?:\/\//i, (protocol) =>
      protocol.toLowerCase().startsWith('hxxps') ? 'https://' : 'http://'
    )
    .replace(/[),.;!?\]]+$/g, '');

  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
};

const normalizeObfuscatedDomains = (text: string) =>
  normalizeDetectionText(text)
    .replace(/([a-z0-9])\s*(?:\(\.\)|\[\.\]|\.)\s*([a-z0-9])/gi, '$1.$2')
    .replace(/([a-z0-9])\s*(?:\(|\[)?dot(?:\)|\])?\s*([a-z0-9])/gi, '$1.$2')
    .replace(
      /([a-z0-9])\s*(?:\(|\[)?slash(?:\)|\])?\s*([a-z0-9])/gi,
      '$1/$2'
    );

export const normalizeDomain = (domain: string) => {
  const trimmed = domain.trim().toLowerCase().replace(/[),.;!?\]]+$/g, '');
  if (!trimmed) return '';

  try {
    const url = new URL(urlForMatch(trimmed));
    return url.hostname.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return trimmed.replace(/^www\./, '').replace(/\.$/, '');
  }
};

export const extractDomains = (text: string) => {
  const domains = Array.from(
    normalizeObfuscatedDomains(text).matchAll(DOMAIN_PATTERN)
  )
    .map((match) => normalizeDomain(match[0]))
    .filter(Boolean);

  return Array.from(new Set(domains));
};

const domainMatches = (domain: string, watchedDomain: string) =>
  domain === watchedDomain || domain.endsWith(`.${watchedDomain}`);

export const watchedDomainMatches = (
  text: string,
  watchedDomains: string[]
): DetectionMatch[] => {
  const domains = extractDomains(text);

  return watchedDomains
    .map(normalizeDomain)
    .filter(Boolean)
    .map((term) => ({
      term,
      count: domains.filter((domain) => domainMatches(domain, term)).length,
    }))
    .filter((match) => match.count > 0);
};

export const linkCount = (text: string) => extractDomains(text).length;

export const textContainsTerm = ({
  caseSensitive,
  match,
  text,
  value,
}: {
  caseSensitive?: boolean;
  match: 'contains' | 'exact' | 'regex';
  text: string;
  value: string;
}) => {
  if (match === 'regex') {
    try {
      const regex = new RegExp(value, caseSensitive ? '' : 'i');
      return regex.test(text);
    } catch {
      return false;
    }
  }

  if (caseSensitive) return text.includes(value);

  const haystack = normalizeDetectionText(text);
  const needle = normalizeDetectionText(value);
  if (!needle) return false;

  if (match === 'exact') {
    return (
      countExactTokenSequence(detectionTokens(haystack), detectionTokens(needle)) >
      0
    );
  }

  return haystack.includes(needle);
};
