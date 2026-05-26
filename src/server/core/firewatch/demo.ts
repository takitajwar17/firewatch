import { context, redis, reddit } from '@devvit/web/server';
import type {
  FirewatchConfig,
  FirewatchDemoScenarioId,
  Incident,
} from '../../../shared/api';
import {
  DEFAULT_DEMO_SCENARIO_ID,
  getDemoScenario,
} from '../../../shared/firewatch-presets';
import {
  addUserStrike,
  clearUserStrikesForPost,
} from '../firewatch-rules/strikes';
import {
  attachRuleContext,
  recordRuleMatches,
} from '../firewatch-rules/matching';
import { runRuleAutomationActions } from './automation';
import { appendAction } from './incidents';
import { upsertIncidentSignal } from './signals';
import {
  actorName,
  clearRememberedIncident,
  getConfig,
  getIndex,
  getIncident,
  getRememberedIncidentPostId,
  removeFromIncidentRegistry,
  saveIncident,
  saveIndex,
} from './store';
import { claimKey, incidentKey, normalizeUsername, now } from '../firewatch-utils';


// Demo comment seed builder
const pick = <T>(items: T[], index: number, fallback: T) =>
  items.length > 0 ? (items[index % items.length] ?? fallback) : fallback;

const demoKeyword = (config: FirewatchConfig) =>
  config.keywords.find(
    (keyword) => !['kill', 'slur', 'hate'].includes(keyword.toLowerCase())
  ) ?? 'brigade';

export type DemoCommentSeed = {
  author: string;
  body: string;
  reportReason?: string;
  branch?: 'cluster' | 'post';
};

type DemoPostSeed = {
  actionDetail: string;
  body: string;
  manualReason: string;
  postReportReason: string;
  strikeReasons?: {
    reason: string;
    source: 'watched_domain' | 'watched_word';
    username: string;
  }[];
  title: string;
};

const demoUrl = (domain: string, path: string) =>
  `hxxps://${domain}/${path.replace(/^\/+/, '')}`;

const buildDemoPostSeed = ({
  scenarioId,
  suspiciousDomain,
}: {
  scenarioId: FirewatchDemoScenarioId;
  suspiciousDomain: string;
}): DemoPostSeed => {
  const claimUrl = demoUrl(suspiciousDomain, 'claim-prize');
  const supportUrl = demoUrl(suspiciousDomain, 'support-check');
  const verifyUrl = demoUrl(suspiciousDomain, 'verify-account');

  if (scenarioId === 'suspicious_giveaway_escalating') {
    return {
      title: '[Firewatch demo] Official giveaway claim before midnight',
      body: [
        'I still have extra payouts from the promo list.',
        `DM me before midnight for free money, then open ${claimUrl}.`,
        'A small admin fee unlocks the claim.',
      ].join('\n\n'),
      postReportReason: 'Scam giveaway link',
      manualReason: 'Sent from the post menu after the giveaway replies started spreading.',
      actionDetail:
        'Created suspicious giveaway review with 6 comments plus post and comment reports',
      strikeReasons: [
        {
          reason: 'Earlier wallet claim linked a watched domain',
          source: 'watched_domain',
          username: 'PrizeWalletHelp',
        },
        {
          reason: 'Earlier giveaway reply reused admin fee language',
          source: 'watched_word',
          username: 'PrizeWalletHelp',
        },
      ],
    };
  }

  if (scenarioId === 'scam_link_cleanup') {
    return {
      title: '[Firewatch demo] Account recovery agent helped me unlock my wallet',
      body: [
        'If your account is locked, message me on telegram.',
        `My recovery agent uses ${supportUrl} and can reset passwords after a small admin fee.`,
        'Do not wait for official support if your wallet is already frozen.',
      ].join('\n\n'),
      postReportReason: 'Suspicious recovery service',
      manualReason: 'Sent from the post menu after recovery-agent comments appeared.',
      actionDetail:
        'Created scam link cleanup review with 6 comments plus post and comment reports',
    };
  }

  if (scenarioId === 'support_safety_cleanup') {
    return {
      title: '[Firewatch demo] Locked account help thread collecting recovery codes',
      body: [
        'I can help check locked accounts faster than official support.',
        `Paste the recovery code, email address, and last four digits here, or use ${verifyUrl}.`,
        'If you are embarrassed, DM me the same personal details instead.',
      ].join('\n\n'),
      postReportReason: 'Personal information risk',
      manualReason: 'Sent from the post menu after users began sharing account details.',
      actionDetail:
        'Created support safety review with 6 comments plus post and comment reports',
    };
  }

  return {
    title: '[Firewatch demo] Mods removed the warning and people deserve answers',
    body: [
      'The mods keep hiding evidence and deleting replies.',
      'Everyone should keep asking the same question until they explain it.',
      `One user posted ${supportUrl} as proof, and now the thread is turning into personal attacks.`,
    ].join('\n\n'),
    postReportReason: 'Personal attacks',
    manualReason: 'Sent from the post menu after the reply branch started piling on.',
    actionDetail:
      'Created crowded reply review with 8 comments plus post and comment reports',
  };
};

