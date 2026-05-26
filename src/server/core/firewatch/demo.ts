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
  clearUserStrikes,
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
  items.length > 0 ? items[index % items.length] : fallback;

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
    return [
      {
        author: 'demoSpammer',
        body: `DM me for free money. The giveaway wallet is at ${suspiciousDomain}/claim and an admin fee gift card unlocks it.`,
        reportReason: 'Scam giveaway link',
        branch: 'cluster',
      },
      {
        author: 'demoNewcomer',
        body: `That ${suspiciousDomain}/claim page asks for my wallet recovery code and says a recovery agent will help.`,
        reportReason: 'Suspicious domain',
        branch: 'cluster',
      },
      {
        author: 'demoSpammer',
        body: 'Message me on telegram for the recovery agent. I can fix accounts if you pay the admin fee.',
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'demoScout',
        body: `This same giveaway phrase keeps repeating: pay the admin fee to unlock free money.`,
        reportReason: 'Repeated scam phrase',
        branch: 'cluster',
      },
      {
        author: 'demoHelper',
        body: 'Do not share recovery codes or wallet details. Use only official support links.',
        branch: 'post',
      },
      {
        author: 'demoConcerned',
        body: `The suspicious giveaway is spreading fast and the same ${secondKeyword} warning keeps coming up.`,
        branch: 'post',
      },
    ];
  }

  if (scenarioId === 'scam_link_cleanup') {
    return [
      {
        author: 'demoScout',
        body: `This looks like a ${keyword} wave. The same account keeps dropping ${suspiciousDomain}/support in replies.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'demoNewcomer',
        body: `Do not click that ${suspiciousDomain}/support link. It asks for passwords and wallet details.`,
        reportReason: 'Unsafe support link',
        branch: 'cluster',
      },
      {
        author: 'demoSpammer',
        body: `DM me for account recovery. Pay the admin fee with a gift card and I can fix it.`,
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'demoSpammer',
        body: `Anyone who wants help should message me on telegram. I know a recovery agent.`,
        reportReason: 'Scam offer',
        branch: 'cluster',
      },
      {
        author: 'demoHelper',
        body: 'Use the official help center and never share passwords or recovery codes.',
        branch: 'post',
      },
      {
        author: 'demoConcerned',
        body: `The suspicious link is still spreading and people are repeating the same ${secondKeyword} warning.`,
        branch: 'post',
      },
    ];
  }

  if (scenarioId === 'support_safety_cleanup') {
    return [
      {
        author: 'demoHelper',
        body: 'This sounds risky. Please do not post account numbers or private contact details.',
        branch: 'cluster',
      },
      {
        author: 'demoRegular',
        body: `The advice above may be unsafe. A ${keyword} comment is asking users to share passwords.`,
        reportReason: 'Unsafe advice',
        branch: 'cluster',
      },
      {
        author: 'demoNewcomer',
        body: 'I can paste my recovery code here if that helps.',
        reportReason: 'Personal information risk',
        branch: 'cluster',
      },
      {
        author: 'demoWatcher',
        body: `Someone linked ${suspiciousDomain}/verify and asked for personal details.`,
        reportReason: 'Suspicious link',
        branch: 'cluster',
      },
      {
        author: 'demoScout',
        body: 'The safe answer is to contact official support and avoid sharing private info.',
        branch: 'post',
      },
      {
        author: 'demoConcerned',
        body: `This post needs mod review before the ${secondKeyword} replies get copied again.`,
        branch: 'post',
      },
    ];
  }

  const repeatedPhrase = 'mods are hiding evidence';
  return [
    {
      author: 'demoScout',
      body: `This suddenly looks like a ${keyword} from outside the community. ${repeatedPhrase}.`,
      branch: 'cluster',
    },
    {
      author: 'demoRegular',
      body: `I keep seeing the same claim. ${repeatedPhrase} and nobody is answering.`,
      reportReason: 'Personal attacks',
      branch: 'cluster',
    },
    {
      author: 'demoNewcomer',
      body: `Please check this ${suspiciousDomain}/post before it spreads further.`,
      reportReason: 'Suspicious link',
      branch: 'cluster',
    },
    {
      author: 'demoWatcher',
      body: `The argument is looping now. ${repeatedPhrase}.`,
      branch: 'cluster',
    },
    {
      author: 'demoHelper',
      body: `This feels like a ${secondKeyword} issue and the replies are getting personal.`,
      branch: 'cluster',
    },
    {
      author: 'demoConcerned',
      body: 'Several new accounts are repeating the same line in this branch.',
      branch: 'cluster',
    },
    {
      author: 'demoScout',
      body: `I reported the suspicious link and the ${keyword} comments.`,
      reportReason: 'Personal attacks',
      branch: 'post',
    },
    {
      author: 'demoRegular',
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
  const title =
    scenario.id === 'suspicious_giveaway_escalating'
      ? 'Suspicious giveaway thread escalating'
      : `[Firewatch demo] ${scenario.label} ${new Date(seed).toLocaleTimeString()}`;
  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title,
    text: [
      `This is a Firewatch demo post for: ${scenario.label}.`,
      'Posts show up in Firewatch through the same path used by comments, reports, and posts sent by mods.',
      'Mods can test claiming the post, adding a sticky comment, removing comments, locking the post, saving a handoff note, and marking it resolved without waiting for real reports.',
    ].join('\n\n'),
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

  if (scenario.id === 'suspicious_giveaway_escalating') {
    await addUserStrike({
      createdBy: 'firewatch',
      reason: 'Previous suspicious giveaway link matched a watched domain',
      relatedPostId: post.id,
      source: 'watched_domain',
      subredditName: context.subredditName,
      username: 'demoSpammer',
      weight: 1,
    });
    await addUserStrike({
      createdBy: 'firewatch',
      reason: 'Previous scam phrase matched watched words',
      relatedPostId: post.id,
      source: 'watched_word',
      subredditName: context.subredditName,
      username: 'demoSpammer',
      weight: 1,
    });
  }

  await upsertIncidentSignal({
    type: 'post_report',
    source: 'report',
    postId: post.id,
    body: `${post.title}\nDemo report: ${scenario.description}`,
    reason: 'Post needs mod review',
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
    reason: 'Demo post sent for moderator review',
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
    detail: `Created ${scenario.label.toLowerCase()} demo with ${comments.length} comment events and report/manual signals`,
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
  const demoAuthors = new Set<string>();

  for (const postId of index) {
    const incident = await getIncident(postId);
    if (incident?.demo) {
      resetCount += 1;
      [
        ...incident.recentSignals.map((signal) => signal.author),
        ...incident.flaggedComments.map((comment) => comment.author),
        ...incident.involvedUsers.map((user) => user.username),
      ].forEach((username) => {
        const normalized = normalizeUsername(username);
        if (normalized?.toLowerCase().startsWith('demo')) {
          demoAuthors.add(normalized);
        }
      });
      await redis.del(incidentKey(postId), claimKey(postId));
      await removeFromIncidentRegistry(context.subredditName, postId);
    } else {
      keptPostIds.push(postId);
    }
  }

  await Promise.all(
    Array.from(demoAuthors).map((username) =>
      clearUserStrikes(context.subredditName, username)
    )
  );
  const rememberedPostId = await getRememberedIncidentPostId();
  if (rememberedPostId && !keptPostIds.includes(rememberedPostId)) {
    await clearRememberedIncident();
  }

  await saveIndex(keptPostIds);
  return resetCount;
};
