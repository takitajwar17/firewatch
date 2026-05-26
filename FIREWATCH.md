# Firewatch Product Spec

Firewatch is a Devvit-native moderation queue for posts that need attention.
It is built for the Reddit Mod Tools and Migrated Apps Hackathon.

## Current Product

Firewatch does these things end to end:

- Creates and reuses one subreddit-level Firewatch queue post.
- Lets mods manually send any post to Firewatch from the post menu.
- Creates demo posts that run through the same signal pipeline as real events.
- Offers selectable demo drills for heated threads, scam-link cleanup, and
  support-safety cleanup, plus a reset control for clearing demo queue state.
- Tracks Devvit trigger events for post creates/edits, comments, reports,
  deletes, mod actions, and AutoModerator filter events.
- Rates posts from 0-5 with deterministic signals and displays the reasons.
- Shows a moderator impact snapshot with reports grouped, comments reviewed,
  users resolved, actions taken, and time open.
- Lets one mod take ownership of a post.
- Lets mods add a sticky reminder, approve acceptable comments, remove
  rule-breaking comments with Reddit removal notes, ban a user after removing
  their queued comments, lock a post, save a handoff note, and mark the post
  resolved.
- Provides one combined filter set for heated discussions, scam cleanup,
  support-safety issues, and sensitive-topic review.
- Generates copyable handoff and final notes.
- Deletes stored post or comment content when Reddit delete triggers arrive.
- Expires stored incident records after 30 days.

## Rating Signals

The Firewatch rating is shown as 0-5 stars. It is calculated from an internal
signal score built from:

- comment bursts in the last hour
- comment reports and post report count
- watched word matches
- watched domain matches
- reply pile-ons in the same branch
- repeated wording across comments
- recent removals from Firewatch, moderators, or AutoModerator
- manual sends from the post menu

The rating is advisory. Firewatch does not automatically remove comments, lock
posts, or mark anything resolved. A moderator must click the action.

## Mod Workflow

1. Open **Open Firewatch queue** from the subreddit menu.
2. Configure watched words, watched domains, and ratings in **Firewatch filters**.
3. Wait for report/comment/mod-action triggers or use **Send to Firewatch** on a
   post.
4. Use **Create demo** to run a judge or mod training drill if needed.
5. Review the post, reasons, impact snapshot, comments, users, repeated wording,
   and activity.
6. Click **Take post** if handling it.
7. Use **Sticky reminder**, **Approve**, **Remove**, **Ban user**,
   **Lock post**, **Save handoff note**, or **Mark resolved** as needed.

## Platform Notes

Firewatch uses:

- Devvit Web custom posts through `submitCustomPost`
- Devvit menu actions with `UiResponse`
- Devvit forms for subreddit configuration
- Devvit triggers for Reddit event ingestion and delete cleanup
- Devvit Redis for queue state, config, and claim locks
- Devvit Reddit API methods for comments, locks, distinguishes, removals, and
  removal notes

## Permission Model

- All Firewatch menu items are registered with `forUserType: "moderator"`.
- The review queue is shown only to mods who can manage posts and comments.
  Reddit calls this `posts`, or `all` for full mod access.
- Settings, automations, demo reset, and full app reset are available only to
  mods who can change subreddit settings. Reddit calls this `config`, or `all`
  for full mod access.
- Post and comment actions are available only to mods who can manage posts and
  comments.
- User actions, including bans, mutes, mod notes, and Firewatch strikes, are
  available only to mods who can manage users. Reddit calls this `access`, or
  `all` for full mod access. User-content cleanup also requires post and
  comment moderation access.
- Flair actions are available only to mods who can manage both posts and post
  flair. Reddit calls these `posts` and `flair`, or `all`.
- Mods who cannot change subreddit settings do not receive watched lists, rating
  thresholds, automation rules, or automation logs in the webview payload.
- Mods who cannot manage post flair do not receive post flair templates or run
  flair actions.
- Anyone without enough mod access sees an access screen rather than Firewatch
  incident data.

## Limits

Firewatch is not a machine-learning classifier and does not inspect private
messages. It can only react to events and Reddit API data available to an
installed Devvit app. Ratings explain review priority; moderators make the final
decision.
