# Firewatch Product Spec

Firewatch is a Devvit-native moderation queue for posts that need attention.
It is built for the Reddit Mod Tools and Migrated Apps Hackathon.

## Current Product

Firewatch does these things end to end:

- Creates and reuses one subreddit-level Firewatch queue post.
- Lets mods manually send any post to Firewatch from the post menu.
- Creates demo posts that run through the same signal pipeline as real events.
- Tracks Devvit trigger events for post creates/edits, comments, reports,
  deletes, mod actions, and AutoModerator filter events.
- Scores posts with deterministic signals and displays the reasons.
- Lets one mod take ownership of a post.
- Lets mods add a sticky reminder, approve acceptable comments, remove
  rule-breaking comments with Reddit removal notes, ban a user after removing
  their queued comments, lock a post, save a handoff note, and mark the post
  handled.
- Generates copyable handoff and final notes.
- Deletes stored post or comment content when Reddit delete triggers arrive.
- Expires stored incident records after 30 days.

## Scoring Signals

The review score is calculated from:

- comment bursts in the last hour
- comment reports and post report count
- watched word matches
- watched domain matches
- reply pile-ons in the same branch
- repeated wording across comments
- recent removals from Firewatch, moderators, or AutoModerator
- manual sends from the post menu

The score is advisory. Firewatch does not automatically remove comments, lock
posts, or mark anything handled. A moderator must click the action.

## Mod Workflow

1. Open **Open Firewatch queue** from the subreddit menu.
2. Configure watched words, watched domains, and scores in **Firewatch filters**.
3. Wait for report/comment/mod-action triggers or use **Send to Firewatch** on a
   post.
4. Review the post, reasons, comments, users, repeated wording, and activity.
5. Click **Take post** if handling it.
6. Use **Sticky reminder**, **Approve**, **Remove**, **Ban user**,
   **Lock post**, **Save handoff note**, or **Mark handled** as needed.

## Platform Notes

Firewatch uses:

- Devvit Web custom posts through `submitCustomPost`
- Devvit menu actions with `UiResponse`
- Devvit forms for subreddit configuration
- Devvit triggers for Reddit event ingestion and delete cleanup
- Devvit Redis for queue state, config, and claim locks
- Devvit Reddit API methods for comments, locks, distinguishes, removals, and
  removal notes

## Limits

Firewatch is not a machine-learning classifier and does not inspect private
messages. It can only react to events and Reddit API data available to an
installed Devvit app. Scores explain review priority; moderators make the final
decision.
