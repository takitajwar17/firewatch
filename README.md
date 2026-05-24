# Firewatch: Hot Thread Queue

One Reddit post can turn into 40 comments, 7 reports, and three mods opening
the same thread. Firewatch puts that thread in one queue, shows why it is
heating up, lets one mod take it, and keeps the cleanup trail in one place.

Firewatch is built for posts that need more than a single approve/remove click:
scam links, heated arguments, support-safety cleanup, repeated wording, report
spikes, AutoModerator filters, and threads where the mod team needs shared
context before acting.

## What Firewatch Does

- Creates a subreddit-level queue post for moderators.
- Sends a post to Firewatch from the post menu, or queues it from reports,
  watched words, watched domains, comment bursts, repeated user wording,
  AutoModerator filters, and mod actions.
- Shows the reasons in plain Reddit terms: reports, comments waiting for a mod
  decision, users in review, reply clusters, watched words, watched domains,
  repeated phrases, and recent activity.
- Lets one moderator take the thread so the team can see who is handling it.
- Keeps Reddit-native controls close to the evidence: approve comments, remove
  comments with a removal note, ban a user after cleanup, lock or unlock posts,
  set flair, mark NSFW or spoiler, ignore reports, add mod notes, mute users,
  approve users, and remove recent user content.
- Runs Automations as visible playbooks for scam cleanup, repeated offenders,
  heated thread cooldowns, and lock recommendations.
- Saves handoff notes and final notes with the reasons, users, actions, and
  remaining review work.
- Excludes moderator comments, AutoModerator, and Firewatch notices from user
  wording scores so the app does not score its own cleanup comments.
- Includes demo drills that create a real source post and feed the same signal
  pipeline used by production events.
- Deletes stored post or comment content when Reddit delete triggers arrive.

## How Moderators Use It

1. Install Firewatch in a subreddit you moderate.
2. Open the subreddit menu and choose **Open Firewatch queue**.
3. Open **Firewatch settings** to tune watched words, watched domains, score
   thresholds, reminder text, signal weights, and available mod actions.
4. Let Firewatch queue matching activity from triggers, or choose **Send to
   Firewatch** from a post menu when a thread needs attention.
5. Review the score, visible reasons, impact snapshot, comments, users,
   activity, mod notes, and matched automations.
6. Take ownership, approve acceptable comments, remove rule-breaking comments,
   lock the thread, run prepared automation actions, or save a handoff note.
7. Mark the incident handled once the queue item no longer needs active review.

## Automations

Firewatch Automations watch posts, comments, reports, incident scores, and user
strike counts. An automation can:

- Suggest actions without running them.
- Prepare actions for a moderator to review and run.
- Auto-run safe Firewatch-only actions while leaving Reddit-native actions for
  moderator approval.
- Auto-run all selected actions when a mod team deliberately enables that mode
  for a trusted rule.

Automations are transparent: each match records why it matched, which actions
were prepared, which actions ran, and which actions were skipped. Moderators
should test automations in a sandbox subreddit before enabling automatic
actions in an active community.

## Moderator Control

Firewatch scores are advisory. The app explains its reasons, but moderators
remain responsible for reviewing context, applying community rules, and deciding
whether to approve, remove, lock, ban, mute, flair, ignore reports, or take any
other action. Firewatch is designed to reduce queue work, not replace moderator
judgment.

## Data And Privacy

Firewatch stores only the data needed to run the moderation workflow for
installed communities: incident state, public Reddit identifiers, public content
excerpts needed for review, moderator settings, automation logs, action
history, user strike summaries, and handoff notes. Incident, claim, automation
log, automation, and user strike records expire after 30 days. Per-moderator
selected incident state expires after 24 hours. Community configuration and the
Firewatch queue post reference do not have an app-set expiry and remain until
changed, deleted by app logic, or removed by platform storage behavior.

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
- Automations with templates, dry runs, prepared actions, safe automation,
  and automation logs.
- Reddit-native moderator actions from the incident panel.
- Handoff summaries, handled state, and delete-trigger cleanup.
