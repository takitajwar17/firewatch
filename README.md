# Firewatch

Firewatch is a Devvit mod queue for Reddit moderators. It helps mod teams spot
posts that need review, understand why they were queued, coordinate ownership,
take common moderation actions, and save handoff/final notes.

## What It Does

- Scores posts with deterministic, explainable signals.
- Tracks matching post creates/edits, new comments, comment reports, post
  reports, watched words, watched domains, repeated wording, reply pile-ons,
  moderator sends, moderator removal actions, and AutoModerator filter events.
- Shows queued posts with review score, top reasons, comments to review,
  repeated wording, involved users, recent activity, suggested next step, trend,
  and action history.
- Lets one moderator take a post so other mods can see who is handling it.
- Lets moderators add a sticky reminder, remove selected comments with a Reddit
  removal note, lock the post, save a handoff note, and mark the post handled.
- Includes a demo post creator that makes a real source post and populates the
  queue through the same signal pipeline used by production events.
- Removes stored post/comment content when Reddit delete triggers are received.

## Moderator Workflow

1. Open the subreddit menu and choose **Open Firewatch queue**.
2. Use **Firewatch filters** to tune watched words, watched domains, and review
   scores for the community.
3. Use **Create Firewatch demo post** or the dashboard button to create a test
   post.
4. On any post, choose **Send to Firewatch** to put that post in the queue.
5. Review the score and reasons, take the post, and choose the needed action.
6. Use **Save handoff note** or **Mark handled** when the mod team needs a note.

## Signals

Firewatch is deterministic. It does not make hidden AI moderation decisions or
automatically remove, lock, or punish users based on a score. Moderators stay in
control and every score is explained by visible reasons.

## Privacy And Data

Firewatch stores queue state for installed communities, including post IDs,
comment IDs, public usernames, public comment excerpts, configured filters,
moderator actions taken through the app, and generated notes. This data is used
only to show moderation workflow state inside the app. Stored incident records
expire after 30 days and are also cleaned when Reddit delete events arrive.

## Hackathon Positioning

Firewatch is built for the Reddit Mod Tools and Migrated Apps Hackathon in the
New Mod Tool category. The goal is to reduce mod load during fast-moving posts
by compressing detection, context gathering, ownership, action, and handoff into
one Devvit-native workflow.
