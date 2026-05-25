import type {
  IncidentSignal,
  SafetyReview,
  SafetyReviewCategory,
  SafetyReviewMatch,
} from '../../shared/api';
import { normalizeCommentId, normalizeUsername, now } from './firewatch-utils';

type SafetyPattern = {
  category: SafetyReviewCategory;
  detail: string;
  label: string;
  patterns: RegExp[];
};

type TextSafetyMatch = {
  category: SafetyReviewCategory;
  detail: string;
  label: string;
  matchedText: string;
};

const SAFETY_PATTERNS: SafetyPattern[] = [
  {
    category: 'self_harm',
    detail: 'Possible self-harm, suicide, or immediate personal crisis language',
    label: 'Self-harm language',
    patterns: [
      /\bkill myself\b/i,
      /\bend my life\b/i,
      /\btake my own life\b/i,
      /\bcommit suicide\b/i,
      /\bdie by suicide\b/i,
      /\bsuicidal\b/i,
      /\bsuicide note\b/i,
      /\bself[-\s]?harm\b/i,
      /\bcut myself\b/i,
      /\b(?:want|wanted|plan|planning|going|gonna|ready|trying|about)\s+to\s+(?:die|kill myself|hurt myself|harm myself)\b/i,
      /\b(?:i'?m|i am|i will|i'?ll)\s+(?:going|gonna|ready|planning|trying|about)\s+to\s+(?:kill|hurt|harm)\s+myself\b/i,
      /\b(?:i do not|i don't|dont|don't)\s+want\s+to\s+live\b/i,
      /\b(?:no reason|nothing)\s+to\s+live\b/i,
      /\b(?:took|taking|about to take)\s+(?:too many|a lot of)\s+(?:pills|tablets|meds|medication)\b/i,
      /\boverdose(?:d|s|ing)?\s+(?:on|with)\s+(?:pills|tablets|meds|medication)\b/i,
    ],
  },
  {
    category: 'personal_info',
    detail: 'Possible private information request, credential request, or doxxing context',
    label: 'Personal info risk',
    patterns: [
      /\bhome address\b/i,
      /\bphone number\b/i,
      /\bip address\b/i,
      /\bsocial security\b/i,
      /\bsocial security number\b/i,
      /\bssn\b/i,
      /\bpassport number\b/i,
      /\bdriver'?s license\b/i,
      /\bbank account\b/i,
      /\brouting number\b/i,
      /\bcredit card number\b/i,
      /\bdebit card number\b/i,
      /\brecovery code\b/i,
      /\bbackup codes?\b/i,
      /\bseed phrase\b/i,
      /\bwallet seed\b/i,
      /\bprivate key\b/i,
      /\b2fa code\b/i,
      /\btwo[-\s]?factor code\b/i,
      /\bone[-\s]?time code\b/i,
      /\botp code\b/i,
      /\bverification code\b/i,
      /\blogin code\b/i,
      /\bauthenticator code\b/i,
      /\baccount numbers?\b/i,
      /\bpersonal details\b/i,
      /\bprivate contact details\b/i,
      /\b(?:post|share|send|dm|give|paste|drop)\s+(?:me\s+)?(?:your\s+)?(?:address|home address|phone number|email address|real name|full name|ip address|ssn|social security number|passport number|driver'?s license|bank account|routing number|credit card|debit card|passwords?|recovery code|seed phrase|private key|2fa code|one[-\s]?time code|otp|verification code|login code|backup codes?)\b/i,
      /\b(?:leak|post|share|drop|publish)\s+(?:your|their|his|her)\s+(?:address|phone number|ip address|real name|private info|personal info)\b/i,
      /\bdoxx?(?:ing|ed)?\b/i,
    ],
  },
  {
    category: 'threat',
    detail: 'Possible direct threat, targeted intimidation, or offline harm',
    label: 'Threatening language',
    patterns: [
      /\bkill you\b/i,
      /\bshoot you\b/i,
      /\bstab you\b/i,
      /\b(?:i will|i'?ll|i am going to|i'?m going to|im going to|gonna|going to)\s+(?:kill|hurt|shoot|stab|beat|attack|harm)\s+you\b/i,
      /\b(?:track|hunt)\s+you\s+down\b/i,
      /\bcome\s+(?:to|over to)\s+your\s+(?:house|home|work|school)\b/i,
      /\bshow\s+up\s+at\s+your\s+(?:house|home|work|school)\b/i,
      /\b(?:come|coming)\s+after\s+you\b/i,
      /\bwatch\s+your\s+back\b/i,
      /\bbreak\s+your\s+(?:legs|arms|face|jaw)\b/i,
      /\bburn\s+(?:your|their|his|her)\s+(?:house|home)\s+down\b/i,
      /\bswat\s+you\b/i,
      /\bswatting\s+you\b/i,
      /\bdeath threat\b/i,
      /\bthreaten(?:ing|ed)?\s+(?:you|them|him|her)\b/i,
    ],
  },
  {
    category: 'minor_safety',
    detail: 'Possible minor, underage sexual content, or child exploitation context',
    label: 'Minor safety',
    patterns: [
      /\bminor safety\b/i,
      /\bchild exploitation\b/i,
      /\bchild sexual\b/i,
      /\bchild sexual abuse material\b/i,
      /\bcsam\b/i,
      /\bminor nudes?\b/i,
      /\bunderage nudes?\b/i,
      /\bunderage sexual\b/i,
      /\bsexualized minor\b/i,
      /\bminor sexual content\b/i,
      /\bgroom(?:ing|ed)?\s+(?:a\s+)?(?:minor|child|kid|underage user)\b/i,
      /\b1[3-7][-\s]?year[-\s]?old\s+(?:nudes?|sexual|explicit|private photos?|pics?)\b/i,
      /\b(?:minor|child|kid|underage user)'?s?\s+private\s+(?:photos?|pics?|images?|details)\b/i,
      /\b(?:send|share|post|dm)\s+(?:me\s+)?(?:minor|underage|child|kid).{0,40}\b(?:nudes?|explicit|sexual|private photos?|pics?)\b/i,
      /\b(?:send|share|post|dm).{0,40}\b(?:nudes?|explicit|sexual|private photos?|pics?)\b.{0,40}\b(?:minor|underage|child|kid)\b/i,
    ],
  },
];

const compactText = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export const detectSafetyMatchesInText = (text: string): TextSafetyMatch[] => {
  const cleanText = compactText(text);
  if (!cleanText) return [];

  const matches: TextSafetyMatch[] = [];
  for (const safetyPattern of SAFETY_PATTERNS) {
    for (const pattern of safetyPattern.patterns) {
      const result = pattern.exec(cleanText);
      if (!result?.[0]) continue;

      matches.push({
        category: safetyPattern.category,
        detail: safetyPattern.detail,
        label: safetyPattern.label,
        matchedText: result[0].slice(0, 80),
      });
      break;
    }
  }

  return matches;
};

export const detectSafetyReview = (
  signals: IncidentSignal[]
): SafetyReview | undefined => {
  const matchesByCategory = new Map<SafetyReviewCategory, SafetyReviewMatch>();

  for (const signal of signals) {
    const text = [signal.body, signal.reason].filter(Boolean).join('\n');
    const matches = detectSafetyMatchesInText(text);

    for (const match of matches) {
      if (matchesByCategory.has(match.category)) continue;

      matchesByCategory.set(match.category, {
        ...match,
        author: normalizeUsername(signal.author),
        commentId: signal.commentId
          ? normalizeCommentId(signal.commentId)
          : undefined,
        createdAt: signal.createdAt,
      });
    }
  }

  const matches = Array.from(matchesByCategory.values());
  if (matches.length === 0) return undefined;

  const firstMatch = matches[0];
  if (!firstMatch) return undefined;

  const summary =
    matches.length === 1
      ? `${firstMatch.label}: ${firstMatch.matchedText}`
      : `${matches.length} safety categories need review`;

  return {
    summary,
    matches,
    updatedAt: now(),
  };
};
