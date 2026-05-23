# Firewatch: Mod Command Center

Firewatch is a Devvit moderation command center for Reddit communities. It
helps mod teams detect escalating posts, understand the signals behind each
queue item, coordinate ownership, run response rules, take Reddit-native mod
actions, and save handoff notes.

Firewatch is built for high-noise threads: scam links, heated discussions,
support-safety issues, repeated wording, report spikes, AutoModerator filters,
and posts that need a shared moderator view before the situation gets worse.

## What Firewatch Does

- Creates a subreddit-level Firewatch queue post for moderators.
- Scores posts with deterministic, explainable signals instead of hidden AI
  moderation decisions.
- Tracks matching post creates and edits, new comments, comment reports, post
  reports, watched words, watched domains, repeated wording, reply pile-ons,
  manual moderator sends, moderator removal actions, and AutoModerator filter
  events.
- Shows queued posts with score, level, top reasons, flagged comments, involved
  users, repeated phrases, trend, recent activity, suggested next step, action
  history, and moderator impact.
- Lets one moderator take ownership so the rest of the team can see who is
  handling the incident.
- Lets moderators approve comments, remove comments with a Reddit removal note,
  ban a user after cleanup, lock or unlock posts, apply post actions, mute or
  approve users, add mod notes, remove recent user content, save handoff notes,
  and mark an incident handled.
- Provides Response Rules for common playbooks such as scam cleanup, repeated
  offender review, heated thread cooldowns, and lock recommendations.
- Includes demo drills that create a real source post and populate the queue
  through the same signal pipeline used by production events.
- Removes stored post or comment content when Reddit delete triggers are
  received.

## How Moderators Use It

1. Install Firewatch in a subreddit you moderate.
2. Open the subreddit menu and choose **Open Firewatch queue**.
3. Open **Firewatch settings** to tune watched words, watched domains, score
   thresholds, reminder text, signal weights, and available mod actions.
4. Let Firewatch queue matching activity from triggers, or choose **Send to
   Firewatch** from a post menu when a thread needs attention.
5. Review the score, visible reasons, impact snapshot, comments, users,
   activity, mod notes, and matched response rules.
6. Take ownership, approve acceptable comments, remove rule-breaking comments,
   lock the thread, run prepared rule actions, or save a handoff note.
7. Mark the incident handled once the queue item no longer needs active review.

## Response Rules And Automation

Firewatch Response Rules watch posts, comments, reports, incident scores, and
user strike counts. A rule can:

- Suggest actions without running them.
- Prepare actions for a moderator to review and run.
- Auto-run safe Firewatch-only actions while leaving Reddit-native actions for
  moderator approval.
- Auto-run all selected actions when a mod team deliberately enables that mode
  for a trusted rule.

Rules are transparent: each match records why it matched, which actions were
prepared, which actions ran, and which actions were skipped. Moderators should
test rules in a sandbox subreddit before enabling automatic actions in an
active community.

## Moderator Control

Firewatch scores are advisory. The app explains its reasons, but moderators
remain responsible for reviewing context, applying community rules, and deciding
whether to approve, remove, lock, ban, mute, flair, ignore reports, or take any
other action. Firewatch is designed to reduce queue work, not replace moderator
judgment.

## Data And Privacy

Firewatch stores only the data needed to run the moderation workflow for
installed communities: incident state, public Reddit identifiers, public content
excerpts needed for review, moderator settings, rule logs, action history, user
strike summaries, and handoff notes. Incident, claim, rule log, Response Rule,
and user strike records expire after 30 days. Per-moderator selected incident
state expires after 24 hours. Community configuration and the Firewatch queue
post reference do not have an app-set expiry and remain until changed, deleted
by app logic, or removed by platform storage behavior.

See [Privacy Policy](PRIVACY.md) and [Terms of Service](TERMS.md) for the full
policy text.

## Development

Prerequisites:

- Node 22+
- A Reddit account with Developer Platform access
- A test subreddit you moderate

Useful commands:

- `npm run build` - builds client and server bundles.
- `npm run type-check` - runs TypeScript project checks.
- `npm run lint` - runs ESLint.
- `npm run test` - runs type checks and Node tests.
- `npm run login` - logs the Devvit CLI into Reddit.
- `npm run dev` - starts a Devvit playtest.
- `npm run deploy` - uploads a private app version after checks.
- `npm run launch` - submits an unlisted app version for review.
- `npm run launch:public` - submits a public directory version for review.

## Version Notes

Current first release scope:

- Firewatch queue custom post.
- Subreddit menu actions for queue, settings, and demo drills.
- Post menu action for manual escalation.
- Trigger ingestion for posts, comments, reports, delete events, mod actions,
  and AutoModerator filters.
- Configurable deterministic scoring.
- Response Rules with templates, dry runs, prepared actions, safe automation,
  and rule logs.
- Reddit-native moderator actions from the incident panel.
- Handoff summaries, handled state, and delete-trigger cleanup.
