# Firewatch Hackathon Submission

Use this as the source of truth for the Devpost form and Reddit app listing.

## App Listing

App URL:

```text
https://developers.reddit.com/apps/firewatch17
```

Display name:

```text
Firewatch
```

Description:

```text
Incident command for Reddit mods: detect escalating posts, review explainable signals, coordinate ownership, approve or remove comments, ban users, lock posts, and save handoff notes.
```

Terms and privacy:

```text
Use public hosted URLs for TERMS.md and PRIVACY.md before submitting. GitHub raw URLs, a published docs page, or another stable public URL will work.
```

## Reddit Usernames

```text
u/Sorry-Highway9666
```

## Category

Best New Mod Tool.

Firewatch is not a ported Data API app.

## Tool Overview

Firewatch is an incident-command dashboard for Reddit moderators. It watches
for posts that are likely to need team attention, explains exactly why the post
is in review, lets one mod take ownership, supports manual moderation actions,
and generates handoff and final notes so the team can close the loop.

Capabilities:

- Creates a subreddit-level Firewatch queue post when the app is installed.
- Lets mods send any post to Firewatch from the post menu.
- Ingests post creates, post edits, new comments, comment reports, post reports,
  AutoModerator filter events, mod actions, and delete events through Devvit
  triggers.
- Scores incidents with deterministic, explainable signals: comment velocity,
  reports, watched words, watched domains, repeated wording across user
  comments, reply pile-ons, recent removals, and manual mod sends.
- Excludes Firewatch notices and mod-generated comments from repeated wording
  and user scoring so the app does not inflate its own incidents.
- Shows current attention, peak score, queue reasons, comment review items,
  users in review, repeated wording, recent activity, trend, suggested action,
  and mod log.
- Lets a mod take a post so teammates can see ownership.
- Lets mods approve acceptable comments, remove rule-breaking comments with a
  Reddit removal note, ban a user after removing their queued comments, add a
  sticky reminder, lock the post, save a handoff note, and mark the post
  handled.
- Keeps actions manual and auditable. Firewatch does not automatically remove,
  lock, ban, or mark handled based only on a score.
- Deletes stored post/comment content when Reddit delete triggers arrive and
  expires incident records after 30 days.
- Includes a demo incident generator that creates a real source post and feeds
  the same signal pipeline used by production events.

## Project Impact

Firewatch is useful for communities where a single thread can become expensive
for moderators faster than the normal mod queue explains why.

Example communities:

- `r/technology`: link-heavy discussions can attract repeated talking points,
  suspicious domains, and fast argument branches.
- `r/NoStupidQuestions`: high-volume posts can accumulate many reports and
  repeated phrases before a mod has enough context.
- `r/techsupport`: support threads benefit from fast review of scam links,
  unsafe advice, and users who repeatedly post harmful comments.

Moderator benefit:

- Saves time by grouping post-level signals into one incident instead of making
  mods inspect reports, comments, mod log events, and context separately.
- Reduces duplicated work by showing who has taken a post.
- Improves consistency by turning comments into clear decisions: approve,
  remove, or ban after cleanup.
- Improves handoff quality by producing copyable notes with reasons, users,
  actions, and closeout status.

## Developer Platform Feedback

Useful feedback to submit for the optional prize:

- Devvit Web is strong for building real moderator tools because the app can
  combine custom post UI, menu actions, triggers, Redis, and Reddit API actions
  in one hosted package.
- The biggest rough edge during development was CLI/network reliability. In
  this environment, `devvit playtest` needed a network patch to work reliably
  with Reddit edge hosts.
- The app listing flow would benefit from clearer required metadata guidance
  earlier in the CLI wizard, especially privacy policy and terms URL
  requirements.
- More Devvit Web examples for moderator workflows would help: comment
  approval/removal, ban flows, claim locks, and deletion cleanup.

