# Firewatch: Incident Room for Reddit Mod

One Reddit post can turn into 420 comments, 69 reports, and three mods opening
the same thread. Firewatch turns that into a shared **incident room**: one queue
item, clear reasons it needs attention, one mod claiming ownership, and a
visible action log.

Firewatch is built for posts that need more than a single approve/remove click:
scam domains, heated arguments, support-safety cleanup, repeated wording, report
spikes, AutoModerator filters, and threads where the mod team needs shared
context before acting.

Firewatch is an **open source** project released under the **MIT License**—built
for the community to use, fork, and enhance to fit each subreddit’s needs.
Repository: [github.com/takitajwar17/firewatch](https://github.com/takitajwar17/firewatch).

## What Firewatch Does

- Creates a **subreddit-level Firewatch board post** that acts as the shared mod queue.
- Adds posts to the queue when they’re **sent manually** from a post menu item, or when
  triggers detect signals like **reports**, **AutoModerator filters**, **watched words**,
  **watched domains**, **comment activity**, and **mod actions**.
- Shows a simple **0–5 attention rating** and plain-English reasons (so a mod can triage fast).
- Uses a **claim workflow** so the team can see who’s handling an incident (and avoid duplicate work).
- Keeps **Reddit-native moderation actions** close to the evidence (approve/remove/spam, lock/unlock,
  ignore reports, crowd control, flair, user actions like mute/ban, and more—permission gated).
- Supports configurable **Automations / Response Rules** that can suggest actions, prepare them for
  approval, or run selected actions when explicitly enabled.
- Includes **demo drills** to seed realistic incidents for playtesting in a sandbox subreddit.
- Removes stored post/comment content when Reddit sends delete triggers.

## How Moderators Use It

1. Install Firewatch in a subreddit you moderate.
2. Open the subreddit menu and choose **Open Firewatch**.
3. Open **Firewatch settings** to tune watched words, watched domains, rating
   thresholds, reminder text, signal weights, and available mod actions.
4. Let Firewatch queue matching activity from triggers, or choose **Send to
   Firewatch** from a post menu when a thread needs attention.
5. Review the Firewatch rating, visible reasons, impact snapshot, comments, users,
   activity, mod notes, and matched automations.
6. Claim the post, approve acceptable comments, remove rule-breaking comments,
   lock the thread, run prepared automation actions, or save a handoff note.
7. Mark the incident resolved once the queue item no longer needs active review.

## Automations

Firewatch Automations watch posts, comments, reports, incident ratings, and user
strike counts. An automation can:

- Suggest actions without running them.
- Prepare actions for a moderator to review and run.
- Auto-run safe Firewatch-only actions while leaving Reddit-native actions for
  moderator approval.
- Auto-run all selected actions when a mod team deliberately enables that mode
  for a trusted rule. Reddit-native auto-run actions still require the post to
  be claimed, and Firewatch records the claimant as the responsible actor.

Automations are transparent: each match records why it matched, which actions
were prepared, which actions ran, and which actions were skipped. Moderators
should test automations in a sandbox subreddit before enabling automatic
actions in an active community.

## Moderator Control

Firewatch ratings are advisory. The app explains its reasons, but moderators
remain responsible for reviewing context, applying community rules, and deciding
whether to approve, remove, lock, ban, mute, flair, ignore reports, or take any
other action. Firewatch is designed to reduce queue work, not replace moderator
judgment.

## Moderator Permissions

Firewatch is a moderator-only app. All menu items are registered with
`forUserType: "moderator"`, and the server also checks the current moderator's
subreddit permissions before returning mod data or accepting actions.

- To open the review queue, a moderator must be allowed to manage posts and
  comments. Reddit calls this `posts`, or `all` for full mod access.
- To change Firewatch settings, automations, demo data, or reset app data, a
  moderator must be allowed to change subreddit settings. Reddit calls this
  `config`, or `all` for full mod access.
- To ban, mute, approve users, add mod notes, clear Firewatch strikes, or clean
  up a user's recent content, a moderator must be allowed to manage users.
  Reddit calls this `access`, or `all` for full mod access. User-content cleanup
  also needs post and comment moderation access.
- To set or clear post flair, a moderator must be allowed to manage both posts
  and post flair. Reddit calls these `posts` and `flair`, or `all` for full mod
  access.
- Moderators who cannot change subreddit settings do not receive watched lists,
  rating thresholds, automation rules, or automation logs in the webview payload.
  They can still see the review data, available action controls, and reminder
  text needed for post moderation.
- Moderators who cannot manage post flair do not receive post flair templates or
  run flair actions.

If someone without enough mod access opens Firewatch, the app shows a plain
access screen instead of loading private queue, settings, automation, or action
data.

## Data And Privacy

Firewatch stores only the data needed to run the moderation workflow for
installed communities: incident state, public Reddit identifiers, public content
excerpts needed for review, moderator settings, automation logs, action
history, user strike summaries, and handoff notes. Incident, claim, and
automation log records expire after 30 days. Per-moderator selected incident
state expires after 24 hours. Community configuration, automations, user strike
summaries, and the Firewatch queue post reference do not have an app-set expiry
and remain until changed, cleared, reset by app logic, or removed by platform
storage behavior.

Firewatch is a deterministic signal queue, not a complete abuse detector. It
handles common watched-word, watched-domain, report, repeated wording, and
reply-cluster patterns, including simple domain obfuscation, but moderators
should still review context and tune community-specific rules.

See [Privacy Policy](https://raw.githubusercontent.com/takitajwar17/firewatch/main/PRIVACY.md) and [Terms of Service](https://raw.githubusercontent.com/takitajwar17/firewatch/main/TERMS.md) for the full policy text.