export const buildDemoComments = ({
  config,
  scenarioId,
}: {
  config: FirewatchConfig;
  scenarioId: FirewatchDemoScenarioId;
}): DemoCommentSeed[] => {
  const keyword = demoKeyword(config);
  const secondKeyword = pick(config.keywords, 4, 'report');
  const suspiciousDomain = pick(config.suspiciousDomains, 0, 'bit.ly');

  if (scenarioId === 'suspicious_giveaway_escalating') {
    const claimUrl = demoUrl(suspiciousDomain, 'claim-prize');
    return [
      {
        author: 'PrizeWalletHelp',
        body: `DM me for free money. The giveaway link is ${claimUrl}, and an admin fee unlocks it.`,
        reportReason: 'Scam giveaway link',
        branch: 'cluster',
      },
      {
        author: 'ThrowawayClaim82',
        body: `That ${claimUrl} page asks for my recovery code and says a recovery agent will help.`,
        reportReason: 'Suspicious domain',
        branch: 'cluster',
      },
      {
        author: 'PrizeWalletHelp',
        body: 'Message me on telegram for the recovery agent. I can fix accounts if you pay the admin fee.',
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'LinkWatcherLocal',
        body: 'Same giveaway line again: pay the admin fee before midnight to unlock free money.',
        reportReason: 'Repeated scam phrase',
        branch: 'cluster',
      },
      {
        author: 'CarefulHelper',
        body: 'Do not share recovery codes or wallet details. Use only official support links.',
        branch: 'post',
      },
      {
        author: 'ConcernedReader',
        body: 'The suspicious giveaway is moving fast and people keep repeating the same warning.',
        branch: 'post',
      },
    ];
  }

  if (scenarioId === 'scam_link_cleanup') {
    const supportUrl = demoUrl(suspiciousDomain, 'support-check');
    return [
      {
        author: 'QueueWatcher',
        body: `This looks like coordinated ${keyword} spam. The same account keeps dropping ${supportUrl} in replies.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'LockedOutToday',
        body: `Do not click that ${supportUrl} link. It asks for passwords and wallet details.`,
        reportReason: 'Unsafe support link',
        branch: 'cluster',
      },
      {
        author: 'RecoverNowAgent',
        body: 'DM me for account recovery. Pay the admin fee with a gift card and I can fix it.',
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'RecoverNowAgent',
        body: 'Anyone who wants help should message me on telegram. I know a recovery agent.',
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'CarefulHelper',
        body: 'Use the official help center and never share passwords or recovery codes.',
        branch: 'post',
      },
      {
        author: 'ConcernedReader',
        body: `The suspicious link is still spreading and people are repeating the same ${secondKeyword} warning.`,
        branch: 'post',
      },
    ];
  }

  if (scenarioId === 'support_safety_cleanup') {
    const verifyUrl = demoUrl(suspiciousDomain, 'verify-account');
    return [
      {
        author: 'CarefulHelper',
        body: 'This sounds risky. Please do not post account numbers or private contact details.',
        branch: 'cluster',
      },
      {
        author: 'RegularMember41',
        body: `The advice above may be unsafe. One ${keyword} reply is asking users to share passwords.`,
        reportReason: 'Unsafe advice',
        branch: 'cluster',
      },
      {
        author: 'LockedOutToday',
        body: 'I can paste my recovery code here if that helps.',
        reportReason: 'Personal information risk',
        branch: 'cluster',
      },
      {
        author: 'QueueWatcher',
        body: `Someone linked ${verifyUrl} and asked for personal details.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'SupportRegular',
        body: 'The safe answer is to contact official support and avoid sharing private info.',
        branch: 'post',
      },
      {
        author: 'ConcernedReader',
        body: `This post needs mod review before the ${secondKeyword} replies get copied again.`,
        branch: 'post',
      },
    ];
  }

  const repeatedPhrase = 'mods are hiding evidence';
  const supportUrl = demoUrl(suspiciousDomain, 'support-check');
  return [
    {
      author: 'PolicyWatcher',
      body: `This suddenly looks like outside ${keyword} traffic. ${repeatedPhrase}.`,
      branch: 'cluster',
    },
    {
      author: 'AngryRegular',
      body: `I keep seeing the same claim. ${repeatedPhrase} and nobody is answering.`,
      reportReason: 'Personal attacks',
      branch: 'cluster',
    },
    {
      author: 'LinkDropper91',
      body: `Please check this ${supportUrl} before it spreads further.`,
      reportReason: 'Suspicious link',
      branch: 'cluster',
    },
    {
      author: 'ThreadWatcher',
      body: `The argument is looping now. ${repeatedPhrase}.`,
      branch: 'cluster',
    },
    {
      author: 'CarefulHelper',
      body: `This feels like a ${secondKeyword} issue and the replies are getting personal.`,
      branch: 'cluster',
    },
    {
      author: 'ConcernedReader',
      body: 'Several new accounts are repeating the same line in this branch.',
      branch: 'cluster',
    },
    {
      author: 'PolicyWatcher',
      body: `I flagged the suspicious link and the ${keyword} comments.`,
      reportReason: 'Personal attacks',
      branch: 'post',
    },
    {
      author: 'AngryRegular',
      body: 'Can a mod step in before everyone piles onto the same user?',
      branch: 'post',
    },
  ];
};



