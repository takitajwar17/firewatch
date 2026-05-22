I can’t honestly promise “definitely win.” But if I had to bet on **one idea where the only real bottleneck is execution**, I would build this:

# **Firewatch: Incident Commander for Reddit Mods**

**One-line pitch:**
A Devvit app that detects when a thread is turning into a moderation “fire,” gives mods a live incident panel with context, lets one mod claim the incident, and provides one-click response actions plus an after-action summary.

This is stronger than a generic AI mod bot because it solves a real workflow problem: **mods do not just need help removing bad comments; they need help noticing, coordinating, and responding when a thread starts escalating.**

The hackathon specifically rewards tools that save moderator time, improve community operation, provide reliable UX, and have broad moderator appeal.  Devpost also says the best apps should reduce moderation load, improve community operation, or incentivize good behavior. ([mod-tools-migration.devpost.com][1])

## Why this is a winner-shaped idea

Reddit moderators already have AutoModerator, reports, modqueue, and filters. The gap is **incident handling**.

A recent study of Reddit modqueue usage found that moderators use the queue not only as a checklist, but also as an **activity radar** to detect bigger community problems. It describes mods looking for “patterns and clumps” of reports like firefighters identifying where the bigger fire is. ([arXiv][2])

The same study found that over **84%** of surveyed mods sometimes/often/almost always leave the modqueue to gather more context, such as surrounding conversation, user history, and past moderation actions. It also found that **74.5%** reported experiencing moderation collisions, where multiple mods work on the same report at the same time. ([arXiv][2])

That is the opportunity.

**Firewatch wins because it compresses three painful workflows into one Devvit-native tool:**

1. **Detection** — “Which thread is becoming dangerous?”
2. **Context** — “Why is this blowing up?”
3. **Coordination** — “Who is handling it, and what should we do?”

Devvit is a good technical fit because Reddit says Developer Platform apps support moderation tools, custom buttons, event triggers, Redis data storage, app hosting, and community-specific settings. ([Reddit Help][3])

---

# The actual product

## Core feature: Incident Radar

Firewatch watches posts and comments and assigns every active thread an **Incident Risk Score** from 0–100.

Signals:

* sudden comment velocity
* repeated keywords or phrases
* multiple users arguing in the same branch
* suspicious links/domains
* high percentage of new or low-context users, if available
* repeated reports, if accessible
* moderator manual escalation
* repeated removals in the same thread
* toxic pattern keywords configurable by the subreddit
* “pile-on” behavior: many replies targeting one user/comment

Example output:

> **Incident Risk: 82 / 100**
> Reasons: comment velocity spike, 4 matched rule terms, 3 suspicious new participants, 2 removed comments in same branch, repeated argument pattern.

This is not trying to be a perfect ML classifier. It is a **moderation smoke alarm**.

That makes it safer, easier to explain, and easier to review.

---

# The killer UX

## 1. Mod sees a menu action: **Open Firewatch**

On any post, a moderator can open Firewatch and see:

* current risk score
* why it was flagged
* top risky comments
* repeated phrases
* involved users
* newest reports/signals
* suggested response level

Response levels:

| Level    | Meaning               | Suggested action               |
| -------- | --------------------- | ------------------------------ |
| Watch    | Low risk              | No action, keep monitoring     |
| Heat     | Growing conflict      | Sticky reminder / monitor      |
| Fire     | Active escalation     | Remove cluster / warn users    |
| Wildfire | Thread out of control | Lock thread / escalate to team |

## 2. Mod can **Claim Incident**

This is the most important feature.

Button:

> **Claim this incident**

Then other mods see:

> Claimed by u/username 4 minutes ago.

This directly addresses mod collision. The research says collisions are common in modqueue work. ([arXiv][2])

## 3. One-click response playbooks

Mods choose a playbook:

### **Cool Down**

* sticky a mod comment
* optionally distinguish it
* mark incident as “monitoring”

### **Clean Up**

* show top flagged comments
* mod selects comments
* remove selected comments
* optionally leave removal reason

### **Lockdown**

* lock the thread
* sticky explanation
* mark incident resolved

### **Escalate**

* generate a summary for modmail / internal mod discussion
* include links, signals, involved users, and suggested next steps

## 4. After-action report

When resolved, Firewatch generates:

* started at
* peak risk score
* number of flagged comments
* actions taken
* claimed by
* time to resolution
* most common triggers
* final status

This is huge for judging because it proves measurable impact.

---

# Why this is better than a generic “AI Mod Assistant”

Most contestants will build one of these:

* spam detector
* AI toxicity checker
* AutoMod helper
* repost detector
* modmail autoresponder
* queue triage bot

Those are fine, but they are either common, risky, or too narrow.

**Firewatch feels like a product.**

It is not just “detect bad content.”
It is:

> “Give moderators an incident command center when their community starts catching fire.”

That is memorable. It fits the hackathon. It sounds like something Reddit would actually want in the Devvit ecosystem.

Reddit’s public Dev Platform examples already include apps like Modmail Automator, Trending Tattler, Flair Assistant, Ban Context, and Banhammer. ([Reddit for Community][4]) Firewatch is adjacent to those, but it is broader and more workflow-oriented.

---

# MVP we can build in 5 days

## Must-have MVP

