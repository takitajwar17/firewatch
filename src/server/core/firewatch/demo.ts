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
import type { PostSnapshot } from '../firewatch-scoring/helpers';
import { runRuleAutomationActions } from './automation';
import { appendAction } from './incidents';
import { logFirewatchError, logFirewatchWarn } from './logging';
import { upsertIncidentSignal } from './signals';
import {
  actorName,
  clearRememberedIncident,
  getConfig,
  getIndex,
  getIncident,
  getIncidentRegistry,
  getRememberedIncidentPostId,
  removeFromIncidentRegistry,
  saveIncident,
  saveIndex,
} from './store';
import { deleteRedditPostIfExists } from './reddit-runtime';
import {
  claimKey,
  incidentKey,
  normalizePostId,
  normalizeUsername,
  now,
} from '../firewatch-utils';


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
  actionDetailPrefix: string;
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
  `${domain.replaceAll('.', '(dot)')}/${path.replace(/^\/+/, '')}`;

const buildDemoPostSeed = (scenarioId: FirewatchDemoScenarioId): DemoPostSeed => {
  if (scenarioId === 'suspicious_giveaway_escalating') {
    return {
      title: '[Firewatch demo] Official giveaway claim before midnight',
      body: [
        'I was told this community still has unused promotional payouts from the last wallet campaign, and I can help people claim the remaining spots before the list closes tonight.',
        'Do not reply with questions if you are not serious. Send me a private message with your wallet name, the account you want credited, and proof that you are ready to finish the claim right away.',
        'The giveaway is first come, first served. People who wait for official support usually miss the window, so I am only helping users who can pay the small admin fee and confirm the transfer quickly.',
        'If a moderator removes this, it is only because they do not understand how the claim process works. Several people already received their payout after following the steps.',
      ].join('\n\n'),
      postReportReason: 'Scam giveaway link',
      manualReason: 'Sent from the post menu after the giveaway replies started spreading.',
      actionDetailPrefix: 'Created suspicious giveaway review',
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
        'Posting this because official support took too long and the recovery agent I used had my wallet unlocked in less than an hour. I know a lot of people here are stuck with frozen accounts and pending withdrawals.',
        'The process was simple. I sent my account email, explained the failed login, and paid the admin fee they asked for so they could put the recovery request at the front of the queue.',
        'If you are locked out, message me and I will tell you exactly what to send them. Do not waste days waiting for a ticket reply if your funds are already frozen.',
        'A few users warned me this was risky, but they were not the ones about to lose access to their account. I am sharing this because it worked for me and I do not want people to panic.',
      ].join('\n\n'),
      postReportReason: 'Suspicious recovery service',
      manualReason: 'Sent from the post menu after recovery-agent comments appeared.',
      actionDetailPrefix: 'Created scam link cleanup review',
    };
  }

  if (scenarioId === 'support_safety_cleanup') {
    return {
      title: '[Firewatch demo] Locked account help thread collecting recovery codes',
      body: [
        'I am making one thread for everyone who keeps asking about locked accounts because the same questions are scattered across the subreddit. If your account is stuck, put the important details here so helpers can compare cases.',
        'Include the recovery code shown on your screen, the email address on the account, the last four digits of the phone number, and what message you see after trying to log in.',
        'If you do not want to post everything publicly, say that in the comments and someone can tell you what to send privately. The goal is to collect enough information that people stop repeating the same half-answers.',
        'Please keep this organized. The faster people share the exact details, the faster the community can work out which lock messages are real and which ones need a different fix.',
      ].join('\n\n'),
      postReportReason: 'Personal information risk',
      manualReason: 'Sent from the post menu after users began sharing account details.',
      actionDetailPrefix: 'Created support safety review',
    };
  }

  return {
    title: '[Firewatch demo] Mods removed the warning and people deserve answers',
    body: [
      'A warning thread disappeared this morning and nobody has explained why. People keep saying it was removed for safety, but that does not answer the actual question everyone is asking.',
      'If regular users are not allowed to discuss what happened, the mod team should say that clearly instead of letting the same argument restart in every reply chain.',
      'A few accounts are now following one user around the thread and accusing them of covering things up. That is making the discussion worse, but deleting every warning also makes people more suspicious.',
      'I am not asking anyone to harass the mods. I am asking for one clear answer, because right now the thread is turning into the same sentence repeated over and over with more personal attacks each time.',
    ].join('\n\n'),
    postReportReason: 'Personal attacks',
    manualReason: 'Sent from the post menu after the reply branch started piling on.',
    actionDetailPrefix: 'Created crowded reply review',
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
        author: 'NewWalletUser',
        body: 'I almost paid the admin fee because the page says winners lose the claim after ten minutes.',
        reportReason: 'Scam pressure',
        branch: 'cluster',
      },
      {
        author: 'PrizeWalletHelp',
        body: 'Do not overthink it. Send the gift card code first and the wallet transfer will clear.',
        reportReason: 'Payment request',
        branch: 'cluster',
      },
      {
        author: 'QuietLurker113',
        body: `The same account posted ${claimUrl} in another thread and called it official support.`,
        reportReason: 'Repeated suspicious link',
        branch: 'cluster',
      },
      {
        author: 'ThrowawayClaim82',
        body: 'They asked me to type my seed phrase into a form. That is not how real giveaways work.',
        reportReason: 'Credential request',
        branch: 'cluster',
      },
      {
        author: 'PrizeWalletHelp',
        body: 'The recovery agent is online now. Message me before the free money window closes.',
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'CautiousMember',
        body: 'This is being copied word for word under every top-level reply.',
        branch: 'cluster',
      },
      {
        author: 'LinkWatcherLocal',
        body: 'I count three users saying they were sent to the same wallet form.',
        branch: 'post',
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
      {
        author: 'LateNightReader',
        body: 'A real moderator should remove the claim link before more people follow it.',
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
        author: 'LockedOutToday',
        body: 'They told me my account would be deleted unless I paid the admin fee in the next hour.',
        reportReason: 'Scam pressure',
        branch: 'cluster',
      },
      {
        author: 'RecoverNowAgent',
        body: `The real support form is ${supportUrl}. It verifies your wallet before support replies.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'QueueWatcher',
        body: 'Same recovery agent wording appeared in three comments after the first report.',
        branch: 'cluster',
      },
      {
        author: 'HelpfulRegular',
        body: 'Official support never asks for passwords, seed phrases, or gift card receipts.',
        branch: 'post',
      },
      {
        author: 'RecoverNowAgent',
        body: 'If the public replies are slow, DM me and I can bypass the normal queue.',
        reportReason: 'Off-platform support request',
        branch: 'post',
      },
      {
        author: 'LinkWatcherLocal',
        body: `I opened ${supportUrl} in a sandbox and it asks for account passwords.`,
        reportReason: 'Credential request',
        branch: 'post',
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
      {
        author: 'QueueWatcher',
        body: 'This thread needs cleanup before the recovery link gets quoted again.',
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
        author: 'LockedOutToday',
        body: 'I posted the last four digits of my phone number because the form said it was required.',
        reportReason: 'Personal information risk',
        branch: 'cluster',
      },
      {
        author: 'RegularMember41',
        body: 'Please remove the replies asking people to share account recovery screenshots.',
        reportReason: 'Personal information risk',
        branch: 'cluster',
      },
      {
        author: 'QueueWatcher',
        body: `The same ${verifyUrl} link now appears in two places and both ask for email addresses.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'HelpfulRegular',
        body: 'Tell users to contact official support privately instead of posting identifying details.',
        branch: 'post',
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
      {
        author: 'CarefulHelper',
        body: 'I reported the comments with recovery codes so they can be removed quickly.',
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
      author: 'AngryRegular',
      body: `The mods are hiding evidence and the regulars should keep pushing until they admit it.`,
      reportReason: 'Harassment',
      branch: 'cluster',
    },
    {
      author: 'ThreadWatcher',
      body: 'Two users are following the same person across replies now.',
      reportReason: 'Targeted replies',
      branch: 'cluster',
    },
    {
      author: 'PolicyWatcher',
      body: `Everyone keeps saying ${repeatedPhrase}, but nobody is adding new information.`,
      branch: 'cluster',
    },
    {
      author: 'LinkDropper91',
      body: `The proof link is still ${supportUrl}; stop deleting it.`,
      reportReason: 'Suspicious link',
      branch: 'cluster',
    },
    {
      author: 'QuietLurker113',
      body: 'This went from a policy question to a pile-on against one user.',
      reportReason: 'Personal attacks',
      branch: 'cluster',
    },
    {
      author: 'AngryRegular',
      body: 'Tag them again so they cannot pretend they missed the thread.',
      reportReason: 'Harassment',
      branch: 'cluster',
    },
    {
      author: 'CarefulHelper',
      body: 'Please stop naming individual users. Report the issue instead.',
      branch: 'cluster',
    },
    {
      author: 'ConcernedReader',
      body: 'A cooldown would help because every new reply restarts the same argument.',
      branch: 'cluster',
    },
    {
      author: 'ThreadWatcher',
      body: 'The same sentence has been posted by three accounts in six minutes.',
      branch: 'cluster',
    },
    {
      author: 'PolicyWatcher',
      body: 'I am adding context here because the branch is hard to follow now.',
      branch: 'post',
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
  const config = await getConfig();
  const seed = now();
  const scenario = getDemoScenario(scenarioId);
  const comments = buildDemoComments({ config, scenarioId: scenario.id });
  const postSeed = buildDemoPostSeed(scenario.id);
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title: postSeed.title,
    text: postSeed.body,
  });
  const postId = normalizePostId(post.id);
  const postSnapshot: PostSnapshot = {
    score: 0,
    numberOfComments: comments.length,
    title: postSeed.title,
    permalink: `/r/${context.subredditName}/comments/${postId.replace('t3_', '')}/`,
    subredditName: context.subredditName,
    numberOfReports: 0,
    createdAt: seed,
  };
  const branchParentId = `t1_fw_demo_branch_${seed.toString(36)}`;
  for (const [index, comment] of comments.entries()) {
    const createdAt = seed - (comments.length - index) * 4 * 60 * 1000;
    const commentId = `t1_fw_demo_${seed.toString(36)}_${index}`;
    await upsertIncidentSignal({
      type: 'comment_create',
      source: 'user',
      postId,
      commentId,
      author: comment.author,
      body: comment.body,
      parentId: comment.branch === 'cluster' ? branchParentId : postId,
      createdAt,
      isDemo: true,
      postSnapshot,
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
        postId,
        commentId,
        author: comment.author,
        body: comment.body,
        parentId: comment.branch === 'cluster' ? branchParentId : postId,
        reason: comment.reportReason,
        createdAt: createdAt + 60 * 1000,
        isDemo: true,
        postSnapshot,
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
        relatedPostId: postId,
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
    postId,
    body: `${postSeed.title}\n${postSeed.body}`,
    reason: postSeed.postReportReason,
    createdAt: seed - 2 * 60 * 1000,
    isDemo: true,
    postSnapshot,
    metadata: {
      scenario: scenario.label,
      scenarioId: scenario.id,
    },
  });
  const incident = await upsertIncidentSignal({
    type: 'manual_escalation',
    source: 'mod_action',
    postId,
    reason: postSeed.manualReason,
    createdAt: seed,
    isDemo: true,
    postSnapshot,
    metadata: {
      scenario: scenario.label,
      scenarioId: scenario.id,
    },
  });

  const actor = await actorName();
  const withAction = await appendAction(incident.postId, {
    type: 'demo_seeded',
    actor,
    detail: `${postSeed.actionDetailPrefix} with ${comments.length} sample review comments and report signals`,
  });
  const demoIncident: Incident = {
    ...withAction,
    demo: {
      commentModel: 'sample_review_signals',
      scenario: scenario.label,
      scenarioId: scenario.id,
      seededAt: seed,
    },
  };
  const enrichedDemoIncident = await attachRuleContext(demoIncident, config);

  await saveIncident(enrichedDemoIncident);
  try {
    const ruleLogs = await recordRuleMatches({
      config,
      incident: enrichedDemoIncident,
      triggerType:
        scenario.id === 'suspicious_giveaway_escalating'
          ? 'user_strike_count_changed'
          : 'incident_score_changed',
    });
    return await runRuleAutomationActions(enrichedDemoIncident, ruleLogs);
  } catch (error) {
    logFirewatchError('demo.automation_setup_failed', {
      postId: enrichedDemoIncident.postId,
      scenarioId: scenario.id,
      subredditName: enrichedDemoIncident.subredditName,
      error,
    });
    return enrichedDemoIncident;
  }
};

export const createDemoIncidents = async (
  scenarioIds: FirewatchDemoScenarioId[] = [DEFAULT_DEMO_SCENARIO_ID]
) => {
  const result = await createDemoIncidentBatch(scenarioIds);
  const latestIncident = result.createdIncidents.at(-1);
  if (latestIncident) return latestIncident;

  throw new Error('No Firewatch demo posts could be created.');
};

export const createDemoIncidentBatch = async (
  scenarioIds: FirewatchDemoScenarioId[] = [DEFAULT_DEMO_SCENARIO_ID]
) => {
  const selectedScenarioIds =
    scenarioIds.length > 0 ? scenarioIds : [DEFAULT_DEMO_SCENARIO_ID];
  const createdIncidents: Incident[] = [];
  const failures: Array<{
    message: string;
    scenarioId: FirewatchDemoScenarioId;
  }> = [];

  for (const scenarioId of selectedScenarioIds) {
    try {
      createdIncidents.push(await createDemoIncident(scenarioId));
    } catch (error) {
      logFirewatchError('demo.create_failed', {
        scenarioId,
        subredditName: context.subredditName,
        error,
      });
      failures.push({
        scenarioId,
        message:
          error instanceof Error
            ? error.message
            : 'Unknown demo creation failure',
      });
    }
  }

  return { createdIncidents, failures };
};

const deleteDemoRedditPost = async (postId: string) => {
  try {
    const deleted = await deleteRedditPostIfExists(postId);
    if (!deleted) {
      logFirewatchWarn('demo.post_already_missing', {
        postId,
        subredditName: context.subredditName,
      });
    }
  } catch (error) {
    logFirewatchError('demo.post_delete_failed', {
      postId,
      subredditName: context.subredditName,
      error,
    });
  }
};

export const resetDemoIncidents = async () => {
  const index = await getIndex();
  const registry = await getIncidentRegistry(context.subredditName);
  let resetCount = 0;
  const keptPostIds: string[] = [];
  const demoStrikeCleanups: Array<{ postId: string; usernames: string[] }> = [];

  for (const postId of Array.from(new Set([...index, ...registry]))) {
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
      await deleteDemoRedditPost(postId);
      await redis.del(incidentKey(postId), claimKey(postId));
      await removeFromIncidentRegistry(context.subredditName, postId);
    } else if (index.includes(postId)) {
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