// Demo incident lifecycle
export const createDemoIncident = async (
  scenarioId = DEFAULT_DEMO_SCENARIO_ID
) => {
  await resetDemoIncidents();

  const config = await getConfig();
  const seed = now();
  const scenario = getDemoScenario(scenarioId);
  const comments = buildDemoComments({ config, scenarioId: scenario.id });
  const suspiciousDomain = pick(config.suspiciousDomains, 0, 'bit.ly');
  const postSeed = buildDemoPostSeed({
    scenarioId: scenario.id,
    suspiciousDomain,
  });
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title: postSeed.title,
    text: postSeed.body,
  });
  const branchParentId = `t1_fw_demo_branch_${seed.toString(36)}`;
  for (const [index, comment] of comments.entries()) {
    const createdAt = seed - (comments.length - index) * 4 * 60 * 1000;
    const commentId = `t1_fw_demo_${seed.toString(36)}_${index}`;
    await upsertIncidentSignal({
      type: 'comment_create',
      source: 'user',
      postId: post.id,
      commentId,
      author: comment.author,
      body: comment.body,
      parentId: comment.branch === 'cluster' ? branchParentId : post.id,
      createdAt,
      isDemo: true,
      metadata: {
        scenario: scenario.label,
        scenarioId: scenario.id,
        generatedIndex: index,
      },
    });

    if (comment.reportReason) {
      await upsertIncidentSignal({
        type: 'comment_report',
        source: 'report',
        postId: post.id,
        commentId,
        author: comment.author,
        body: comment.body,
        parentId: comment.branch === 'cluster' ? branchParentId : post.id,
        reason: comment.reportReason,
        createdAt: createdAt + 60 * 1000,
        isDemo: true,
        metadata: {
          scenario: scenario.label,
          scenarioId: scenario.id,
          generatedIndex: index,
        },
      });
    }
  }

  if (postSeed.strikeReasons) {
    for (const strike of postSeed.strikeReasons) {
      await addUserStrike({
        createdBy: 'firewatch',
        reason: strike.reason,
        relatedPostId: post.id,
        source: strike.source,
        subredditName: context.subredditName,
        username: strike.username,
        weight: 1,
      });
    }
  }

  await upsertIncidentSignal({
    type: 'post_report',
    source: 'report',
    postId: post.id,
    body: `${post.title}\n${postSeed.body}`,
    reason: postSeed.postReportReason,
    createdAt: seed - 2 * 60 * 1000,
    isDemo: true,
    metadata: {
      scenario: scenario.label,
      scenarioId: scenario.id,
    },
  });
  const incident = await upsertIncidentSignal({
    type: 'manual_escalation',
    source: 'mod_action',
    postId: post.id,
    reason: postSeed.manualReason,
    createdAt: seed,
    isDemo: true,
    metadata: {
      scenario: scenario.label,
      scenarioId: scenario.id,
    },
  });

  const actor = await actorName();
  const withAction = await appendAction(incident.postId, {
    type: 'demo_seeded',
    actor,
    detail: postSeed.actionDetail,
  });
  const demoIncident: Incident = {
    ...withAction,
    demo: {
      scenario: scenario.label,
      scenarioId: scenario.id,
      seededAt: seed,
    },
  };
  const enrichedDemoIncident = await attachRuleContext(demoIncident, config);

  await saveIncident(enrichedDemoIncident);
  const ruleLogs = await recordRuleMatches({
    config,
    incident: enrichedDemoIncident,
    triggerType:
      scenario.id === 'suspicious_giveaway_escalating'
        ? 'user_strike_count_changed'
        : 'incident_score_changed',
  });
  return runRuleAutomationActions(enrichedDemoIncident, ruleLogs);
};

