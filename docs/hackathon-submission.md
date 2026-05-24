# Firewatch Hackathon Submission

Use this as the source of truth for the Devpost form and Reddit app listing.

## App Listing

App URL:

```text
https://developers.reddit.com/apps/firewatch17
```

Display name:

```text
Firewatch: Hot Thread Queue
```

Description:

```text
Find threads heating up. Firewatch groups reports, risky comments, and watched links into one mod queue with clear reasons, mod ownership, Reddit actions, and handoff notes.
```

Terms and privacy:

```text
Terms: https://raw.githubusercontent.com/takitajwar17/firewatch/main/TERMS.md
Privacy: https://raw.githubusercontent.com/takitajwar17/firewatch/main/PRIVACY.md
```

## Reddit Usernames

```text
u/Sorry-Highway9666
```

## Category

Best New Mod Tool.

Firewatch is not a ported Data API app.

## Tool Overview

One Reddit post can turn into 40 comments, 7 reports, and three mods opening
the same thread. Firewatch puts that thread in one queue, shows why it is
heating up, lets one mod take it, supports manual Reddit actions, and saves the
handoff notes the team needs to close the loop.

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
- Shows a moderator impact snapshot: reports grouped, comments reviewed,
  comments still waiting, users handled, mod actions taken, time open, and peak
  attention.
- Lets a mod take a post so teammates can see ownership.
- Lets mods approve acceptable comments, remove rule-breaking comments with a
  Reddit removal note, ban a user after removing their queued comments, add a
  sticky reminder, lock the post, save a handoff note, and mark the post
  handled.
- Includes a combined filter set for heated discussions, scam cleanup,
  support-safety issues, and sensitive-topic review. Mods can tune watched
  words, watched domains, and thresholds for their community.
- Keeps actions manual and auditable. Firewatch does not automatically remove,
  lock, ban, or mark handled based only on a score.
- Deletes stored post/comment content when Reddit delete triggers arrive and
  expires incident records after 30 days.
- Includes selectable demo drills for heated threads, scam-link cleanup, and
  support-safety cleanup. Each drill creates a real source post and feeds the
  same signal pipeline used by production events. Demo incidents can be reset
  from the dashboard.

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
- Makes that saved work visible through an impact snapshot that counts grouped
  reports, reviewed comments, handled users, mod actions, and time open.
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