Build only these:

1. **Post/comment monitoring**

   * Track active posts.
   * Store recent comments/signals in Redis.
   * Calculate risk score.

2. **Manual menu action**

   * “Open Firewatch”
   * Shows score, reasons, and top risky comments.

3. **Claim incident**

   * Redis lock: `incident:{postId}:claimedBy`
   * Show claimed/unclaimed state.

4. **Response actions**

   * Add sticky mod comment.
   * Remove selected comments.
   * Lock thread.
   * Mark resolved.

5. **After-action summary**

   * Generated text block for submission/demo.

That is enough to be a serious submission.

## Nice-to-have only if time remains

* Daily incident digest
* Settings UI for keywords/domains
* Trend graph
* Multiple severity thresholds
* Exportable mod report
* Helper mode for new moderators

---

# Technical architecture

## Devvit pieces

Use:

* **Devvit app**
* **TypeScript**
* **Reddit API**
* **Redis**
* **Menu actions**
* **Forms**
* **Event triggers**
* **Scheduler**, if needed

Reddit describes Devvit as supporting custom buttons, event triggers, Redis storage, app hosting, and community-specific settings, which are exactly what we need. ([Reddit Help][3])

## Redis model

Example keys:

```txt
config:{subreddit}
thread:{postId}:signals
thread:{postId}:comments
thread:{postId}:risk
incident:{postId}
incident:{postId}:claimedBy
incident:{postId}:actions
incident:{postId}:summary
```

## Risk score formula

Simple, explainable scoring:

```txt
risk =
  commentVelocityScore
+ keywordMatchScore
+ suspiciousLinkScore
+ repeatedPhraseScore
+ removedCommentClusterScore
+ manualEscalationScore
```

Keep it deterministic. No LLM required.

Example:

```txt
comment velocity spike: +25
3+ matched heated terms: +20
same user targeted by multiple replies: +15
2 suspicious links: +10
mod manually escalated: +30
```

Cap at 100.

## Why deterministic is better

For this deadline, deterministic scoring is better than AI because:

* easier to test
* easier to explain to judges
* lower review risk
* no external API dependency
* no hallucinated moderation decisions
* mods remain in control

---

# Demo story for Devpost

This matters a lot.

We should not demo it as a boring settings screen.

We demo a crisis:

> A normal discussion thread suddenly receives a burst of heated comments. Firewatch detects the spike, opens an incident, shows the risky branches, lets a moderator claim the issue, suggests “Cool Down” or “Lockdown,” applies the selected action, and generates an after-action summary.

That is visually strong and judge-friendly.

## Demo script

1. Show a thread with normal comments.
2. Add a burst of argumentative comments.
3. Open Firewatch.
4. Risk score jumps from 18 to 84.
5. Show matched reasons.
6. Click **Claim Incident**.
7. Select **Cool Down**.
8. App posts a distinguished moderator reminder.
9. Select two comments and remove them.
10. Mark resolved.
11. Show after-action report.

That makes the value obvious in under 90 seconds.

---

# Submission positioning

Project title:

## **Firewatch — Incident Commander for Reddit Mods**

Tagline:

> Detect thread fires early, coordinate mod response, and resolve incidents without context-switching.

Tool overview:

> Firewatch helps moderators identify and respond to rapidly escalating threads. It monitors thread-level signals like comment velocity, repeated conflict patterns, suspicious links, matched community keywords, and moderator actions. When a thread crosses a threshold, Firewatch creates an incident view that explains why the thread is risky, lets one moderator claim ownership, provides response playbooks, and generates a summary after resolution.

Project impact:

Use these communities as examples:

* large discussion communities
* gaming communities during launches/events
* sports communities during live matches
* local city communities during breaking news
* fandom communities during controversial releases
* marketplace/help communities dealing with scams

The claim:

> Firewatch reduces moderator time by helping teams detect escalation earlier, avoid duplicate work, and apply consistent response playbooks.

---

# Main risk

The main risk is **execution polish**, not idea quality.

The idea can win only if the UX feels real:

* fast
* simple
* mod-first
* no confusing setup
* clear reasons
* obvious buttons
* reliable demo

Bad execution becomes “another scoring bot.”

Good execution becomes:

> “This is the missing incident layer for Reddit moderation.”

---

# Final call

This is the idea I would choose:

## **Firewatch: Incident Commander for Reddit Mods**

Not a generic AI moderation bot.
Not a full AutoModerator replacement.
Not a ported tool.
Not a complex dashboard.

A focused Devvit-native moderation incident system:

**detect → explain → claim → act → summarize.**

If executed well, this directly hits **Community Impact, Polish, Reliable UX, and Ecosystem Impact** — the exact judging surface of the hackathon.

[1]: https://mod-tools-migration.devpost.com/ "Reddit Mod Tools and Migrated Apps Hackathon: Join Reddit to build moderation tools for the Reddit community! - Devpost"
[2]: https://arxiv.org/html/2509.07314v2 "“Think about it like you’re a firefighter”: Understanding How Reddit Moderators Use the Modqueue"
[3]: https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data "Developer Platform & Accessing Reddit Data – Reddit Help"
[4]: https://redditforcommunity.com/made-on-reddit/mod-tools "Made on Reddit | Mod Tools"