export const resetDemoIncidents = async () => {
  const index = await getIndex();
  let resetCount = 0;
  const keptPostIds: string[] = [];
  const demoStrikeCleanups: Array<{ postId: string; usernames: string[] }> = [];

  for (const postId of index) {
    const incident = await getIncident(postId);
    if (incident?.demo) {
      resetCount += 1;
      const demoAuthors = new Set<string>();
      [
        ...incident.recentSignals.map((signal) => signal.author),
        ...incident.flaggedComments.map((comment) => comment.author),
        ...incident.involvedUsers.map((user) => user.username),
      ].forEach((username) => {
        const normalized = normalizeUsername(username);
        if (normalized) demoAuthors.add(normalized);
      });
      demoStrikeCleanups.push({
        postId,
        usernames: Array.from(demoAuthors),
      });
      await redis.del(incidentKey(postId), claimKey(postId));
      await removeFromIncidentRegistry(context.subredditName, postId);
    } else {
      keptPostIds.push(postId);
    }
  }

  await Promise.all(
    demoStrikeCleanups.flatMap((cleanup) =>
      cleanup.usernames.map((username) =>
        clearUserStrikesForPost(context.subredditName, username, cleanup.postId)
      )
    )
  );
  const rememberedPostId = await getRememberedIncidentPostId();
  if (rememberedPostId && !keptPostIds.includes(rememberedPostId)) {
    await clearRememberedIncident();
  }

  await saveIndex(keptPostIds);
  return resetCount;
};
