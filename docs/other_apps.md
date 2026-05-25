## 1. RecidivWatch — Repeat Offender Tracker for Reddit
Automatically track repeat rule-breakers and alert your mod team before they cause more damage.

Reddit's built-in tools let mods remove individual posts and comments — but they have no memory. AutoModerator can't track patterns over time. Every time a user reoffends, mods have to manually dig through their history to figure out if this is the third or the tenth violation.

RecidivWatch fixes this. It runs silently in the background, counting every mod removal per user and sending instant modmail alerts when someone hits your warning, temp ban, or permanent ban thresholds — complete with their full violation history and a direct ban link.

### Features
Automatic violation tracking
Every post and comment removed by a moderator is recorded against the author's profile. RecidivWatch stores the content preview, timestamp, content ID, and which mod took the action.

Three-tier alert system
Alerts escalate automatically based on configurable thresholds:

Level	Default trigger	Action
⚠️ Warning	3 removals in 7 days	Modmail alert sent
🚫 Temp Ban	5 removals in 7 days	Modmail with ban link
⛔ Perm Ban	3 temp ban alerts triggered	Modmail with ban link
Each alert includes the user's full violation history, recent violations, removal timestamps, content previews, and a direct link to ban the user.

Smart alert logic
Cooldown: Alerts won't repeat within 24 hours for the same user at the same level — no spamming your mod team on every removal
Escalation memory: Once a warning is sent, it won't fire again. The next alert jumps straight to temp ban
Perm ban based on repeat offending: Permanent ban is recommended after a user has triggered 3 temp ban alerts — not just a raw removal count. Users who space out violations still get escalated eventually
Deduplication: The same content removal can't be counted twice even if multiple events fire
Right-click mod menu
Available on every post and comment for moderators:

🔍 View User History — sends a full violation report to modmail instantly
🔄 Reset User Record — clears a user's entire record (for reformed users or false positives)
Optional auto temp-ban
Disabled by default. When enabled, RecidivWatch will automatically execute the temp ban instead of just recommending it. Mods still receive the modmail alert either way.

Trusted flair exemptions
Users with specific flair texts (e.g. Moderator, Verified, Contributor) can be excluded from tracking entirely.

Bot detection
Accounts ending in Bot or _bot (case-insensitive) are automatically skipped.

### How alerts work
⚠️ Warning modmail
Subject: ⚠️ RecidivWatch WARNING — u/username (3 removals in 7d)

User: u/username
Recent removals: 3 in the past 7 days
All-time removals: 3
Temp bans triggered: 0

This user has reached the warning threshold (3 removals).
No automated action has been taken. Mods may review and act at their discretion.

Recent Violations (last 7 days: 3)
1. [POST] Sat, 10 May 2026 08:00:00 GMT
   Content: "post title here"
   ID: t3_xxxxxx | Mod: u/modname
...
🚫 Temp ban modmail
Subject: 🚫 RecidivWatch TEMP BAN — u/username (5 removals in 7d)

User: u/username
Recent removals: 5 in the past 7 days
All-time removals: 5
Temp bans triggered: 1

A temporary ban of 3 day(s) is recommended.
Action: [Ban u/username](https://www.reddit.com/r/yoursubreddit/about/banned)
...
⛔ Perm ban modmail
Subject: ⛔ RecidivWatch PERM BAN — u/username (3 temp bans)

User: u/username
All-time removals: 15
Temp bans triggered: 3

This user has been temp banned 3 times, reaching the permanent ban threshold.
Action: [Ban u/username](https://www.reddit.com/r/yoursubreddit/about/banned)

This alert will not be sent again.
...
### Configuration
All settings are configurable per subreddit under Mod Tools → Settings → Installed Apps → RecidivWatch.

Setting	Default	Description
Warning Threshold	3	Removals in the lookback window to trigger a warning
Temp Ban Threshold	5	Removals in the lookback window to trigger a temp ban alert
Perm Ban Threshold	3	Number of temp ban alerts before a perm ban is recommended
Lookback Window (Days)	7	Rolling window for counting recent violations
Temp Ban Duration (Days)	3	Suggested ban duration shown in modmail
Alert Cooldown (Hours)	24	Minimum hours between alerts for the same user at the same level
Auto Temp-Ban	Off	Automatically execute temp bans instead of just recommending
Trusted Flair Texts	(empty)	Comma-separated flair texts exempt from tracking

## 2. Drama Radar
Catch high-conflict Reddit threads before reports pile up.

Drama Radar is a Reddit Devvit moderation tool that scores active threads for escalation risk using transparent community signals. It is designed to help moderators know where to look early, not to automatically punish users.

### What It Does
Monitors active posts and comments through Devvit triggers and a scheduled radar scan.
Scores each thread with explainable signals: comment velocity, deep reply chains, argument loops, rule keyword matches, activity spikes, tourist surge, and report count when available.
Shows a polished mod incident room with hottest threads, risk scores, reasons, and human-controlled suggested actions.
Includes a limited three-state demo so judges can inspect calm, heating, and high-risk states without the page moving around.
Lets moderators queue suggested actions, inspect a selected thread, copy a neutral rule reminder, and review an in-demo action history.
Seeds fake subreddit incidents on install so the app is immediately demoable.
### Why It Matters
Moderators usually discover bad threads after users report them. Drama Radar helps mods intervene earlier with lighter-touch actions like watching a thread, pinning a neutral reminder, or escalating to human review.

Most AI moderation tools classify individual comments. Drama Radar analyzes thread dynamics.

### Human In Control
Drama Radar does not auto-ban, auto-remove, or auto-lock by default.

Suggested actions include:

Watch thread
Pin rule reminder
Lock thread
Enable slow mode if supported by the community workflow
Escalate to human review
The product stance is simple: Drama Radar does not moderate. It points.

### Launch-Ready Notes
Drama Radar is built as a concept-complete moderation app, not just a static mockup.

Shared scoring logic is used by both the Devvit server and the web dashboard.
Moderator actions are validated server-side before being logged.
The dashboard shows whether an action synced to Devvit or is running in local demo mode.
Demo mode is seeded on install so moderators and judges always see a complete incident flow.
Edge cases such as empty threads and malformed stored Redis data are handled safely.
The risk model has automated tests for calm threads, high-risk incidents, demo escalation, seeded demos, and supported action validation.
### Demo Flow
Use the moderator subreddit menu item: Open Drama Radar.
Open the custom post dashboard.
Use Demo step 1/3 to switch between calm, heating, and high-risk seeded states.
Review the exact signals that triggered the alert.
Click a suggested action and show the action queue.
Copy the neutral rule reminder from the selected-thread inspector.
This fits a 2-minute judging demo because the seeded dashboard already contains hot threads and the demo is limited to three clear states.

## 3. DesiMode AI
Advanced AI Moderation System for Reddit Communities

DesiMode AI is a production-grade Reddit moderation tool built for South Asian communities. It is designed to detect toxicity, scams, and spam in multilingual and mixed-language content including English, Bangla, Hindi, and Romanized variations (Hinglish/Banglish).

It helps moderators automatically handle harmful content while maintaining transparency, control, and escalation workflows.

### Core Features
🧠 AI-Powered Moderation
Detects toxicity, harassment, spam, and scam content
Supports English, Bangla, Hindi, Hinglish, and Banglish
Uses contextual understanding for slang, leetspeak, and transliteration
🤖 Gemini AI Engine
Powered by Gemini 3.1 Flash Lite
Provides reasoning-based classification (safe / toxic / scam)
Generates confidence scores and human-readable explanations
⚡ Automated 3-Strike System
Strike 1–2
Post/comment removal
Warning DM sent to user
ModNote logged
Violation recorded in Redis history (type, reason, link, timestamp)
Strike 3
Post/comment removal
Detailed ModMail sent to moderators for manual review
No auto-ban (fully Reddit policy compliant)
📊 Moderator Dashboard
Accessible from the subreddit mod menu → Open DesiMod Dashboard
Near real-time updates via Devvit Realtime + lightweight polling (no socket.io)
Stats: toxic removals, scam flags, warnings, modmail escalations, estimated time saved
🔐 Moderator-Only Access
Dashboard visible only to subreddit moderators
Server-side checks (getModerators, getCurrentUser)
Dashboard post is mod-removed from the public feed when possible
📩 Automated Escalation System (Strike 3 ModMail)
When a user reaches 3 strikes, moderators receive a structured ModMail that includes:

Section	What mods see
User summary	Username, subreddit, total strike count
Current violation	Type (toxicity vs scam), post/comment, AI reason, confidence %, permalink
Violation history	Table of all recorded strikes with type, content kind, confidence, UTC time, and links
Summary counts	How many toxicity vs scam events appear in history
Example subject line:

3-Strike: u/username — Scam / spam (3 strikes)

Note: Violation history is stored from the time this feature is deployed. Earlier strikes before an upgrade may not appear in the history table until new violations are logged.

## 4. xcancel-bot
A Reddit Devvit app (registered as xcancel-linker on Reddit) that replies to new posts and comments containing x.com / twitter.com / mobile.twitter.com links with the equivalent xcancel.com mirror URLs, so users without an X account (or who prefer not to open X) can read the linked content.

### What it does
When a moderator installs the app on a subreddit, the app watches new post and comment submissions. For every Twitter-family URL it finds, it posts a reply containing the equivalent xcancel.com/<path> mirror. URLs that already have their xcancel mirror present in the same post/comment are skipped, so no spammy duplicate mirrors.

## 5. RaidPulse — Real-Time Raid Detection for Reddit
RaidPulse is a real-time threat intelligence system built on Reddit's Devvit platform. It detects coordinated raids before moderators notice — then protects your community automatically.

### What It Does
RaidPulse monitors every post, comment, and report in real time across five simultaneous detection layers:

Activity Velocity — detects posting spikes vs a rolling community baseline
Coordinated Messaging — identifies repeated hostile phrases across comments
New Account Surge — tracks account ages in real time (raids use new accounts)
Toxicity Detection — regex-based pattern matching across hate, harassment, spam, and brigade language
Report Spike — tracks mod queue reports per hour
When multiple signals fire, RaidPulse calculates a community health score and auto-activates Protection Mode — restricting posting, pinning a warning post, and alerting the mod team via ModMail.

### Key Features
Zero configuration — install and it works immediately
Adaptive baseline — learns each subreddit's normal traffic pattern
Raid simulator — built-in demo tool for testing detection
Threat timeline — chronological incident reconstruction
Resolved incidents history — tracks past attacks and time saved
Configurable sensitivity — Low / Normal / High / Strict

## 6. ModTrials
Private clinical trials for subreddit rules.

ModTrials is a Reddit Devvit app that helps moderators test new rules before those rules affect users. It runs proposed rules in shadow mode, collects moderator feedback on real posts and comments, and shows whether a rule is safe enough to launch.

The product is built around one idea:

Test rules before they punish users.

### What It Does
Moderators can start a private rule trial directly from Reddit:

Use a post or comment menu action: ModTrials: trial privately
Ask why an item matched: ModTrials: why privately
Get an aggregate report: ModTrials: private report
Use bot commands such as u/modtrials trial this --dm
ModTrials then:

Reads the selected Reddit post or comment.
Creates a shadow rule trial.
Records why the item matched.
Sends the moderator a private DM result.
Lets moderators mark examples as good catches, false positives, or gray-area cases.
Computes launch readiness from real trial evidence.
### Why Mods Need It
Moderation rules often fail in the gray area. A rule that catches obvious spam can also catch a sourced discussion post, a new user's good-faith question, or a legitimate builder showcase.

ModTrials gives teams evidence before enforcement:

Does this rule catch the bad content?
Does it also catch good content?
Should this rule launch as auto-remove, hold-for-review, repair-first, or be rewritten?
### Primary Workflow
A moderator finds a real post or comment.
The moderator runs ModTrials: trial privately.
ModTrials sends a private DM explaining the match.
The moderator labels the result as useful, false positive, or gray area.
The readiness card shows whether the rule is safe to launch.
Bot command equivalent:

u/modtrials trial this --dm
u/modtrials why --dm
u/modtrials report --dm
Command comments are processed, then removed to keep the thread clean.

### Demo Scenario
A realistic test is a community that discusses ASI, AI safety, and research links.

Positive example:

A sourced ASI discussion post with external links and a real question.
It may match a broad link rule, but a moderator can mark it as a false positive.
Negative example:

A short promotional comment such as "buy my report", "subscribe", or "discount".
It should be marked as a good ModTrials catch.
This demonstrates the core value: the same rule can catch spam and risk catching good discussion. ModTrials makes that visible before enforcement.

## 7. Community Playground
A pack of interactive post types for your community in a single Devvit app. Install once, then add polls, predictions, brackets, trivia, bingo, memes, showcases, and a customizable pinned post from the mod menu.

### Settings
Each community keeps its own settings. Open "Edit settings" from the moderator menu to adjust them. Settings persist across app updates.

## 8. ModSandbox
AutoMod Rule Tester for Reddit Moderators
Test before you wreck. Deploy with confidence.

### The Problem
Every moderator knows this feeling: you write an AutoMod rule, paste it live, and then spend the next two hours manually restoring posts it incorrectly removed — or realising it missed every piece of spam it was supposed to catch.

There has never been a safe way to test AutoMod rules before deploying them.

Until now.

### The Solution
ModSandbox is a native Reddit app (built on Devvit) that lets moderators paste any AutoMod YAML rule and instantly test it against their subreddit's real recent posts — before a single live action is taken.

Paste rule → Run test → See highlights → Deploy with confidence
### How It Works
flowchart LR
    A([Mod opens\nModSandbox]) --> B[Paste AutoMod\nYAML rule]
    B --> C{Rule valid?}
    C -- No --> D[Show parse\nerror inline]
    C -- Yes --> E[Fetch last\n100 posts via\nReddit API]
    E --> F[Run rule against\neach post locally]
    F --> G[Build match\nresults + highlights]
    G --> H([Show metrics\n+ visual diff])
    D --> B

### Features
Feature	Description
📝 Rule Editor	Paste any AutoMod YAML rule with real-time syntax feedback
🔍 Live Testing	Tests against the last 100 real posts from your subreddit
🟠 Visual Diff	Triggering text highlighted inline in every match card
📊 Match Metrics	Posts tested · Total matches · Match rate — instantly
⚠️ False Positive Detection	Spot overly aggressive rules before they go live
💾 Rule Saving	Save draft rules to Devvit Redis, persisted between sessions
🌙 Dark Mode	Fully supports Reddit's dark and light themes
🔒 Zero Data Collection	No user data ever leaves Reddit's platform
Supported Rule Syntax
graph LR
    Rule[AutoMod Rule] --> F1["title (contains)"]
    Rule --> F2["title (regex)"]
    Rule --> F3["body (contains)"]
    Rule --> F4["body (regex)"]
    Rule --> F5["author"]
    Rule --> F6["domain"]
    Rule --> A["action:\nremove / report\napprove / filter"]
    Rule --> R["action_reason"]

    style Rule fill:#FF4500,color:#fff,stroke:none
    style A fill:#1a1a1b,color:#FF4500,stroke:#FF4500
Example Rule
type: submission
title (contains): [free money, click here, limited offer, 100% guaranteed]
action: remove
action_reason: Possible spam — matched ModSandbox spam filter test
Paste this into ModSandbox → hit Run Test → see every post from your subreddit that would have been removed, with the matching phrase highlighted in orange.

Impact
xychart-beta
    title "Moderator Time Saved Per Bad Rule Deployment"
    x-axis ["Manual cleanup", "User complaints", "Rule rewrite", "With ModSandbox"]
    y-axis "Hours spent" 0 --> 5
    bar [3.5, 1.5, 0.5, 0]
pie title Where Mod Time Goes Without Rule Testing
    "Reviewing false positive removals" : 38
    "Responding to user complaints" : 27
    "Rewriting broken rules" : 21
    "Actual moderation" : 14

## 9. SubNotify
Ping subscribers when your recurring threads go live — weekly megathreads, monthly discussions, announcement posts, and anything else you run on a schedule.

Users opt in with a comment. When a new post matches your rules (flair or title), SubNotify comments on that post and tags everyone who subscribed — in small batches so Reddit doesn’t drop pings.

What members type
Command	What it does
!subscribe	Subscribe to your default category (usually general)
!subscribe movies	Subscribe to the movies category
!unsubscribe	Unsubscribe from the default category
!unsubscribe movies	Leave the movies category
!unsubscribe all	Remove every subscription in your sub
!list	See what you’re subscribed to
!help	Show the command list
The bot replies under their comment. Subscriptions are only for your subreddit — not account-wide.

Settings (plain English)
Setting	What to put
Enable notifications	On = bot works. Off = commands still work, but no auto-pings.
Default category name	Short name used when someone types !subscribe with nothing else. Example: general
Notification rules (JSON)	Your categories and what posts trigger each one. See below.
Max users tagged per comment	Keep at 25. Reddit ignores extra tags if you go too high.
Cooldown per category (minutes)	Minimum time between two pings for the same category. 60 is a good default.
Command prefix	Usually ! — the character before subscribe, help, etc.
### How categories work
Think of a category as a bucket of subscribers + a rule for which posts ping them.

Each category has:

name — Short ID (lowercase, no spaces). Users subscribe with !subscribe monthly.
flairs — Post flairs that trigger this category. Must match exactly (not case-sensitive). Example: "Weekly Thread".
keywords — Words/phrases in the post title. If any keyword appears in the title, it triggers. Example: "weekly discussion".
A post triggers a category if either the flair matches or a keyword appears in the title.

A category with empty flairs and empty keywords does nothing (safety guard — it won’t ping on every post).

Sample setup (copy-paste)
Use this as a starting point. Change names, flairs, and keywords to match your sub.

[
  {
    "name": "general",
    "flairs": [],
    "keywords": ["weekly thread", "megathread"]
  },
  {
    "name": "monthly",
    "flairs": ["Monthly Discussion"],
    "keywords": ["monthly discussion", "monthly mega-thread"]
  },
  {
    "name": "movies",
    "flairs": ["Weekly Movies"],
    "keywords": ["movies of the week"]
  }
]
Example: A mod posts “Monthly Discussion — May 2026” with flair Monthly Discussion. Everyone who ran !subscribe monthly gets tagged in a comment on that post.

Mod tools (⋯ menu)
Action	Where	What it does
SubNotify: Stats	Subreddit menu	How many subscribers per category
SubNotify: Notify subscribers of this post	Post menu	Manually ping subscribers for this post (if it matches a rule). Skips cooldown.
Example flow
You add the JSON above and set default category to general.
A user comments !subscribe monthly on your welcome post.
Next month you publish a post with flair Monthly Discussion.
SubNotify comments: “New post for monthly subscribers” and tags u/user1 u/user2 … (up to 25 per comment; more subscribers = more comments).
### Tips
Pin a post: “Comment !subscribe to get notified for weekly threads. !help for all commands.”
Test with a post title that includes one of your keywords before going live.
If pings feel spammy, raise Cooldown or narrow your keywords/flairs.
Bot account: u/subnotify-app (or your app’s slug). Questions or bugs: contact the app developer via the listing page.

## 10. WholesomeShield
WholesomeShield is a Devvit moderation app for family-friendly Reddit communities. It removes high-confidence NSFW, adult promotional, spam, unsafe, or suspicious content without using karma limits or account-age limits.

### Behavior
First violation: remove content, leave a warning comment, send a private warning, save one violation.
Second violation: remove content, leave a final warning, send a final private warning, ban the user from that subreddit.
Clean new posts can receive a configurable thank-you comment after passing the scan.
Posts with 5 or more reports are removed by default, with a public reason comment, private warning, and modmail notification.
Automatic scans are scheduled for each subreddit when the app is installed or upgraded.
The manual Shield Check mod action remains available as a backup.
Clean users are not removed for weak signals like a suspicious username alone.
Duplicate triggers for the same content do not count as multiple violations.
Duplicate post-submit and post-create events do not create multiple clean-post comments.
### Moderator Settings
Each subreddit installation has settings on the Reddit developer app page. Moderators can configure:

automatic moderation on or off
whether post scanning is enabled
whether comment scanning is enabled
whether unsafe content is removed
whether heavily reported posts are removed
the report threshold for automatic post removal, defaulting to 5
whether WholesomeShield leaves a public warning comment
whether WholesomeShield sends a private warning message
whether WholesomeShield comments on clean new posts
the clean-post thank-you comment text, with {username} and {subreddit} placeholders
whether repeat violators are banned
whether moderators receive modmail notifications for every violation, bans only, or neither
whether modmail includes user profile details
whether modmail includes removed content details
whether modmail includes detection details and scores
the automatic scan limit, capped at 100 items per scan
Modmail notifications can include the author profile, account age, karma, matched reasons, report count, report reasons, removed content details, and whether a ban was confirmed.

### Detection
The app detects:

NSFW/adult keywords
OnlyFans/Fansly and adult domains
Telegram promotion spam
spammy promotional phrasing
unsafe comments
suspicious usernames as a weak signal
unsafe post flair/tag text
Reddit NSFW flag
suspicious media hosts
True AI image/video scanning is intentionally isolated in src/server/media.ts. Add an AI provider there before claiming AI media scanning in the public app description, then add its domain to devvit.json under permissions.http.domains.

## 11. Community Kanban Board
Community Kanban Board is a Devvit web app for Reddit communities that want a lightweight, public planning board inside a subreddit post.

Moderators can create a board, community members can propose work, and everyone can vote on priorities. User-generated proposals are also posted as Reddit comments from the proposing user, so each proposal has normal Reddit attribution, reporting, and moderation controls.

Community Features
Public Kanban board with To-do, In progress, and Complete columns.
Community proposals with title, description, urgency, labels, date, and blocked state.
Priority voting per Reddit account.
Moderator and board-owner controls for moving and hiding tasks.
Reddit-native attribution for user-generated text through comment creation.
Reportable source comments linked from each task.
Automatic hiding of proposal text when the source comment is removed or marked spam.
Rate limiting and field size limits to reduce spam and abuse.
Read-only viewing for logged-out users.
### Moderation Model
The app treats user-entered task text as public community content.

When a user posts a proposal:

The app submits a Reddit comment on the board post using runAs: 'USER'.
The board stores the comment ID and URL alongside the task.
Users can open the source comment from the board and report it through Reddit.
Moderators can remove or action the Reddit comment through normal Reddit tools.
The board checks source comments and masks task text if the source comment is removed or marked spam.
Board moderators can also hide a task from the public board while keeping the Reddit comment link available for moderation context.

Safety Limits
Maximum 100 tasks per board.
Maximum 6 proposals per user per board per hour.
Title, body, blocked reason, and moderation reason fields are length-limited.
Labels are limited per task.
Logged-out users can view boards but cannot create proposals or vote.

## 12. QueueIQ — Prioritized Mod Queue for Reddit
Reddit's mod queue is chronological. A death threat and a wrong-flair post sit in the same list, in the order they arrived. QueueIQ doesn't.

QueueIQ scores every reported post and comment in your mod queue with transparent, configurable rules — no AI, no black box — and surfaces the highest-risk items first. Moderators see exactly why something ranks where it does, act from one dashboard, and tune the math to match their community.

### The problem
When report volume spikes, moderators — most of them unpaid volunteers — spend the first minutes of every session manually scanning for what actually needs attention. A coordinated spam wave can bury a harassment report. A low-karma account posting banned keywords looks identical to a routine flair complaint until someone reads every title.

For busy subreddits, a flat queue isn't just slow. It's a burnout driver. Mods miss critical content not because they're absent, but because the queue gives them no signal about urgency.

What happens when you install QueueIQ
Your mod queue gets ranked by score, highest first. Each item earns points from signals you can see and adjust — reports, keyword matches, author signals, time waiting, mod reports, and flair rules. Color-coded scores make the top of the list impossible to miss.

Open QueueIQ from your subreddit mod menu and the riskiest items in your queue are already at the top. Expand any row for a line-by-line breakdown of how the total was calculated. No guessing. No opaque ranking.

Score band	What it usually means
High (red/orange)	Multiple reports, keyword hits, mod reports, suspicious author signals
Mid	Some reports or age in queue, worth a look
Low	Routine items — fewer signals, review when you have time
Within the same score, older queue items surface first so nothing ages out unseen.

### How scoring works
QueueIQ uses simple math mods can audit, not machine learning. Every weight lives in subreddit install settings. Change a number, refresh the dashboard, and the queue re-sorts.

total =
  reports × weight
  + keyword hits × weight
  + low-karma bonus (0 or flat)
  + repeat reports × weight
  + queue age (hours) × weight
  + young-account bonus (0 or flat)
  + mod reports × weight
  + flair bonus
Default weights (all editable):

Signal	Default	How it applies
User reports	×3 each	Report count on the item
Banned keywords	×5 each	Matched against title, body, or comment text
Low-karma author	+4 flat	Author below karma threshold
Repeat report events	×2 each	Extra report activity beyond the first
Time in queue	×1 per hour	Capped at 7 days
Young account	+3 flat	Account newer than max age (days)
Mod reports	×5 each	When moderators reported the item
Flair rules	custom	e.g. News:10, Meme:2 matched to post flair
Scores are stored in Redis and recomputed on every refresh. Decimals are supported (e.g. 2.5 points per report).

Key features
Prioritized dashboard — Mod menu → Open QueueIQ opens an inline custom post listing reported posts and comments ranked by urgency. Filter by Posts / Comments / all, set a minimum score, and expand any item for its full breakdown.

Inline moderation — Approve, remove, spam, lock/unlock, ignore or unignore reports, and ban — with confirmation, optional removal reasons, and mod notes. Act without leaving the tool.

Per-item score — Right-click any post or comment → QueueIQ score for an instant breakdown of why that item ranks where it does.

Auto-refresh — Queue re-prioritized every 5 minutes, on new reports, on install/upgrade, and when you tap Refresh.

Optional auto-remove — Install setting to remove items when score and minimum report count thresholds are met (capped per refresh; audit log included). Start with a high threshold and watch the log for false positives.

Audit log — Recent mod actions stored in Redis for accountability.

Moderators only — API and UI are restricted to subreddit moderators.

The dashboard is a Devvit custom post inside your subreddit. It complements Reddit's native mod queue with ranking and actions — it does not replace /mod/.../queue.

Who benefits most
High-volume general subs — When report floods hide the one item with five reports and a banned keyword, QueueIQ puts it at the top automatically so mods respond to the actual threat instead of clearing noise first.

Communities with spam or raid patterns — Low-karma authors, young accounts, and keyword lists are first-class scoring signals. Tune weights once; the queue adapts every refresh.

Any sub with a volunteer mod team — Transparent scoring means new mods trust the order. Senior mods can adjust weights in install settings without touching code.

Configuration (optional)
Setting	What it does
Banned keywords	Comma-separated phrases matched in content
Low karma threshold	Authors below this total karma get the low-karma bonus
Points per report / keyword / repeat / hour / mod report	Scoring weights (decimals allowed)
Low-karma & young-account bonuses	Flat points + young account max age (days)
Flair bonus rules	FlairName:points pairs
Auto-remove at score	0 = off; remove when total ≥ threshold and report count ≥ min reports (max 15 per refresh)
A mental health community and a meme subreddit have different threat models. QueueIQ adapts to yours through install settings, not a one-size-fits-all tier list.

## 13. FlairGuard
FlairGuard helps moderators keep posts organized by making sure every submission has the right post flair — automatically, fairly, and with a clear grace period before anything is removed.

When someone posts without a flair (or with one that isn’t allowed), FlairGuard leaves a friendly instruction comment, gives them time to fix it, and only removes the post if they don’t. Authors can flair the normal way in Reddit, or reply to the bot with a simple command like !flair Discussion.

### Why use FlairGuard?
Less mod busywork — No more manually chasing unflaired posts.
Clear for users — They get instructions and a countdown, not a surprise removal.
Flexible rules — Require any flair, or only specific ones. Exempt mod posts and announcements.
Mod control — Exempt individual posts or check status from the post menu anytime.
Great for gaming subs, support communities, news/discussion boards, or anywhere flair keeps content easy to browse and filter.

What your community sees
If a post needs a flair
FlairGuard comments on the post with:

What’s wrong (missing or invalid flair)
How long they have to fix it
The list of allowed flairs (if you configured one)
Two ways to fix it: use Reddit’s flair picker, or reply to the bot
If they fix it in time
The warning comment is removed and the post stays up. No further action needed.

If they don’t fix it in time
The post is removed and FlairGuard leaves a short explanation comment. You can optionally lock the post or send modmail when this happens (see settings).

The !flair command (for post authors)
FlairGuard comments on their post.
The post author replies directly to that comment (not as a top-level reply on the post).
They type: !flair YourFlairName — for example, !flair Discussion.
If the flair exists on your subreddit and is allowed, FlairGuard sets it, removes the warning, and confirms success.
You can change the command prefix in settings (default is !flair).

### Mod tools
On any post, open the ⋯ menu:

FlairGuard — Exempt this post — Stops enforcement for this post, removes any warning, and keeps the post up.
FlairGuard — View status — Shows whether the post is tracked, exempt, or how long until auto-removal.
### Settings overview
Enforcement

Enforce flair on new posts — Master on/off switch.
Grace period (minutes) — Time to fix flair before removal.
Allowed flairs — Restrict to specific flairs, or leave empty for “any flair counts.”
Exempt flairs — Flairs that skip enforcement entirely.
Warn on invalid flair — Also enforce when someone picks a flair not on your allowed list.
Messages

Self-assign command prefix — Default !flair.
Warning comment template — Customize the bot’s first comment (optional).
Removal comment template — Customize the message after auto-removal (optional).
Removal reason — Internal note mods see on the removal.
Extras

Notify mods on removal — Send modmail when a post is auto-removed.
Lock post after removal — Lock the thread after removal.
### Tips
Test first — Use a private test sub or set grace period to 1 minute while verifying behavior.
Match flair names exactly — Allowed and exempt lists must match how flairs appear on your subreddit (matching is case-insensitive).
Turn off without uninstalling — Disable Enforce flair on new posts anytime.
Credits
FlairGuard is a Devvit port of the open-source bot FM_Flair_Bot by u/swrj (GPL-3.0).

## 14. Automod Wizard
A visual AutoModerator rule builder for Reddit, built on the Devvit developer platform.

Moderators open the wizard from the subreddit menu and assemble rules as vertical step chains: a trigger at the top, optional author / post / parent conditions underneath, and an action at the bottom. Edits autosave and auto-publish to the subreddit's config/automoderator wiki page after a short debounce — there is no separate "Publish" button.

When the subreddit already has a hand-written AutoMod config, an onboarding flow parses the existing YAML and previews the reconstructed rules before adopting them, so nothing's destroyed on first run.

### How it works
Piece	What it does
Subreddit menu item	"Open Automod Wizard" — moderator-only (forUserType: "moderator" in devvit.json), calls /internal/menu/open-wizard
Singleton post	On first menu click the app submits a custom post titled "Automod Wizard (moderators only)", calls post.approve() + post.distinguish(), and stores the permalink in Redis. Subsequent clicks reuse the same permalink. The post is intentionally NOT removed — Reddit's mobile client shows a confusing "Sorry, removed by mods" screen for removed posts, even to moderators, which broke the entry point.
Splash	splash.html — calls /api/init; mods see "Open wizard" → requestExpandedMode("wizard"), non-mods see a minimal "Not for you!" card.
Wizard webview	The expanded wizard.html view — top bar, vertical rule chains, edit drawer, picker bottom sheets, modals. Pure DOM, no framework.
Server	A Node HTTP handler (src/server/server.ts) with mod-auth, Redis persistence, YAML emit + parse, wiki read/write, and the QA-tools-free public API.
Onboarding
Triggered on bootstrap in two situations:

First-run — wizard:doc:{subredditId} is empty in Redis and the wiki has parseable AutoMod content. Loading screen (~5s with paced step messages) → review screen showing parsed rules + warnings collapsible → Start fresh (discard, persist empty doc) or Import (adopt the parsed rules). Tap-to-expand on each rule card to see step detail.

Corruption recovery — wizard:doc:{subredditId} exists AND the wiki has content AND the wiki YAML is missing both the wizard's # Generated by automod-wizard header and any # wizard-rule-id: markers. The wizard assumes the wiki was hand-edited or wiped externally. Same loading + review screens but the CTA pair becomes Repair (signature-matches the wiki rules against the stored Redis doc to recover names/IDs) and Re-scan (treat the wiki as source of truth, ignore stored data).

A × Skip button in the topbar exits the flow at any phase. Persists an empty doc to Redis so onboarding doesn't retrigger on next load — re-import manually from the topbar Import button if you change your mind.

Building a rule
New rule opens a scope-picker sheet first: All / Any post / Link posts / Text posts / Polls / Comments. Setting scope up front avoids the common mistake of building a rule with the wrong default scope.
After scope, the step picker opens. Categories:
Trigger: Everything (catch-all on the rule's scope) or Content match
Filter by content: Content match, Author conditions, Post attributes, Parent post conditions (comment rules only)
Then do this: Action
Each step renders as a card in the chain with a connector line. Tap a step to open its detail sheet on the right.
Edits autosave to Redis (1.5s debounce) and auto-publish to r/<sub>/wiki/config/automoderator. The top-bar status badge shows Ready / Saving… / Publishing… / Published / Publish failed. Failures pulse red and open an error-detail modal on tap with a Copy button.
Per-rule controls (editor topbar)
Name input — autosaves on change
Scope dropdown — All, Posts (any), Link posts, Text posts, Polls, Comments
Shield toggle — flips moderators_exempt. Default is false so rules fire on mods during testing; flip to true to exempt mods.
Trash button — opens a destructive-confirmation modal
Rule list controls (list topbar)
Status badge — see above; click for the error log + Copy
Show YAML — modal preview of the emitted YAML for the current doc
Import — pull the current wiki YAML in via the parser, with a confirmation before replacing
Revert — only visible when wizard:initial-yaml:{subredditId} exists. Restores the wiki to the snapshot the wizard captured on first import. Clears the stored doc.
Swipe gestures on rule cards
Touch-drag (or mouse-drag) any rule card left to reveal Rename + Delete actions. Tap outside or on the card to dismiss. Rename uses an in-app prompt modal; delete uses the destructive-confirmation modal.

Wiki integration
Read — reddit.getWikiPage(sub, "config/automoderator") during import and onboarding triggers. Parsed by src/server/automod-parse.ts (uses js-yaml).
Write — reddit.updateWikiPage(...) on every auto-publish. Bot account must be a mod with the wiki permission, AND the subreddit wiki must be enabled (mod tools → Settings → Wiki → "Mod editing only" or "Anyone"). Otherwise the wiki write returns HTTP 415 and the status badge shows "Publish failed" with the message.
Snapshot — first time /api/wizard/import runs on a fresh subreddit, the server captures the raw wiki YAML in wizard:initial-yaml:{subredditId}. onInit also backfills this snapshot for subreddits that had wizard activity before this feature existed (best-effort: captures whatever's currently on the wiki).
Gating
forUserType: "moderator" hides the menu item from non-mods, but the post URL is guessable. Every /api/* route therefore calls checkModerator() against reddit.getModerators({ subredditName, username }) and returns 403 if the caller isn't a current mod. The splash also checks /api/init and renders a "Not for you!" card for non-mods so the editor never even loads its UI.

AutoMod feature coverage
The parser/emitter pair handles common AutoMod constructs as first-class visual steps. Anything else is preserved verbatim as an UnknownNode that round-trips on publish (yellow-tinted "Unrecognized step" card with a raw-YAML textarea and an "Approved as-is" checkbox) — so the wizard never silently loses constructs it doesn't understand.

Rule-level metadata: type (any, submission, link submission, text submission, poll submission, comment), priority, moderators_exempt, satisfy_any_threshold.

Triggers / match fields: title, body, title+body, domain, url, flair_text with modifiers includes, includes-word, starts-with, ends-with, full-exact, regex (+ case-sensitive). A dedicated "Everything" trigger for catch-all rules.

Author conditions (under author:): comment_karma, post_karma (legacy link_karma accepted on import, always emitted as post_karma), combined_karma, account_age, name, is_contributor, is_moderator, is_gold, has_verified_email, is_submitter, flair_text, flair_css_class. Range bounds use > / < strict comparisons (with offsets) since AutoMod's regex doesn't reliably accept <=/>= and only allows one comparison per field.

Post attributes: score, num_comments, is_original_content, nsfw (over_18 alias), spoiler, is_edited, body_longer_than, body_shorter_than, is_top_level (comment rules).

Parent submission: parent_submission: block recognized as its own node kind. Edited as raw YAML in a textarea; re-indented and wrapped on emit.

Actions: remove / spam / filter / approve (with action_reason), report (with report_reason), set_locked, set_nsfw, set_spoiler, set_sticky (slot 1 or 2), set_suggested_sort (all 8 sort modes), set_contest_mode, set_flair (text + CSS class, with overwrite_flair toggle), comment (with comment_stickied), modmail (with modmail_subject), message to author (with message_subject).

Markdown editing: comment / modmail / message bodies use a Write / Preview tab pair (in-house Markdown renderer — bold, italic, strikethrough, code, links, headings, blockquotes, lists, paragraphs) and a format-button capsule with bold / italic / strike / code / link / quote / bullet / numbered-list buttons.

### Known limitations
>= n, <= n compound bounds parse into both min/max but emit only the min (with a server log warning). AutoMod's parser only accepts one comparison per field.
~field negation (e.g. ~title:, ~author:) is preserved as an UnknownNode but not editable as a recognized inversion.
Author-block unknowns (e.g. unknown fields nested inside author:) are warned-and-dropped, not preserved like top-level unknowns.
Comments other than # wizard-rule-id: and # wizard-rule-name: are not preserved across a publish cycle.
Storage
Redis key	Value
wizard:doc:{subredditId}	JSON WizardDoc — source of truth for the visual builder. Migrated on read via migrateDoc() so older shapes get missing fields backfilled.
wizard:post:{subredditId}	Permalink of the singleton wizard post
wizard:published:{subredditId}	ISO timestamp of the last successful publish
wizard:initial-yaml:{subredditId}	Snapshot of the wiki YAML the first time the wizard saw it — powers the Revert button
The published copy on the wiki is generated from WizardDoc; each auto-publish overwrites the entire wiki page. Any manual edits to config/automoderator between wizard publishes will be clobbered on the next edit — but those edits trigger the corruption-recovery onboarding flow on the next load, so they're surfaced rather than silently lost.

## 15. Repost Radar
Reposted images are the oldest karma trick on Reddit. Repost Radar catches them automatically: it recognizes when somebody re-uploads an image that's already been posted in your subreddit, and acts on it the way you've told it to.

### What it does
When somebody posts an image, an image gallery, a video, or a GIF, Repost Radar:

Looks at the image (or the poster frame for video/GIF).
Compares it against every image it's seen in your subreddit before.
If it finds a match, takes whatever action you've configured: report, send to mod queue, or remove. Optionally bans the user after enough offences.
It recognizes the same image even if it's been re-cropped a little, recompressed by Reddit, screenshotted, or had a small watermark added. It is not fooled by reposters changing the title or making a new account.

For videos and GIFs, it compares the poster frame (the still image Reddit shows before you press play). This catches the easy case where someone redownloads-and-reuploads a video, but won't catch a reposter who clips the start.

It does not (yet) detect:

Reposted link posts (only the post's image itself, not the URL)
Image reposts from other subreddits (it only knows about your subreddit)
Text/title duplicates
Frame-by-frame video matching for edited reuploads

### The mod menu
Open your subreddit and look in the moderator menu (the "Mod Tools" three-dot menu on a post, or the "..." menu at the top of the subreddit). You'll see five items added by Repost Radar:

Subreddit-level
Repost Radar: Settings — Open the configuration panel. Also shows you the current status at the top (mode, how many images are stored, how the seed went, how many detections you've had).
Repost Radar: Re-seed top posts — Re-scan your subreddit's top posts. Use this if you just installed the app and want to make sure top-of-all-time is covered, or if you want to refresh after a big surge of new content. Safe to run anytime.
Post-level (right-click or "..." on a specific post)
Repost Radar: Check this post for reposts — Manually run a check on a specific post. Useful if you're suspicious of a post and want to see what Repost Radar thinks.
Repost Radar: Add this post's image to ignore list — Tell Repost Radar to stop matching against this image. Use this for stock images, meme templates, or OC the artist is allowed to repost.
Repost Radar: Reset offences for this author — Clear an author's offence counter. Use this if you confirmed a false positive and don't want it counted against them.
### Settings explained
When you open Settings, the top of the form shows your current status:

Mode: DRY-RUN · 1,247 images stored Seed: seeded 1,247 images from 935/1000 top posts (all-time + year) Detections: 0 — but 3 matches skipped (same-author / whitelist)

Below that, the settings are grouped:

### Detection
Mode — On, Dry run, or Off.
On takes the configured actions on every match.
Dry run notices reposts and modmails you, but never touches a post. Use this while you're tuning — nothing will appear in the mod queue.
Off disables detection entirely. Stored images are kept; the app just stops watching.
Similarity threshold — How identical two images have to be to count as a match. The default of 6 is a good starting point.
0–4 catches near-identical re-uploads (good if you have lots of false positives).
6–8 tolerates heavier edits like cropping and recompressing (good if reposters are getting clever, but raises the false-positive rate).
Hash new posts — Remember new posts going forward, so future reposts of them get caught too. Leave this on unless you have a specific reason to turn it off.
Flag reposts by the same author — If off, an artist re-uploading their own work is allowed. If on, even the same author can't repost.
Seeding
Which "top posts" lists to scan when seeding. The seed runs once on install and again whenever you click "Re-seed top posts".

Top of all time — Recommended. This is where reposters mine for content.
Top of year — Recommended. Covers anything that's gotten traction recently.
Top of month — Optional. Only worth turning on if your sub is high-volume.
Actions on match
What to do when a repost is detected. Action escalates by offence count for the same author — so a user can get a soft warning the first time and a removal the second.

1st offence — Default: Report. The post stays up but mods see it in reports.
2nd offence — Default: Remove. The post is taken down with a stickied comment explaining why.
3rd+ offence — Default: Remove.
For each, you can choose:

Nothing — No action (but you'll still get a modmail).

Report — Sends the post to the report queue with a note.

Filter — Removes the post and puts it in the mod queue for review.

Remove — Removes the post outright, applies a removal reason, and posts a stickied comment.

Auto-ban after N offences — Bans an author after they hit this many strikes. Set to 0 to never auto-ban.

Ban duration — How many days the ban lasts (0 means permanent).

Native removal reason ID (optional) — If you've configured custom removal reasons in your subreddit, paste the reason's ID here and it'll be applied to removed posts. Leave blank to skip.

Stickied removal comment template — The message left on removed posts. Supports the placeholders {originalLink}, {originalAuthor}, {originalTitle}, {subreddit}. The default template is friendly and includes a link to the original post and a way to contact mods.

Notifications
Send modmail — Each detection gets a modmail with the new post, the original, the similarity score, and what action was taken. Recommended.
Add a Reddit mod note — Adds a "Spam warning" note on the author. Lets the next mod see at a glance that this user has a history.
Filters
Whitelisted usernames — Comma-separated list of users to ignore entirely.
Whitelisted post flair text — Comma-separated list of flair texts. Posts with these flairs are never checked. Useful for "OC" or "Source" flairs.
Only check accounts younger than N days — Limits detection to newer accounts (where reposters tend to live). Set to 0 to check everyone.
### Handling false positives
It happens. Two memes can hash similar; a photographer can post their own work twice; you can disagree with a removal. Here's what to do:

The post got removed but shouldn't have been: Approve it from the mod queue. Repost Radar watches mod approvals and automatically rolls back the offence count, so the user isn't punished for your override.
The same image keeps tripping false positives (stock photo, common meme template, the sub's banner image): open the post and use Add this post's image to ignore list. Repost Radar will stop matching against it going forward.
An OC artist or specific user shouldn't be checked: add their username to Whitelisted usernames in Settings.
A whole flair shouldn't be checked (e.g. an "OC" flair): add the flair text to Whitelisted post flair text in Settings.
A user got marked as a repeat offender unfairly: open one of their posts and use Reset offences for this author.
### Recommended setup for a brand-new install
Leave the mode as Dry run for the first 1–2 weeks. Nothing will be removed.
Watch the modmails come in. Click through to verify the matches look right.
If you're getting too many false positives, lower the similarity threshold (try 4).
If you're missing obvious reposts, raise the threshold (try 8).
When you're happy with what it's catching, switch the mode to On.
### What Repost Radar can't do
It can't catch a reposted image that wasn't in your subreddit's top posts at install time and hasn't been posted to your sub since. (To catch those, you'd need a cross-subreddit database — Repost Radar is intentionally local-only.)
It can't see images outside the post itself. Inline image links in comments aren't checked.
It can't tell apart two genuinely similar but distinct photos (two sunsets, two cats in similar poses). The similarity threshold lets you tune sensitivity, but no image fingerprint is perfect.
It doesn't read text inside images, so a meme reposted with different caption text is treated as the same image — that's usually what you want.

## 16. VerdictBot
Fair, automatic consequences for repeat rule-breakers — without changing how you moderate.

VerdictBot runs quietly in the background. When you remove someone’s post or comment, it remembers. After enough removals, it steps in with a warning, mute, or ban — using limits you set. You keep moderating exactly as you do today.

### Why mods use it
Consistent — The same user gets the same treatment every time, no matter which mod removed their content
Hands-off — Set your thresholds once; VerdictBot handles repeat offenders for you
Fair — Old mistakes can fade over time with optional violation decay
You're in control — View any user’s record or override it from the post/comment menu
### How it works
Every time a mod removes a post or comment, VerdictBot adds one violation for that user.

Default steps (you can change all of these):

Removals	What happens
1	User gets a warning message
3	User is muted
5	Temporary ban (7 days)
8	Permanent ban
Want stricter or softer rules? Open settings and adjust the numbers.

Settings (quick guide)
Setting	In plain English	Default
Warning Threshold	Removals before a warning is sent	1
Mute Threshold	Removals before mute	3
Temp Ban Threshold	Removals before a temp ban	5
Temp Ban Duration	Length of temp ban (days)	7
Permanent Ban Threshold	Removals before a perm ban	8
Enable Violation Decay	Lower old violation counts after quiet time	On
Decay Period	Days of no removals before count drops	30
Decay Amount	How much the count drops each time	1
Track Rule Violations	See which rules are broken most	On
Notify Mods via Modmail	Modmail when VerdictBot acts	On
Notify User on Warning	Message the user on first warning	On
Warning Message	Text of the warning (you can edit)	Built-in template
Add Mod Notes	Leave a mod note when VerdictBot acts	On
Changes apply right away. If numbers are entered in a weird order, VerdictBot sorts them into a sensible ladder automatically.

View or fix a user's record
On any post or comment, open the ⋯ menu:

VerdictBot — View Record
See violations, current status, recent history, and which rules are broken most.

VerdictBot — Override
Change their removal count, set their status manually, or wipe their record and start over.

Manual changes are saved in their history so your team can see what was done.

Optional: track which rules break most
Add a short tag like [R1] or [R2] in the post title, post body, or comment when it makes sense. VerdictBot uses the first tag it finds to build a simple leaderboard in View Record.

No tag? That’s fine — removals still count; they’re just listed as “Untagged.”

### Good to know
Only counts removals after VerdictBot is installed
Ignores AutoModerator and other bot accounts
Does not punish subreddit moderators
Manual bans you place yourself are separate — only removals add violations
Decay lowers VerdictBot’s internal count; it does not automatically unban or unmute on Reddit (mods can still override anytime)
Each subreddit’s data stays private to that community
Questions
Does it count old removals from before install?
No — only new removals after you turn it on.

What if I already banned someone by hand?
That’s separate. VerdictBot only reacts to content removals.

Can I turn off modmail alerts?
Yes — disable Notify Mods via Modmail in settings.

A temp ban expired on Reddit — what does VerdictBot show?
It may still show “temp banned” until their next removal or until you use Override Tier to reset them.

## 17. 🛡️ OmniMod — Unified AI-Powered Moderation Dashboard
OmniMod is a Devvit-powered moderation command center that gives Reddit moderators a single, unified interface for tracking, reviewing, auditing, and reverting moderation actions — all inside a custom post pinned to their subreddit.

✨ Features
📋 Live Action Ledger
Every moderation action (removals, bans, spam flags, warnings) is automatically captured in real-time and displayed in a filterable ledger. Moderators can see exactly what happened, who did it, and when — without ever leaving Reddit.

⏪ Bulk Revert Engine
Made a mistake? Select one or many actions and revert them all in a single click. The fault-tolerant engine handles each revert individually, so a single failure doesn't halt the rest of the batch. Reverted actions are clearly distinguished in the ledger.

🤖 OneVoice AI — Warning Templates
Powered by Google Gemini Flash (latest) and OpenAI GPT-4o-mini, OmniMod generates professional, rule-specific warning messages tailored to your subreddit's actual rules. No more inconsistent mod messages — every warning follows the same tone and format, and mods can customize templates per rule.

🔍 Rule Gap Analysis
Identify blind spots in your community's ruleset. OmniMod analyzes recent manual actions and uses AI to surface recurring keywords and patterns, suggesting new rules based on what you're actually moderating.

⚠️ Send OmniMod Warning (Context Menu)
A new right-click menu item on any post lets moderators immediately send a professional, AI-generated warning aligned with subreddit rules — and remove the post in one action.

⚡ Passive Event Capture
OmniMod listens to onModAction triggers in the background, passively logging actions taken through native Reddit tools. Smart deduplication ensures actions initiated through OmniMod itself aren't double-logged.

🛡️ AI Safety Scan
Before bulk-reverting, OmniMod can optionally scan selected content for doxxing, credible threats, CSAM indicators, or malware using AI. Dangerous content is automatically flagged and deselected, preventing accidental restoration.

📊 Statistics Dashboard
Real-time stat cards show Total Actions, Removals, Warnings, Bans, Spam, and Reverted counts. Category tabs and status filters (All / Pending / Reverted) let mods focus on what matters.

💾 Ledger Archive Export
Export the entire action ledger as a Markdown table to your clipboard for record-keeping, wiki documentation, or mod team reports.

🔒 Mod-Only Access
The dashboard enforces strict moderator-only access. Non-moderators see a locked screen. All API endpoints are protected by server-side moderator verification.

## 18. Write a moderation rule in plain English. It runs deterministically — shadow-tested first, with one-click undo.

A moderator types "Send to mod queue any post under 50 characters from accounts less than 7 days old." vibe-mod turns that sentence into a real rule, runs it in 24-hour shadow mode (logging what it would do, acting on nothing), shows a preview against recent posts, and keeps 30-day undo on every action it takes. The AI is used only when you write a rule — never on your community's posts.

### What it does
Type a moderation rule in plain English — "remove posts whose title is ALL CAPS", "send links from accounts under 7 days old to the mod queue" — and vibe-mod turns it into a real, working rule. It shows you exactly what the rule will do, runs it quietly for 24 hours first, and lets you undo any action for 30 days. No YAML, no regex, no code.

The AI only ever reads the sentence you type — never your community's posts, comments, or usernames. Once it has written the rule, the AI is done: every check after that is plain, deterministic logic, so the same post always gets the same decision, and there's zero AI cost per post.

How to use it
Mod Tools → "vibe-mod: Compose rule" → type your rule → Compile + Preview. (If your sentence is ambiguous, vibe-mod asks a quick clarifying question instead of guessing.)
Review the dry-run preview — which of your recent posts the rule would have caught. Nothing happens yet.
Activate it. The rule runs in 24-hour shadow mode (just logging what it would do), then goes live automatically. Watch those decisions under "vibe-mod: View rules + log".
If it ever acts on something you disagree with, open that item's ⋯ menu → "vibe-mod: Undo this action" (available for 30 days).
Six starter rules are seeded as drafts on install so you have something to look at, and the mod team gets a one-time welcome message with a 3-step start guide.

### Settings you can tune (per subreddit)
Dry-run only — master off-switch; rules log but never take real action (on by default until you're ready).
Max actions per hour — a safety brake against a runaway rule.
Shadow duration — how long a new rule observes before going live (default 24 hours).
No OpenAI key and no billing — vibe-mod covers the AI cost, up to 50 rule compiles per day per subreddit.

Why a new rule can't hurt your community
🕒 24-hour shadow mode — every new rule only logs what it would do for a full day before it can act.
👀 Dry-run preview — see exactly which of your recent posts a rule catches before you turn it on.
↩️ 30-day undo — every action vibe-mod takes is reversible with one click.
🛑 Guarded actions — report / flair / lock / modqueue / remove are allowed, but ban / mute / permaban / approve stay blocked unless you explicitly tick a checkbox.
🧠 No AI on your content — the model only sees the sentence you typed, runs once per rule (never per post), and never reads posts, comments, or usernames.
How it compares to AutoModerator
vibe-mod is not an AutoMod natural-language wrapper, and not an AI that reads your subreddit and decides things:

Authoring — one plain-English sentence with a dry-run preview, instead of hand-editing YAML + regex with no preview.
When the AI runs — once, at rule-edit time. (AutoMod uses no AI; "generic AI moderation" bots call a model on every post.)
Per-post cost — $0: the model already ran at edit time. (Runtime AI bots pay per post and hit rate limits.)
New-rule safety — 24-hour shadow mode + dry-run preview + 30-day undo, vs live-on-save with no undo.
Sees your content? — the model only ever sees your typed sentence, never posts, comments, or usernames.
The idea: AI is great at turning intent into a rule, and bad at applying rules consistently. vibe-mod uses it only for the first part and plain, deterministic TypeScript for the rest.

### How it works
The one idea: build-time AI, runtime determinism. The model runs once, when you write a rule, turning your sentence into a deterministic rule; every runtime decision after that is plain TypeScript — no model, no network, reproducible, and free. The full architecture (trigger + scheduler map, the deterministic evaluator, and the guarantees that hold by construction) is in docs/architecture.md.

## 19. Mod Notes Memo
Private post-level mod notes for Reddit moderators. Document moderation decisions and preserve team context at the point of decision.

### Problem Statement
Moderators frequently approve edge-case posts that technically violate minor rules but are kept up for community value, news relevance, or special context. The current Reddit moderation workflow offers a green approval checkmark, but no built-in way to explain why to other moderators. This creates:

Context Loss: Other mods don't understand why an exception was made
Duplicate Work: Mods ask "Why is this still up?" repeatedly in mod chat
Inconsistent Follow-up: Without documented reasoning, different mods may reverse decisions
Time Waste: Asynchronous teams across time zones repeat clarification conversations
### Solution
Mod Notes Memo is a Devvit mod tool that adds private internal notes directly to posts. Moderators can quickly document why they approved, flagged, or allowed a post—without leaving Reddit's interface. Notes are mod-only, private, and persistent, visible only to the moderation team.

### Key Features
MVP (Launch Version)
Add Notes: Quick form to add a brief note (5–500 characters) to any post
View Notes: See all notes on a post, sorted by most recent first
Edit & Delete: Modify or remove your own notes; senior mods can manage any note
Labels/Categories: Optional quick tags like "Rule Exception," "Approved Contextually," "Needs Follow-up," "Pending Review," "Team Decision"
Metadata: See author, creation time, edit history, and when a note was modified
Mod-Only Visibility: Notes never appear publicly or to post authors
Persistent Storage: Notes survive refreshes and are reliably stored via Devvit Redis
Permission Enforcement: Only moderators can view or create notes
Future Features (v2+)
Note templates ("Approved contextually", "High-quality repost", etc.)
Bulk note actions ("Quick approve with template note")
Note search and filtering by label, date, author
Auto-suggested labels based on context
Subreddit-level analytics: % of exception posts documented, common exception types
Slack/Discord relay (notify team of important notes)
Export/audit logs for mod team reviews
### Use Cases
Exception Approvals: "Allowed despite Rule 3 because this is breaking news and already generating useful discussion."
Context Preservation: "Approved after OP added sources." / "Borderline off-topic, but high-value community resource."
Escalations: "Senior mod approved — do not remove unless comments derail."
Follow-up Notes: "Leave up; similar exception made last month." / "Revisit in 24h if no improvement."
Team Decisions: "Team consensus: exceptions allowed for posts matching X criteria."

## 20. ModTower
A mod tool for Reddit built on Devvit that helps moderators track user reputation and coordinate modqueue reviews — without ever leaving Reddit.

### Overview
ModTower tracks a reputation score for every user in your subreddit based on their mod history — removals, bans, reports, posts, and comments. Scores update automatically as mod actions are taken, so there is no manual input or external dashboard to maintain. Moderators can pull up a full history for any user and act on it (ban, remove, add a note) directly from the Reddit mod menu. For larger mod teams, ModTower also provides claim locks on modqueue items and a shared notepad to coordinate handoffs without leaving the site.

### Features
User Reputation Scoring
Each user has a reputation score from 0 (worst) to 1500 (best), starting at 1000
Score decreases for removals (−30), bans (−100), and reports (−10)
Score increases for posts (+5), comments (+2), account age (+1/month, capped at +120), and karma (+1 per 100 karma, capped at +100)
Four tiers: GOOD (≥800, green) · MODERATE (500–799, yellow) · AT RISK (200–499, orange) · CRITICAL (<200, red)
Scores update automatically via background triggers — no manual refresh needed
### Mod Menu Actions
Check any user's reputation from a post, comment, or by username lookup via the subreddit menu
Take action directly from the reputation view: temp-ban, permanent ban, remove content, or add a note
All actions include confirmation steps before executing
Mod Notes
Add private notes to any user — visible to all mods in the subreddit
Notes are attributed to the mod who wrote them with a timestamp
Delete your own notes (subreddit admins can delete any note)
Modqueue Coordination
Claim a post or comment to signal you are handling it
Claims expire automatically after 10 minutes
View all active claims across the subreddit at a glance
Shared mod notepad for shift handoffs, reminders, and coordination
Configurable Weights
Subreddit admins can adjust how much each signal affects the score
Configured via the Reddit native app settings UI — no custom form needed

### Score weights (default values)
All users start at 1000. Scores are capped between 0 and 1500.

Signal	Effect	Default weight
Content removal	−30 pts	30
Ban	−100 pts	100
Report received	−10 pts	10
Post created	+5 pts	5
Comment created	+2 pts	2
Account age	+1 pt/month (max +120)	1
Karma	+1 pt per 100 karma (max +100)	1
Weights are adjustable per subreddit via Mod Tools → Installed Apps → ModTower → Settings.

### Known limitations
Ban history and mod notes display the most recent 5 entries in the form view (full history is stored in KV)
Presence indicators (who's online) are not implemented — Devvit's form-based mod tool model does not support client-side polling
Modqueue sorting by reputation score is not yet implemented
Score history timeline is stored in KV but not yet surfaced in the UI
Claims are optimistic — a race condition guard exists, but if two mods claim the same item simultaneously the second mod will see the first mod's claim on their next open

## 21. AutoMod Playground
AutoMod Playground is a Devvit-powered moderation sandbox designed to help Reddit moderators safely test AutoMod-style rules before deploying them to live communities.

The app provides an interactive environment for experimenting with moderation logic, regex filters, keyword matching, karma restrictions, account age checks, and moderation actions without affecting real subreddit content.

### Features
Keyword matching simulation
Regex rule testing
Karma-based moderation filters
Account age restriction testing
Moderation action previews
Safe sandbox testing environment
Interactive moderation workflow
### What Problem Does This Solve?
Testing AutoMod configurations directly on live communities can be risky and time-consuming.

AutoMod Playground helps moderators:

safely debug rules
preview moderation behavior
validate regex patterns
understand rule matches
experiment before deployment
This reduces moderation mistakes and improves confidence when managing subreddit automation.

How To Use

## 22. Sentinel AI
Sentinel AI is a Devvit-based Reddit moderation intelligence dashboard. It helps moderators configure behavioral signals, track suspicious users daily, inspect evidence, and take moderator-confirmed actions through Reddit APIs.

This is not a chatbot and not an autonomous moderation bot. The AI summarizes and explains evidence; moderators make final decisions.

### What Is Built
First-run setup screen with expandable detector toggles.
Large Custom Lookout Instructions field.
Daily moderation intelligence dashboard.
Risk threshold slider.
Date-aware dashboard filters for today, yesterday, all retained data, and a custom day.
Dashboard filters for severity, triggered signal, username search, and sort order.
Highest-risk-to-lowest-risk user ranking.
Red severity states and high-risk highlighting.
User detail intelligence modal.
AI summary panel with safe wording guardrails.
Message history, suspicious highlights, repeated links, repeated phrases, detector signals, and daily risk history.
Configurable retention period with Redis TTL design.
Redis-backed ingestion, scoring, ranking, and detail storage.
Devvit triggers for posts, comments, reports, deletes, mod actions, and AutoModerator filters.
Scheduler tasks for end-of-day analysis, next-day backfill, retention cleanup, and AI retry.
Moderator action endpoints for removing content, warning, muting, banning, watchlisting, ignoring, and marking false positives.
Gemini provider integration through server-side fetch, with OpenAI kept as a switchable fallback provider.
Setup customization for detector search, group enable/disable, retention, hosted AI provider, and AI summary toggle.
Deterministic evidence summaries when no hosted LLM key is configured.
Compact translucent dark/light UI optimized for moderator scanning.
Retryable error screen and in-app error banner for degraded Reddit/API calls.

## 23. 🛡️ Raid Radar
Live raid detection and one-tap lockdown for Reddit moderators.

When a brigade hits your subreddit, you usually find out from the aftermath. Raid Radar surfaces the warning signs while the raid is forming — and lets you end it with a single click.

Full 80-second demo: https://youtu.be/YMNIPuB3X_w

### The problem
Mods are the unpaid backbone of Reddit, and the highest-impact attack on a community — a coordinated raid — happens in minutes. By the time a mod opens the queue and starts manually approving / removing posts, the damage is already done. Existing tooling reacts; it does not predict, and it does not stop a raid mid-flight without a human in the loop for every individual decision.

How Raid Radar fixes it
A single dashboard post pinned to your subreddit watches every new post and comment through Devvit's trigger system and derives three real-time signals against a rolling 24-hour baseline:

Post velocity — posts per hour, z-scored against the baseline
Comment velocity — same, for comments
New-account ratio — share of recent activity coming from accounts < 7 days old
When the signals cross alert thresholds, the dashboard turns from green to amber to red, with the specific reason quoted — e.g. "activity 3.2σ above baseline · 64% new accounts." When you've seen enough, one click on "🔒 Lock down submissions (30 min)" from the mod menu auto-removes every new post and comment for the duration. A scheduled Devvit job re-opens the gates 30 minutes later — or you can end the lockdown early from the same menu.

Every auto-removal increments a transparent "Hours saved" counter, calibrated at a conservative 30 seconds of moderator triage per blocked item. Every removed post is recoverable: any mod can click Approve to restore it, exactly like any other queue item.

### Features
Feature	Detail
⏱ Live pulse	Dashboard refreshes every 15s; lockdown countdown ticks every second
📊 Rolling z-score detection	Hourly-bucket baseline over the previous 24h; per-metric σ; alerts at 2.5σ (elevated) / 4σ (critical)
🆕 New-account detection	Cached getUserByUsername lookups identify accounts < 7 days old; alerts at 40% / 70% ratio with minimum-events guard
🔒 One-tap lockdown	Auto-remove every new post and comment for 30 minutes from a mod-menu click
⏰ Auto-unlock scheduler	Devvit scheduler.runJob guarantees gates re-open — never get stuck locked
⏳ Hours-saved counter	Conservative 30s-per-block estimate; visible to mods as quotable evidence of value
🚪 Mod override	Every auto-removed item appears in the queue with an Approve button — false positives are reversible in one click
📱 Responsive	Three-stat row collapses to a single column on Reddit mobile
🛟 Defensive state	If an unlock job ever misses its window, the dashboard treats lockdown as inactive — no permanent locks possible
What it looks like in use
The full incident-response loop, step by step:

Idle dashboard — three live stat cards (Posts / Comments / New accounts), an All clear pill, and a Calibrating baseline footer
Detection fires — when a raid forms, the pill turns amber or red with the specific reason quoted
Mod menu — 🔒 Raid Radar: Lock down submissions (30 min) appears alongside Reddit's built-in mod actions
Lockdown active — a rose countdown banner replaces the status pill, ticking by the second
Spam submission auto-removed — the post appears in the mod queue with the Removed by Reddit's automated systems badge; Approve is one click away if it was a false positive
Counters tick — 1 blocked this session on the banner; Hours saved: 0.01 in the second stat row; 1 spam post auto-blocked since install
End early — 🔓 Raid Radar: End lockdown from the same menu restores normal operation immediately
Full 80-second demo: https://youtu.be/YMNIPuB3X_w

How it works (technical)
Reddit  ─onPostCreate/onCommentCreate─►  Hono trigger handler
                                              │
                                              ├─ if lockdown active ─►  reddit.remove(t3_…) + recordAutoBlock()
                                              │
                                              └─ else ─►  isNewAccount? → record to events:* zsets
                                                                                     │
                                                                                     ▼
                                                                          KV time-windowed event log
                                                                                     │
React dashboard ◄─ 15s poll ── /api/snapshot ◄─ readWindow(60min) + getMetrics() + getLockdownState()
Frontend: React 19 + Tailwind 4 + Vite 7 in a Devvit Web custom post (splash + expanded view)
Backend: Hono on Devvit's Node 22 serverless runtime
Storage: Devvit's Redis-compatible KV (sorted sets for event logs, hashes for state, integers for metrics)
Scheduler: scheduler.runJob({ name: 'unlock-subreddit', runAt }) for delayed auto-unlock
Identity: reddit.getUserByUsername with KV-cached creation timestamps to keep mod-action latency under one round-trip per new user
Strict TypeScript throughout (exactOptionalPropertyTypes, noUncheckedIndexedAccess, no-floating-promises). Trigger handlers prepend t3_/t1_ prefixes at the platform boundary so domain code never deals with template-literal IDs directly.

## 24. 🛡️ FlairGuard

### What is FlairGuard?
FlairGuard is a Reddit mod tool that automatically enforces moderation actions the moment a moderator applies a removal flair to a post. It eliminates the most repetitive part of moderating — typing the same removal reason over and over.

### The Problem
Moderators of large subreddits remove hundreds of posts every day. For each removal they must:

Click "Remove"
Open a document and copy a removal reason
Paste it as a comment
Lock the thread (if applicable)
Repeat 100+ times per day
### The Solution
FlairGuard turns flair application into a one-click workflow:

Mod applies "Rule 1 – Spam" flair
        ↓
FlairGuard detects the PostFlairUpdate event
        ↓
✅ Post auto-removed
✅ Templated removal reason posted as comment
✅ Thread optionally locked
✅ Author optionally notified via modmail
✅ Action logged to Redis for mod review
### Features
Feature	Description
Flair-triggered removal	Configurable flair names map to automatic removal actions
Templated comments	Custom removal reason text per flair, supports Markdown
Thread locking	Optionally lock the thread when removing
Modmail notification	Optionally send the author a private message with the reason
Settings dashboard	Mods configure rules via web UI — no code needed
Action log	Last 50 actions stored in Redis, viewable from mod menu
Deduplication	Redis-based dedup prevents duplicate actions
Welcome onboarding	Modmail sent on first install with setup instructions

## 25. Mod Stats — Moderation Analytics for Reddit Communities
A Devvit (Reddit's Developer Platform) app that watches your subreddit's mod log and publishes monthly dashboards, activity heatmaps, weekly digests, and optional Discord/Slack webhooks — all as native Reddit content with no external accounts or infrastructure.

### What you get
A monthly insights dashboard as a wiki page — ranked tables for top moderators, action breakdown, daily activity, and most-actioned users, each paired with an inline bar graph. Includes a Community Health Score comparing constructive actions to destructive ones.
A 3-month activity heatmap as three stacked monthly calendar grids with 5-level emoji intensity. Spot quiet weekends, unusual spikes, and uneven coverage at a glance.
A weekly modmail digest delivered every Monday — top mods, busiest day, action breakdown. Triggerable on demand from the subreddit menu.
Optional Discord and Slack webhooks — mod actions stream to your team chat in real time as rich embeds (Discord) or plain text (Slack), with per-community URL, action filters, ignore list, and role pings.
90 days of backfilled history on install — reports are useful from day one, not after a month of accumulated logs.
22 tracked mod action types, deduplicated by Reddit's action ID and bucketed in your subreddit's timezone.
All reports publish to subreddit wiki pages or modmail, which means you choose who sees them — mod-only, approved users, or fully public.

3. (Optional) Set up Discord or Slack webhooks
In the same settings panel:

Webhook URL — paste your Discord or Slack webhook
Webhook Enabled — toggle on/off
Notify Actions — pick which actions to stream (default: bans + removals)
Ignore List — comma-separated usernames to skip
Discord Role ID to Ping — optional @mention
Discord webhook: server settings → channel → Edit Channel → Integrations → Webhooks → Create Webhook → copy the URL.

Slack webhook: follow Slack's incoming-webhook guide.

4. View your stats
The main wiki page lives at: https://www.reddit.com/r/your-subreddit-name/wiki/mod-stats

The dashboard and heatmap live at: /wiki/mod-stats-dashboard and /wiki/mod-stats-heatmap

You can also trigger anything on demand from the subreddit menu:

📊 Update Stats Wiki Now — refresh the monthly stats page
📈 Open Dashboard — regenerate and open the dashboard
🔥 Open Activity Heatmap — regenerate and open the heatmap
📬 Send Weekly Digest Now — send the digest to modmail immediately
### Tracked actions
Category	Actions
Posts & Comments	Removals, approvals, spam removals
Users	Bans, unbans, mutes, unmutes
Content	Locks, unlocks, sticky, unsticky, distinguish
Team	Mod invites, removals, acceptances, permission changes
Wiki	Wiki bans, wiki contributor changes
Flair	Flair edits
### Automated schedule
Feature	Schedule	Output
Monthly stats wiki page	Daily (auto) or manual	Top mods, action breakdown, most-actioned users, daily activity
Weekly digest	Mondays 10:00 UTC (auto) or manual	Modmail PM with top 5 mods, busiest day, action breakdown
Discord/Slack webhook	Real-time (per action)	Color-coded embed (Discord) or plain text (Slack)
Dashboard	Manual (menu item)	Markdown wiki page with KPI summary and ranked tables
Heatmap	Manual (menu item)	Markdown wiki page with three monthly grids
### Settings reference
Setting	Type	Default	Description
Wiki Page Name	string	mod-stats	Base wiki path for all reports
Top N Moderators	number	10	How many mods to rank
Timezone	select	America/New_York	IANA timezone for date bucketing
Recent Actions Count	number	25	Recent action display limit
Webhook URL	string	(blank)	Discord or Slack webhook endpoint
Webhook Enabled	boolean	true	Master on/off
Notify Actions	string	banuser,unbanuser,...	Comma-separated, or all
Ignore List	string	(blank)	Usernames to skip in webhook notifications
Discord Role ID to Ping	string	(blank)	Optional role mention

## 26. Community Roster
Community Roster gives Reddit moderators the closest practical thing to a member database: an exportable roster built from moderator-accessible signals like user flair, approved contributors, wiki contributors, moderator-imported usernames, scanned post/comment activity, moderation log history, community invites, modmail participation, ModNotes, and subreddit karma.

Why It Exists
Moderators often know which members keep a community alive: long-time regulars, helpful answerers, local experts, event organizers, and people who deserve recognition or contributor access. The problem is that Reddit spreads those signals across separate tools:

user flair
approved contributors
wiki contributors
moderator-provided username lists
scanned posts and comments from new and top listings
moderation log history
community invites
modmail participants
ModNotes
subreddit karma
flair emoji data
external spreadsheets or Toolbox-era workflows
Community Roster pulls the accessible pieces into one moderator dashboard so a team can review, sort, label, and export the people who are already visible through moderation data.

### Important Limitation
Community Roster does not list every subscriber.

Reddit and Devvit do not expose a full subreddit subscriber/member list to apps. The roster is built from users the app can discover through supported moderator-accessible sources, currently user flair assignments, approved contributors, wiki contributors, moderator-imported usernames, authors from new and top post/comment listings, moderation log actions, recent modmail participants, and moderation log invite actions. Pagination helps scan those exposed sources in batches, but it cannot reveal subscribers or old inactive contributors that Reddit does not expose through those signals unless a moderator imports those usernames for enrichment.

### Current Functionality
Creates or opens a React dashboard inside a Reddit custom post.
Reuses a single stored dashboard post per community and tries to distinguish, lock, and remove it from the feed so it remains a mod-only tool surface instead of ordinary feed content.
Automatically scans the first roster batch when the dashboard loads.
Discovers known users from user flair assignments, approved contributors, wiki contributors, moderator-imported usernames, new/top post and comment activity, moderation log actions, recent modmail conversations, and community invite actions.
Supports opt-in partner community sharing through manual copy/paste bundles and Reddit-native dynamic snapshots, allowing cooperating mod teams to compare known fanbase/member context without sharing modmail bodies or ModNote text.
Requires explicit moderator consent before dynamic sharing: mods choose whether the community publishes snapshots, which fields are allowed, and which partner subreddits can be synced.
Lets moderators paste username lists so missing known members can be enriched with flair, subreddit karma, ModNotes, and approval status.
Stores modmail and invite metadata only: participant username, conversation/invite counts, dates, direction, states, and inviter names. It does not export modmail message bodies.
Summarizes moderation log history by count and date for approvals, removals, spam, bans, mutes, ModNotes, flair edits, and contributor changes.
Enriches each scanned batch with subreddit-specific post karma, comment karma, and total subreddit karma.
Reads ModNotes for known users and surfaces predefined note labels.
Shows ModNote creation dates in hover tooltips for note labels.
Shows dashboard metrics for known users, users with flair, approved contributors, wiki contributors, imported users, activity-discovered users, mod log users, modmail participants, invited users, and visible filtered rows.
Shows imported and synced partner community users as a searchable, filterable, sortable roster signal.
Keeps synced partner snapshots in a separate dashboard view so external users do not merge into the local community roster.
Supports batch pagination with previous/next controls.
Supports loading all scanned batches into the dashboard so table search, filters, and sorting can operate across the full discovered roster.
Filters by search text, approval status, flair presence, wiki contributors, imported users, scanned activity, mod log history, modmail participation, users who wrote mods, users mods wrote to, invited users, and ModNote label.
Sorts by user, karma, flair, approval status, and ModNote count.
Renders custom flair emoji images where Reddit exposes emoji image URLs.
Includes best-effort flair template IDs where assigned flair matches a known user flair template.
Exposes raw flair emoji references for cleanup and auditing.
Prepares roster exports as CSV/TSV text for Excel or spreadsheet tools.
Prepares a dedicated flair export with flair text, CSS class, emoji refs, emoji image URLs, approval status, and sources.
Lets moderators approve a user as a contributor and add a predefined HELPFUL_USER ModNote.
Lets moderators add predefined HELPFUL_USER or SOLID_CONTRIBUTOR ModNotes from the table.
### Devvit Surface
The app has one moderator menu action:

Create Community Roster dashboard
That action creates or reopens the custom post that hosts the dashboard.

The dashboard uses these app endpoints:

GET /api/roster for the cached roster
POST /api/roster/scan for scanning a roster batch
GET /api/roster/flair-export for the full flair export
POST /api/roster/import for persistent moderator-imported username lists
POST /api/roster/partner-share/import for importing opt-in partner community roster bundles
GET /api/roster/partner-share/status for dynamic partner sharing consent and snapshot status
POST /api/roster/partner-share/settings for saving per-community sharing consent, allowed fields, and partner subreddit allowlists
POST /api/roster/partner-share/publish for publishing the current community snapshot to a hidden mods-only wiki page
POST /api/roster/partner-share/sync for fetching allowed partner snapshots from partner subreddits
POST /api/roster/approve for contributor approval plus a helpful-user ModNote
POST /api/roster/note for predefined ModNote labels
### Partner Snapshots
Dynamic partner sharing is optional and off by default. The app still works without it, and manual bundle import/export remains available.

When a moderator enables sharing and publishes, Community Roster writes the latest consent-filtered snapshot to a hidden mods-only wiki page named community_roster_partner_snapshot in that subreddit. Sync reads that page from the partner subreddits the current community listed.

For consent, both communities should list each other as partners. A snapshot only imports when the publishing community included the syncing community in its partner list. Fields not explicitly allowed are blanked or zeroed, and partner-sourced rows are not re-shared transitively.

### Exported Data
Roster export fields:

username
subreddit karma, post karma, and comment karma
flair text and flair CSS class
flair template ID when it can be matched
flair emoji references and emoji image URLs
approved contributor status
discovery sources
scanned post/comment counts and first/latest scanned activity timestamps
moderation log approval/removal/spam/ban/mute/note/flair/contributor counts and first/latest action timestamps
modmail conversation count, direction flags, user/mod conversation counts, best-effort starter counts, first/latest modmail timestamps, user/mod activity timestamps, and conversation states
community invite count, first/latest invite timestamps, and inviter names when available from the mod log
partner community names, partner subreddit karma totals, and imported partner summary details
ModNote labels
ModNote label/date details
last ModNote timestamp
Flair export fields:

username
flair text
flair CSS class
flair template ID when it can be matched
flair emoji references
flair emoji image URLs
emoji count
approved contributor status
discovery sources

## 27. ModRelayHQ
One reviewed mod action, relayed across the communities you already moderate.

ModRelayHQ is a private moderation console for moderators who manage multiple related subreddits. It helps mods check a user's ban and approved-user status across a configured community network, then relay reviewed user-management actions across selected communities they already moderate.

ModRelayHQ does not replace Reddit's mod queue. It handles the cross-community user-management work that normally has to be repeated manually across multiple communities.

Every Relay Action is built for human-reviewed moderation. ModRelayHQ checks permissions, shows a dry-run preview before anything can apply, skips communities that are not ready, records an audit log, and offers undo where possible.

The app supports:

Sync Ban
Sync Unban
Sync Approved User
Sync Remove Approval
User Case File lookup across selected communities
Community groups for related subreddits
Permission-checked relay workflows
Audit log-backed action history
Moderator-only quick actions that prefill relay workflows from posts and comments
ModRelayHQ does not automatically apply bans or other user actions in the background. A moderator must review the action and confirm before anything is applied.

## 28. Triage - Severity-Sorted Mod Queue for Reddit
The mod queue treats a death threat and a repost identically. Triage doesn't.

Triage applies the same principle emergency rooms use — sort by urgency, treat the worst first — to your Reddit mod queue. Urgent reports surface at the top. Routine spam sinks to the bottom. Mods approve or remove without ever leaving the tool.

### The Problem
Reddit's mod queue is chronological. A post from someone in crisis sits behind forty spam reports. A doxxing attempt waits its turn after a wrong-flair complaint. Moderators — most of them unpaid volunteers — spend the first minutes of every session manually hunting for what actually needs attention.

For large subreddits, this isn't inefficiency. It's a burnout driver and a safety risk. Mods miss critical content not because they're absent, but because the queue gives them no signal about what needs them right now.

### What Happens When You Install Triage
Your mod queue gets sorted into three tiers automatically:

Tier	Examples
Urgent (red)	Threats, self-harm, doxxing, CSAM, harassment, any mod-flagged report
Review (orange)	Misinformation, impersonation, NSFW violations, rule infractions
Routine (grey)	Spam, reposts, wrong flair
Within each tier, the oldest items surface first — so nothing ages out unseen.

Open Triage and the most dangerous content in your queue is already at the top. No sorting. No scanning. No missed crises.

### Crisis Detection
When Triage detects self-harm or suicide language in a queued report, two things happen simultaneously: a red banner appears at the top of the interface, and a modmail alert goes to your entire mod team — even if no one is actively watching the queue.

For subreddits where people come when they're struggling, this isn't a convenience feature. It's the reason the tool exists. A post from someone in immediate danger shouldn't sit unseen for an hour because it arrived during off-peak hours.

The alert is rate-limited to once per 30 minutes to prevent fatigue. Your team gets notified once, urgently, rather than repeatedly.

### Key Features
Inline moderation — Approve or remove any item directly in Triage. No tab switching. Actions sync back to Reddit immediately.

Action history with undo — Every action is logged in a persistent sidebar. Mistakes can be undone within 2 hours — critical when moving fast through a large queue.

Custom keyword configuration — Define your own urgent and review trigger words per subreddit, without touching code. A mental health community and a gaming community have different threat models. Triage adapts to yours.

Auto-refresh — Queue refreshes every 60 seconds automatically. New urgent items flash the Priority column border to draw attention.

Real-time sync — When a mod actions a post in Reddit's native queue, Triage removes it immediately. No stale items.

Weekly digest — Automatic modmail every Monday summarizing queue volume, tier breakdown, and crisis detections. Turns Triage from a reactive tool into a data layer for understanding your community over time.

### Who Benefits Most
r/mentalhealth (1.1M members) — Posts from people in active crisis arrive daily. With a chronological queue, a self-harm post can sit behind dozens of routine reports before a mod sees it. Triage surfaces it immediately and alerts the whole team by modmail — even overnight.

r/politics (8M members) — During breaking news, report volume spikes sharply and coordinated harassment campaigns hide inside the noise. Triage surfaces the coordinated attacks above the off-topic complaints automatically, letting the mod team respond to the actual threat instead of clearing spam first.

r/teenagers (2.7M members) — High volume, significant self-harm risk, and a volunteer mod team that can't watch the queue around the clock. Triage is designed exactly for this profile: automated severity sorting plus crisis alerts means the most vulnerable posts reach a human moderator faster.

Configuration (Optional)
Setting	What it does	Example
custom_urgent_keywords	Additional words that trigger Urgent	overdose,slur,raid
custom_review_keywords	Additional words that trigger Review	debate,controversial
routine_as_urgent	Promote normally-routine reasons to Urgent	spam,repost
urgent_as_routine	Demote normally-urgent reasons to Routine	self-harm
The last setting exists specifically for communities like r/SuicideWatch where self-harm content is the subject of the community, not a violation. Triage adapts to context rather than imposing a one-size-fits-all threat model.

Project Status
Built on Devvit Web — compliant with the March 2026 deprecation of Devvit Blocks
Builds and deploys without errors
Tested on live subreddit with real mod queue data
Scheduler, triggers, Redis cache, crisis detection, action log, and undo all verified end-to-end

## 29. Redact Helper Bot
Redact Helper is a specialized moderation tool designed to automatically detect and remove spam or unwanted content containing the redact spam from your subreddit. It provides both real-time protection and a powerful retroactive cleanup tool.

### Key Features
1. Real-Time Protection (Automatic)
The bot monitors your subreddit 24/7. It automatically removes any new or edited content that contains the word "redact":

Posts: Scans both titles and bodies.
Comments: Scans all new and updated comments.
Case-Insensitive: It catches "redact", "REDACT", "Redact", etc.
Spam Marking: Items are removed and marked as spam to help train Reddit's filters.
2. Retroactive Cleanup (Manual)
If your subreddit already has a backlog of "redact" content, you can trigger a deep scan of the subreddit history.

How to use: Go to your subreddit's main page, click the three-dot menu (top right), and select "Clean Redact".
Deep Scan: This triggers a background process that walks through the subreddit's history, checking every post and its top-level comments.
Automatic Loop: The cleanup runs in safe batches to avoid platform timeouts. It automatically reschedules itself until it has scanned as far back as the Reddit API allows.
Progress Tracking: Mods will see a toast notification when the process starts. Detailed progress and final removal counts are recorded in the app logs.
### Why use this bot?
Efficiency: Manually hunting for specific spam keywords is time-consuming. This bot automates the entire process.
Exhaustive: Unlike simple keyword filters, the manual cleanup tool ensures that even older content hidden in your history is found and removed.
Moderator Only: The cleanup tool is restricted to moderators, ensuring only authorized users can trigger the purge.

## 30. ecidivWatch — Repeat Offender Tracker for Reddit
Automatically track repeat rule-breakers and alert your mod team before they cause more damage.

Reddit's built-in tools let mods remove individual posts and comments — but they have no memory. AutoModerator can't track patterns over time. Every time a user reoffends, mods have to manually dig through their history to figure out if this is the third or the tenth violation.

RecidivWatch fixes this. It runs silently in the background, counting every mod removal per user and sending instant modmail alerts when someone hits your warning, temp ban, or permanent ban thresholds — complete with their full violation history and a direct ban link.

### Features
Automatic violation tracking
Every post and comment removed by a moderator is recorded against the author's profile. RecidivWatch stores the content preview, timestamp, content ID, and which mod took the action.

Three-tier alert system
Alerts escalate automatically based on configurable thresholds:

Level	Default trigger	Action
⚠️ Warning	3 removals in 7 days	Modmail alert sent
🚫 Temp Ban	5 removals in 7 days	Modmail with ban link
⛔ Perm Ban	3 temp ban alerts triggered	Modmail with ban link
Each alert includes the user's full violation history, recent violations, removal timestamps, content previews, and a direct link to ban the user.

Smart alert logic
Cooldown: Alerts won't repeat within 24 hours for the same user at the same level — no spamming your mod team on every removal
Escalation memory: Once a warning is sent, it won't fire again. The next alert jumps straight to temp ban
Perm ban based on repeat offending: Permanent ban is recommended after a user has triggered 3 temp ban alerts — not just a raw removal count. Users who space out violations still get escalated eventually
Deduplication: The same content removal can't be counted twice even if multiple events fire
Right-click mod menu
Available on every post and comment for moderators:

🔍 View User History — sends a full violation report to modmail instantly
🔄 Reset User Record — clears a user's entire record (for reformed users or false positives)
Optional auto temp-ban
Disabled by default. When enabled, RecidivWatch will automatically execute the temp ban instead of just recommending it. Mods still receive the modmail alert either way.

Trusted flair exemptions
Users with specific flair texts (e.g. Moderator, Verified, Contributor) can be excluded from tracking entirely.

Bot detection
Accounts ending in Bot or _bot (case-insensitive) are automatically skipped.

### How alerts work
⚠️ Warning modmail
Subject: ⚠️ RecidivWatch WARNING — u/username (3 removals in 7d)

User: u/username
Recent removals: 3 in the past 7 days
All-time removals: 3
Temp bans triggered: 0

This user has reached the warning threshold (3 removals).
No automated action has been taken. Mods may review and act at their discretion.

Recent Violations (last 7 days: 3)
1. [POST] Sat, 10 May 2026 08:00:00 GMT
   Content: "post title here"
   ID: t3_xxxxxx | Mod: u/modname
...
🚫 Temp ban modmail
Subject: 🚫 RecidivWatch TEMP BAN — u/username (5 removals in 7d)

User: u/username
Recent removals: 5 in the past 7 days
All-time removals: 5
Temp bans triggered: 1

A temporary ban of 3 day(s) is recommended.
Action: [Ban u/username](https://www.reddit.com/r/yoursubreddit/about/banned)
...
⛔ Perm ban modmail
Subject: ⛔ RecidivWatch PERM BAN — u/username (3 temp bans)

User: u/username
All-time removals: 15
Temp bans triggered: 3

This user has been temp banned 3 times, reaching the permanent ban threshold.
Action: [Ban u/username](https://www.reddit.com/r/yoursubreddit/about/banned)

This alert will not be sent again.
...
### Configuration
All settings are configurable per subreddit under Mod Tools → Settings → Installed Apps → RecidivWatch.

Setting	Default	Description
Warning Threshold	3	Removals in the lookback window to trigger a warning
Temp Ban Threshold	5	Removals in the lookback window to trigger a temp ban alert
Perm Ban Threshold	3	Number of temp ban alerts before a perm ban is recommended
Lookback Window (Days)	7	Rolling window for counting recent violations
Temp Ban Duration (Days)	3	Suggested ban duration shown in modmail
Alert Cooldown (Hours)	24	Minimum hours between alerts for the same user at the same level
Auto Temp-Ban	Off	Automatically execute temp bans instead of just recommending
Trusted Flair Texts	(empty)	Comma-separated flair texts exempt from tracking

## 31. Mod Triage Board
Mod Triage Board is a collaborative moderation workflow app for Reddit, built on Devvit. It turns your subreddit’s modqueue into a simple shared board so your mod team can see who is handling what, avoid doubling up on the same report, and keep context in one place—without replacing Reddit’s normal mod tools.

What problem does it solve?
When several moderators work the same queue, it’s easy to lose track of:

whether someone is already investigating an item
who claimed something and what happened next
notes and context for the next shift or teammate
Mod Triage Board adds a light coordination layer on top of the modqueue: ownership, optional collaborators, private mod notes, and a short activity history—so the team stays aligned while you still use Reddit for approve, remove, ban, modmail, and everything else.

### The board in three columns
Column	Meaning
Unclaimed	In the modqueue, but nobody has taken ownership yet.
In Progress	A moderator claimed it; the team can see who owns it (and any collaborator).
Resolved	The coordinated triage is done; the item is archived on the board for reference.
The flow is kept simple on purpose—closer to a shared whiteboard than a heavy ticketing system.

See it in action
The shared board — live items from your modqueue in Unclaimed, In Progress, and Resolved.

Mod Triage Board showing the three workflow columns

Ownership and workflow — claim items so everyone knows who is on it.

Board view with in-progress ownership and workflow details

Collaborators — invite another mod onto an active item for second opinions, sensitive cases, or handoffs across time zones.

Collaborator visible on a moderation card

Resolved work — see what was recently finished without cluttering the main queues.

Resolved column with completed items

### What you can do (in plain terms)
Claim an unclaimed item so it moves to In Progress and shows you as owner—less duplicate work, clearer accountability.
Invite a collaborator from your mod team so two of you can work the same investigation; either of you can resolve when you’re done.
Add internal notes only visible inside the board—findings, policy reminders, follow-ups for the next mod.
Skim activity history—claimed, released, collaborator changes, resolved, reopened—so nobody has to ask “what already happened?” in a separate chat.
Spot stale items—cards look more urgent the longer something sits open (a visual nudge, not a strict rule).
Use it on mobile—layout and touches are tuned for Reddit’s in-app webview; copy permalink uses the clipboard so you can open the thread in your browser when you need to.
### Typical flow
A report shows up in the modqueue.
A mod opens Mod Triage Board from the subreddit menu.
Someone claims the item.
If needed, the owner adds a collaborator and notes.
The team sees activity and ownership on the card.
When coordination is done, the item is marked resolved on the board.
You still use Reddit’s own tools for removing posts, approving, spam, locks, bans, and modmail—this app is for coordination and visibility, not for replacing those actions.

### Who it’s especially useful for
Medium or large mod teams
High-volume communities
Mods in different time zones
Situations where you need shared context (harassment, brigading, ban evasion, sensitive decisions, multi-step reviews)
### What we deliberately avoid
No enterprise ticketing, no rigid escalation trees, no pretending to be a full replacement for Reddit moderation. Goal: less duplicate effort and easier coordination on the queue you already have.

## 32. 🛠️ ModGather
Reddit metadata at your fingertips.
ModGather is a simple yet essential utility for moderators who need to dive deep into the technical details of posts and comments. Stop inspecting page source or digging through complex menus; get all the relevant metadata instantly in a clean, organized format.

🌟 Key Features
2-Mode-View Interface:
  - Form Mode: A clean, human-readable layout for quick inspections.
  - Minified JSON Mode: Perfect for developers or for copying data into external audit logs and spreadsheets.

Moderation Transparency: Access precise UTC timestamps for approvals and removals that aren't always visible in the standard UI.

Report Analysis: View specific report reasons and the status of reports (e.g., if they are being ignored or processed).
📊 Data Insights
ModGather extracts and formats critical information across three main categories:

Identification & Time	Moderation Status	Metrics & Flags
• Unique ID	• Approval Status	• Score & Karma
• Created At (UTC)	• Banned/Approved At (UTC)	• Number of Replies/Comments
• Direct URL	• Report Reasons	• Is Edited / Is Stickied
• Author Details	• Removed by Category	• Crowd Control Status
🚀 How It Works
Navigate to the post or comment you wish to investigate.

Activate ModGather from your moderator toolbox.

Choose the view-mode: Form or minified JSON

Review the structured data in the form view.
Copy the minified JSON if you need to document the case in a coordination subreddit or external database.

## 33. AuraCouncil

AuraCouncil acts as an "Aura AI", analyzing user post drafts before they are submitted. It evaluates rule compliance, tone, and engagement potential, providing users with constructive feedback and "Examples for Inspiration" rather than rigid automated overrides. For moderators, it offers unparalleled transparency and configuration, ensuring community standards are met while reducing the manual moderation burden.

## 34. aisafemod
AI-powered comment moderation for subreddits. Uses OpenAI's omni-moderation model to flag and remove rule-violating comments automatically, with per-category thresholds you control.

### What it does
For every comment posted or edited on the subreddit:

Skips moderators (and optionally approved users) so they are not auto-moderated.
Sends the comment text to OpenAI's Moderation API.
Compares each of 13 category scores against a per-category threshold you configure.
If any threshold is crossed, removes the comment and adds a moderator note in the modqueue with the triggering category and score.
Comments scoring below all thresholds pass through untouched.
The app supports both new comments and edits. Comment text is hashed for idempotency so the same comment is never double-processed; an edit re-runs the full pipeline against the new text.

### Categories detected
OpenAI's omni-moderation classifies content into 13 categories. You can enable, disable, and tune the threshold for each independently:

sexual, sexual/minors
harassment, harassment/threatening
hate, hate/threatening
violence, violence/graphic
self-harm, self-harm/intent, self-harm/instructions
illicit, illicit/violent
Defaults are aggressive (0.015 for sexual, harassment, hate, violence categories; 0.10 for self-harm and illicit categories). Lower the threshold for stricter moderation, raise it for more leniency.

### Configuration
Per category, you control:

enabled (toggle): when off, the category is ignored entirely (always pass).
threshold (0.0 to 1.0): comment is removed when its score on this category is at or above this value.
Subreddit-level toggle:

Bypass approved users (default on): when on, approved users are exempt from AI moderation along with moderators. When off, only moderators are exempt; approved users go through the full pipeline.
### What happens to flagged comments
Removed comments appear in your Mod Queue with a removal note containing the AI-detected category and score (for example: AI:REMOVE | sexual=0.781). You can:

Approve the comment to restore it (the app will not act on the same comment again unless the body is edited).
Confirm the removal.
Take additional actions (ban the user, lock the thread, etc.) as you would with any other moderator action.
The app never bans users automatically. It only removes individual comments.

### Limitations
OpenAI's Moderation API is best calibrated for English. Multilingual content (especially Russian, Arabic, Turkish) may produce different score distributions. Tune thresholds based on your subreddit's primary language.
The app does not detect spam, misinformation, or off-topic content. AutoMod and human moderation remain necessary.
The app does not detect images. Only text content is classified.
During an OpenAI outage, the app fails open: comments pass without classification, no false removals. Your AutoMod rules continue to apply normally.
Rate limit (Tier 1 free: 7 RPM, Tier 2: 500 RPM). When the limit is hit within a minute, additional comments pass through without classification until the next minute window.

## 35. GuardHub - Filter Guard 🛡️
### Purpose
Filter Guard is the grouped moderation app for threshold-based and gate-style filtering rules. It provides flexible AutoModerator-style logic for complex community gates that combine multiple safety thresholds into single decision points.

### Major Features
Combined Thresholds: Create rules that require multiple conditions (e.g., Age > 7 AND Karma > 100).
Flexible Gating: Supports satisfyAll (AND) and satisfyAny (OR) logic for threshold groups.
Safety Thresholds: Integrated Safety Filter levels (low, medium, high) to catch spam and harassment.
### Logic & Behavior
Grouping: Collects multiple metadata signals into a "Gate".
Evaluation: Applies Boolean logic (AND/OR) across all thresholds in a rule.
Dry Run & Audit Logs: Safely test complex gates in Audit mode before enforcing them live. Matches are logged to the gh:logs namespace.
### Product Boundaries
Filter Guard focuses on logic-heavy threshold groups and community gates.
It complements User Guard by providing multi-variable conditions rather than simple attribute matching.
## 36. GuardHub - User Guard 🛡️
### Purpose
User Guard provides high-precision control over who can participate in your community. It replaces complex AutoModerator rules with a deterministic, priority-based identity engine and a clean dashboard interface.

### Major Features
Identity Gating: Exact username allowlists and blocklists.
Maturity Thresholds: Minimum account age (days) requirements.
Community Reputation: Subreddit-specific karma thresholds (post and comment).
Priority Resolution: "First matching rule wins" logic for transparent policy ordering.
### Logic & Behavior
Author Resolving: Fetches real-time account metadata (age, karma) upon event trigger.
Evaluation: Compares author stats against configured rule thresholds.
Dry Run & Audit Logs: Safely test thresholds in Audit mode before enforcing them live. Matches are logged to the gh:logs namespace.
### Product Boundaries
User Guard focuses exclusively on author attributes and identity.
It does not evaluate the content of the post (see Word Guard) or the domains linked (see Domain Guard).
## 37. Tool Overview
The Community Health Dashboard is a Devvit-powered moderation tool designed to help Reddit moderators monitor, analyze, and improve the overall health of their communities through real-time insights and analytics. The app integrates directly into the moderator workflow through the Reddit mod menu, providing an easy-to-access dashboard that surfaces key moderation and engagement metrics in a single interface.

The dashboard focuses on giving moderators actionable insights instead of raw data, helping them quickly identify trends, moderation bottlenecks, and community engagement patterns.

### Core Functionality
Health Score Tracking
The app calculates and displays an overall community health score using multiple subreddit activity indicators. Moderators can quickly understand the current state of their community without manually reviewing several moderation pages.

This includes:

Community engagement levels
Moderation activity balance
User participation trends
Overall subreddit activity consistency
Moderation Workload Analysis
The dashboard helps moderators understand moderation demand over time by analyzing moderation logs and actions.

Capabilities include:

Tracking moderation activity volume
Identifying spikes in moderation workload
Understanding moderation trends over time
Helping teams allocate moderator effort more effectively
This allows moderator teams to identify periods of high activity and better organize moderation schedules.

Retention & Engagement Analytics
The app provides insights into how users interact with the subreddit over time.

Moderators can:

Monitor returning user activity
Identify engagement trends
Understand retention patterns
Detect drops or improvements in community participation
These insights help moderators evaluate whether rule changes, events, or community initiatives are positively affecting user engagement.

Trend Visualization
The dashboard presents historical data through visual analytics such as graphs and trend indicators.

This allows moderators to:

Compare short-term and long-term subreddit performance
Detect sudden activity changes
Identify growth or decline patterns
Make data-driven moderation decisions
Real-Time Data Refresh
The tool continuously refreshes dashboard metrics using Reddit API data to ensure moderators are viewing up-to-date community information.

Performance Optimization
The app includes caching and performance optimizations to ensure fast dashboard loading and smooth interaction, even for larger communities with high moderation activity.

### Moderator Workflow
Moderators use the app through a dedicated “Health Dashboard” option integrated directly into the subreddit moderation menu.

Typical usage flow:

Open the moderation menu
Launch the Health Dashboard
Review current health metrics and trends
Analyze moderation workload and engagement data
Use insights to guide moderation decisions and community management strategies
### Intended Audience
The app is specifically designed for:

Active moderation teams
Growing communities
Large subreddits with frequent moderation activity
Communities focused on engagement and retention improvement
Access is restricted to moderators to ensure moderation analytics remain private and secure.

### Project Impact
Community & Moderator Benefits
Reduces time spent manually reviewing moderation logs and analytics
Helps moderators quickly identify unhealthy trends before they escalate
Provides centralized analytics instead of requiring multiple Reddit tools
Supports data-driven moderation decisions
Improves moderator coordination by visualizing workload trends
Helps communities maintain healthy engagement and retention patterns
Enables faster response to activity spikes or engagement drops
Overall, the app helps moderators spend less time gathering data and more time improving community quality and user experience.

## 38. Ban Appeal Manager
A Devvit app for Reddit that gives banned users a fair, structured way to appeal — and gives mod teams one place to review, decide, and log every action.

App listing: https://developers.reddit.com/apps/unbanlab

### The problem
Ban appeals on Reddit have no standard process. Users DM random mods, mods reply inconsistently, nothing is logged, and there is no way for the broader mod team to weigh in. Large subreddits handle hundreds of bans — and appeals slip through the cracks constantly.

What Ban Appeal Manager does
A mod creates one pinned "Ban Appeals" post using the app's mod menu item. That post becomes the single entry point for everything.

For banned users:

A simple form to explain their case and provide context
A live status view showing whether their appeal is Pending, Under Review, Approved, or Denied
A mod response shown directly on the status screen once a decision is made
A "Refresh status" button to check for updates without reloading the page
A private message notification the moment a mod makes a final decision
For moderators:

A dashboard showing all appeals with status counts (Pending / In Review / Approved / Denied)
Status filters and username search, with pagination for large queues
Full appeal detail view: user's reason, original ban reason, any additional context
A voting system so multiple mods can weigh in before a decision is locked in
One-click approve (which auto-unbans the user) or deny, with a required mod note
Internal notes visible only to the mod team — not sent to the user
A full audit log on every appeal showing every vote, status change, and notification
A settings panel to configure vote thresholds, re-appeal cooldown, and notifications
Automatic closure of appeals with no mod action after 30 days
How to install and use it
Go to https://developers.reddit.com/apps/unbanlab
Choose your subreddit
Grant the app moderator permissions when prompted (required for auto-unban)
Create the appeal post
Go to your subreddit
Open the mod menu (three dots or "Mod Tools")
Click Create Ban Appeal Post
Pin the post that appears — this is where users will submit appeals
Reviewing appeals
Open the pinned post as a mod. The dashboard loads automatically. Click any appeal row to open the detail view, vote, add internal notes, and make a final decision.

Technical overview
Built entirely on Devvit (Reddit's Developer Platform):

UI: Devvit Blocks (vstack / hstack / text / button — no HTML or CSS)
Storage: Redis via context.redis — all appeals, votes, audit logs, and settings
APIs used: reddit.unbanUser, reddit.sendPrivateMessage, reddit.getModerators, reddit.getBannedUsers
Scheduler: A daily job (close-stale-appeals) auto-closes appeals with no action after 30 days
Trigger: AppInstall trigger registers the scheduler automatically on install
Project structure
src/
├── main.tsx              App entry point — post type, menu item, scheduler, trigger
├── types.ts              All TypeScript interfaces and types
├── storage.ts            Redis read/write helpers
├── constants.ts          Redis key names, status colors, audit icons
├── utils/forms.ts        Type-safe form value helper
├── components/
│   ├── Header.tsx        Top navigation bar
│   ├── StatusBadge.tsx   Colored status pill
│   ├── AuditLog.tsx      Audit timeline component
│   └── VotingPanel.tsx   Mod vote tally and vote buttons
└── views/
    ├── UserForm.tsx       Appeal submission form (user)
    ├── UserStatus.tsx     Appeal status screen (user)
    ├── ModList.tsx        Appeals dashboard with filters and pagination (mod)
    ├── ModDetail.tsx      Full appeal detail with voting and decisions (mod)
    └── Settings.tsx       App settings panel (mod)
Redis schema
Key	Type	Value
appeal:{id}	String	JSON-encoded BanAppeal object
appeals:all	Sorted set	Appeal IDs scored by submission timestamp
user_appeal:{username}	String	Active appeal ID for this user
settings:main	String	JSON-encoded AppSettings
errors:log	Sorted set	Error log entries scored by timestamp

## 39. ReputiBot
AI-powered trust scoring for Reddit moderators. Tracks user behavior, computes reputation scores, and provides AI-driven risk assessments via mod notes.

### What it does
ReputiBot passively builds behavioral profiles for every user in your subreddit. When a mod needs to evaluate someone, one click generates a full trust report with AI analysis — saved privately to Reddit's native mod notes.

Passive scoring (automatic)
Tracks every post/comment, building per-user profiles
Monitors mod actions (removals, approvals) to learn what's good/bad
Tracks reports against users
Computes a 0-100 trust score from three dimensions:
Tenure — time active in this subreddit
Activity — post/comment volume
Reliability — approval vs removal ratio
On-demand AI analysis (mod-triggered)
Right-click any post/comment → "ReputiBot: Check trust score"
Fetches recent content, sends to GPT-5-nano for behavioral analysis
Saves the full report as a private Mod Note
Labels users: SPAM_WARNING, SPAM_WATCH, or SOLID_CONTRIBUTOR
Automated protection
Auto-filter or auto-remove posts from high-risk users
Weekly digest posts showing lowest-trust users
All thresholds configurable per-subreddit

### Configuration
After installing, moderators can configure via app settings:

Setting	Default	Description
Medium Risk Threshold	40	Users below this are flagged
High Risk Threshold	20	Users below this trigger auto-actions
Auto-Action	None	What to do with high-risk users (none/filter/remove)
Tenure Weight	30	How much sub tenure matters
Activity Weight	30	How much activity matters
Reliability Weight	40	How much mod history matters
Weekly Digest	Enabled	Post weekly trust reports
### How scoring works
Score = (Tenure × weight + Activity × weight + Reliability × weight) / total_weight + age_bonus

Tenure:      0-100 based on days active in this sub (max at 30 days)
Activity:    0-100 based on posts + comments (max at 20 contributions)
Reliability: 0-100 based on removal ratio (penalizes removed content heavily)
Age bonus:   0-10 based on Reddit account age (max at 1 year)
Scores are recalculated on every post, comment, report, and mod action.

## 40. 🌿 ZenQueue-Mod
The Structured Appeal Gateway for Reddit Moderators
"Replacing Modmail chaos with structured, humane moderation."

The Problem Nobody Talks About
There's a moment every Reddit moderator knows.

You remove a post. Maybe it broke Rule 3. Maybe it was spam. The reason doesn't matter much — what comes next is always the same. Within minutes, your Modmail lights up. The message isn't a question. It isn't a calm request for clarification. It's a wall. Angry, unstructured, emotionally raw — and it's aimed directly at you, a volunteer who gives their time to keep a community functional.

You didn't sign up to be a punching bag. But here you are, again, at 11pm, arguing with a stranger about a post that broke a rule they never read.

This is moderator burnout. It's quiet, it's accumulative, and it's the #1 reason mod teams collapse. Reddit has excellent tools for taking moderation actions. It has almost nothing to help mods survive the aftermath.

ZenQueue was built for the aftermath.

What ZenQueue Does
ZenQueue intercepts the moment between a moderation action and the inevitable emotional response. Instead of letting a frustrated user fire off an unstructured rant directly to your Modmail, it routes them through a calm, structured, time-gated appeal system built entirely inside an immersive, fullscreen Reddit App.

No external services. No AI black boxes. No third-party servers that go down at 3am.

Just a fair, transparent process that protects moderators, keeps your Modmail archive pristine, and gives users a genuinely better way to be heard.

### How It Works
For Users — The Cool-Down Portal
The moment a moderator removes a post or issues a ban, ZenQueue quietly steps in. The user receives an official Modmail (sent securely as the Subreddit Mod Team) directing them to their personal ZenQueue portal.

Mandatory Timers: Users cannot immediately rage-appeal. Post removals trigger a 15-minute cool-down, while bans trigger a 2-hour hold. The appeal button stays visually locked until the countdown reaches zero. Most toxicity is written in the first five minutes of anger; ZenQueue simply waits those minutes out.
Structured Forms: Once unlocked, users cannot write walls of text. They must select a predefined category (e.g., "I misunderstood the rule") and provide a strict 250-character explanation.
Ban-Specific Flows: If the user is banned, the app dynamically asks an additional mandatory question: "How will you contribute positively to this community moving forward?" This shifts the tone from defensive to constructive.
For Moderators — The Triage Dashboard
Mods don't deal with a chronological mess of unread Modmails. They click "Open Portal" to launch an immersive, fullscreen dashboard to find absolute order.

Smart Sorting: Appeals are grouped by context and category.
First Offense Badges: Instantly see if a user has never broken a rule before (🏅 First Offense).
De-Escalation Notes: Don't just hand out a blunt "❌ DENY". When denying an appeal, moderators can type a custom "Mod Note" that gets appended to the final resolution message.
One-Click Resolutions: Click ✅ Approve & Restore and ZenQueue automatically unbans the user or restores their post via the Reddit API. The queue clears itself, the user is notified, and the loop closes perfectly.
🛡️ Safety & Bypass Prevention
ZenQueue is deeply integrated with native Reddit safety features:

The Modmail Interceptor: If a user with an active appeal tries to send a direct Modmail, ZenQueue instantly auto-replies (telling them to wait for the timer) and automatically archives the conversation so it never clutters your Mod Inbox.
Native UGC Reporting: When a user submits an appeal, their exact text is automatically forwarded to the active Modmail thread as an internal note. This ensures all User-Generated Content is permanently archived and natively reportable to Reddit Trust & Safety.

## 41. Sky For Redbrain
A Devvit-based moderation assistant that scores, prioritizes, and explains risky posts and comments to reduce moderator workload.

### Overview
Sky For Redbrain operates completely within Reddit's infrastructure, using the Devvit platform to listen to events, perform logic, and provide a user interface directly in a subreddit.

When a user posts or comments, Sky For Redbrain analyzes the content using heuristics (keywords, domains, repeated patterns) and a machine learning (ML) text classification engine to assign a risk score. All scoring operations are optimized to complete within sub-100ms latency using parallel execution and lightweight models. The result is stored securely using Devvit's Redis client. Moderators can then access the Sky For Redbrain dashboard to review content grouped by risk.

Crucially, when a moderator "Approves" or "Removes" an item, the system learns from the decision by dynamically adjusting the internal risk weights of the keywords, domains, and the ML model parameters via gradient descent. Updates are batched and rate-limited to prevent instability.

Key Differentiators
Adaptive Learning: Unlike static AutoModerator rules, Sky For Redbrain evolves based on moderator decisions.
Prioritized Moderation: Instead of a flat queue, moderators focus on high-risk content first, broken down by dynamic thresholds.
Explainable AI: Every decision is transparent, showing exactly what keywords, domains, or ML tokens contributed to the final score, increasing moderator trust.
Lightweight ML: Designed specifically for low-latency execution inside Devvit constraints without heavy external API calls.
### Features
1. Enhancing the Moderator UI/UX (Dashboard)
Bulk Actions: Moderators can select multiple items via checkboxes and use the "Approve Selected", "Remove Selected", or "Ignore Selected" floating action bar at the bottom to drastically speed up queue processing.
Inline Editing/Context: A "View Context" button opens a Devvit modal overlay showing the post and its body text, allowing mods to make decisions without leaving the dashboard or losing their place.
Historical Log / Undo: A "History" tab tracks the last 50 actions taken by the AI or moderators. An "Undo" button instantly reverts the Reddit action.
Visualizing "Why": The UI actively highlights the specific risky words (keywords, domains, or specific semantic tokens) in yellow directly in the paragraph preview to immediately draw the eye to the problem.
2. Improving the AI & Learning Loop
"Not Sure" / "Ignore" Button: Added an "Ignore" button that lets moderators dismiss a post from the pending queue without artificially skewing the ML weights if a post is in a gray area.
Subreddit-Specific Whitelists: Mod Tools now feature a Whitelist Terms setting where moderators can manually type in domains or usernames that should never be flagged (e.g., the official domain of the subreddit's brand), completely bypassing the ML model to prevent false positives.
Explainable Confidence: Instead of just showing Confidence: 75%, a tooltip explains why confidence is low or high (e.g., "Relying mostly on rules during initial training phase").
Decay Settings: Moderators can choose how fast the AI "forgets" old spam trends via the Mod Tools settings (Slow, Standard, or Aggressive decay rates).
3. Deeper Reddit Integration
Modmail Notifications: If the system is unsure (e.g., Risk is high but Confidence is < 50%), it automatically sends a Modmail with a link to the dashboard saying, "Sky For Redbrain: Suspicious Post Needs Review."
Automated Flairing: Medium Risk posts can automatically be assigned a hidden "Requires Review" post flair text via the settings.
Shadowbanning / Crowd Control: High Risk comments can be configured to use the Reddit Spam filter instead of standard removal, effectively hiding them from users while keeping them visible to mods.
4. Developer / Backend Optimizations
Export/Import Models: Moderators can export their subreddit's learned ML weights (Keywords, Domains, Phrases, ML Tokens) as a raw JSON string via the UI and share them with sister subreddits. Another subreddit can paste that JSON to instantly train their model to block the same scams.
Scheduled Pruning: A background Devvit process runs periodically to automatically clean up pending posts in the dashboard that are older than 7 days, keeping the Redis KV store extremely fast and the UI uncluttered.

1. Triggers and Entry Points (src/server/index.ts)
Sky For Redbrain hooks into Reddit events through Devvit Web trigger endpoints. Specifically, it listens to onPostCreate and onCommentCreate. Whenever content is submitted:

It fetches the author's age and karma.
It fetches the subreddit's specific Sky For Redbrain settings (Sensitivity, Auto-remove toggles, and ML scoring toggles).
It passes this data to the Scorer.
If the final score exceeds the dynamically generated threshold based on sensitivity and the engine has a confidence >= 0.70, Sky For Redbrain uses the Reddit API to automatically remove the post (using asApp() background permissions). Auto-removal is conservative and can be disabled; all actions are reversible.
It automatically ignores its own UI posts (e.g., "Sky For Redbrain - Dashboard") to prevent infinite queue recursion.
It saves the item data and updates global analytics counters in Redis. Analytics updates use optimistic retry logic to mitigate race conditions under concurrent events.
2. Hybrid Scoring Engine (src/core/scorer.ts)
To keep latency low, the engine evaluates new content using parallel execution (Promise.all) of two distinct layers. The final score is a hybrid merge (ML: 70%, Rule Engine: 30%). Note: During the initial training phase (the first 20 processed actions), the weight dynamically shifts to Rule Engine: 80%, ML: 20% to prevent false positives while the local model learns.

Layer A: Rule Engine
Keyword Matching: Configurable weights for flagged terms.
Domain Matching: Extracts URLs using regex and flags known spam domains.
Pattern Matching: Detects excessive ALL CAPS (if >70% of text) or multiple emojis (≥3).
User Heuristics: Penalizes very new accounts (< 7 days) or accounts with low karma (< 10).
Semantic Matching: Evaluates content against hardcoded intent clusters (e.g., "promo", "scam") defined in src/core/nlp.ts.
Layer B: ML Engine (Logistic Regression)
Implemented in src/core/ml.ts.
Text Preprocessing: Handled by src/core/nlp.ts. The text is lowercased, URLs are removed, and all special characters and hyphens are replaced with whitespace boundaries. Common stop words are removed to reduce noise.
Feature Extraction: It converts the remaining tokens and bigrams (two-word phrases) into a numerical feature vector, merging it with user heuristics.
Calculation: It calculates z (the sum of feature weights multiplied by their occurrence). The weights are a blend of Local (Subreddit-specific, 70% weight) and Global (Cross-subreddit, 30% weight) parameters. Global weights are simulated via shared pattern initialization and optional syncing across installations where supported. Finally, it passes z through a sigmoid function to generate a 0-100 probability score.
3. Adaptive Learning Loop (src/core/learner.ts)
The system actively learns in two ways when a moderator interacts with the UI:

Rule Adjustment: When a moderator removes a post, the explicit weight of the known keywords and domains increases. When approved, weights decrease.
Online ML Learning (Gradient Descent):
The system compares the model's prediction against the human reality (Removed = Target 1, Approved = Target 0).
It calculates the error: error = prediction - target.
It runs a simplified gradient descent algorithm to update the feature weights using a set learningRate of 0.05. Weights are securely clamped between 0 and 50.
Both Local and Global weights are updated and saved back to Redis.
4. Lightweight Pattern Discovery & Decay
When a moderator removes a post or comment, the system parses the raw text content to perform lightweight pattern discovery via frequency-based token and bigram extraction. These previously unseen patterns are seeded into the tracking logic with a very low initial weight.

To prevent KV storage explosion and Model Drift:

The system keeps track of token usage frequencies.
Periodic decays (weight *= 0.98) are applied to all stored features during the learning loops.
Storage logic strictly caps the tracked item counts to a maximum of 1,000 entries by shedding low-weight patterns.
5. Moderator Dashboard UI (src/client/)
The interactive dashboard is a Devvit Web custom post entrypoint backed by server /api/ routes. It organizes content into three risk tiers mapped precisely to your active sensitivity settings:

🔴 High Risk
🟡 Medium Risk
🟢 Low Risk
The UI features:

Modern Glassmorphic Design: A clean, modern aesthetic with soft transparency, neutral colors, and mobile responsiveness via CSS media queries.
Security Check: The server verifies that the viewing user is in the getModerators list. Non-mods receive an "Access Denied" screen.
Explainability: The UI explicitly details why a piece of content received its score, detailing the top ML contributing features and matched rule features within truncated pill tags.
Large Post Support: Native CSS scrollable containers ensure massive posts do not overflow the UI, and post titles serve as direct hyperlinks to the original Reddit thread for full context.
Instant Actions: Buttons allow instantaneous "Approve" or "Remove" actions which trigger the Reddit API and immediately feed back into the learning loop.
6. Settings Configuration
Via Devvit Mod Tools, moderators can customize the app:

Sensitivity (Low / Medium / High): Adjusts the threshold for what is considered a "High Risk" score for automated removals and UI grouping (Low = 80/50, Medium = 70/40, High = 60/30).
Auto-remove high risk posts: Automatically removes posts that exceed the risk threshold (and possess high confidence).
Auto-remove high risk comments: Automatically removes comments that exceed the risk threshold (and possess high confidence).
Enable NLP-based scoring: Toggles the ML logistic regression model and semantic checks.

## 42. Strike System
A progressive strike and auto-ban tracker for Reddit moderators. Issue numbered strikes to rule-breaking users directly from any post or comment, automatically notify them via DM, track their full moderation history in a shared dashboard, and auto-ban when they reach the configured limit.

### What it does
Strike System gives mod teams a consistent, documented enforcement workflow — from first offense to auto-ban — without spreadsheets, memory, or coordination overhead.

Core features
Feature	Description
Issue Strike	Right-click any post or comment → Issue Strike. Opens a form showing the user's full history before you act.
Auto-ban	When a user reaches the strike limit (default: 3), they are automatically banned. The ban reason is populated with the full strike history.
DM notifications	The user receives a DM explaining which rule was violated, which strike number this is, and what happens next. An escalation warning appears on the penultimate strike.
View Strike History	See any user's full history (strikes, resets, removals, mod notes) from any post or comment.
Reset Strikes	Clear a user's active strikes with a required reason. Unbans automatically if the user was auto-banned.
Add Mod Note	Attach a private internal note to any user's record from any post or comment.
Remove & Log	Remove a post or comment and log it against the user's record in one step.
Mod Dashboard	A persistent post showing all users with strikes — searchable, sortable by risk level, with the ability to issue strikes, reset records, and add notes without leaving the dashboard.
Account intel	When issuing a strike, the form shows account age and karma with risk flags (e.g., "Very new account", "Almost zero karma").
How the strike limit works
Active strikes are what count toward the ban threshold. They reset to 0 when a mod resets a user.
Total strikes are a permanent all-time count and never go down.
At the threshold, the user is auto-banned and the mod team is notified via modmail (configurable).

### Configuration
Go to Mod Tools → Apps → Strike System after installing to configure:

Setting	Default	Description
Max strikes before ban	3	Number of active strikes before auto-ban triggers
Ban duration (days)	0	How long the ban lasts. 0 = permanent ban
Subreddit rules	Rule 1 / Rule 2 / Rule 3	One rule per line — these appear as a dropdown in the strike form
Custom strike message	(built-in template)	The DM sent to the user when they receive a strike. Leave blank to use the default
Notify mod team on auto-ban	On	Sends a modmail to the subreddit when a user is auto-banned
Setting up your rules
In the Subreddit rules field, enter one rule per line:

No spam or self-promotion
Be respectful to other users
No misinformation or unverified claims
Posts must be on-topic for this community
These appear as selectable options in the strike form so every mod picks from the same consistent list.

Custom DM template
Leave blank to use the built-in message. If you want a custom message, use these placeholders:

Placeholder	Replaced with
{username}	The user's Reddit username
{subreddit}	Your subreddit name
{ruleName}	The rule selected by the mod
{strikeNumber}	Which strike number this is
{maxStrikes}	The limit before auto-ban
Mod workflow
Issuing a strike
Find the post or comment that broke a rule
Open the three-dot menu on the post or comment
Select Issue Strike
The form opens showing:
Account age and karma (with risk flags for suspicious accounts)
The user's current strike history
Select the rule violated from the dropdown
Add an optional moderator note (internal only — not sent to the user)
Click Issue Strike
The user receives a DM immediately. If this is the final strike, the form title shows a clear warning before you confirm, and the button changes to Issue Strike & Ban.

Viewing a user's history
From any post or comment: three-dot menu → View Strike History

Shows: account intel, all strikes with dates and rules, resets with reasons, content removals, and mod notes.

Resetting strikes
From a post or comment: three-dot menu → Reset Strikes

Requires a reason. If the user was auto-banned, the reset automatically unbans them.

From the dashboard: click into a user → Reset Strikes button.

Opening the Mod Dashboard
From the subreddit menu: Open Mod Dashboard

Creates a persistent pinned post (creates once, reuses on subsequent opens). Shows all users with any moderation history, sorted by risk (banned first, then by active strike count). Supports username search. From any user row, click through to their full profile where you can issue strikes, reset, or add notes.

Auto-ban behavior
When a user reaches the strike limit:

The user is banned from the subreddit
The ban reason is automatically filled with a summary of all their strikes and dates
The user receives a DM explaining they've been banned
The mod team receives a modmail notification (if enabled in settings)
All of this happens automatically on form submit — no additional mod action required.

## 43. GuardHub - Domain Guard 🛡️
### Purpose
Domain Guard is a professional-grade URL and domain moderation engine for Reddit. It enables moderators to enforce strict domain policies, prevent malicious linking, and maintain community integrity through a structured, UI-driven management dashboard.

### Major Features
Stealth Dashboard Pattern: Exclusive 'Removed/Locked' dashboard posts provide a ghost-layer management interface invisible to non-moderators.
Unified 2.0 Visual Standard: Clean, header-centric navigation with ultra-stealth status indicators and premium glassmorphism.
Granular Domain Rules: Define allowlists and blocklists for hostnames with regex support.
Context-Aware Scopes: Apply rules specifically to submissions, comment bodies, or both.
Mobile-Optimized Dashboard: Native Webview interface hardened for stability on iOS and Android.
Security-First Architecture: Absolute server-side API gates and 403-interceptors ensure zero data leakage to non-staff.
### Logic & Behavior
Extraction: Identifies all URLs within post titles, bodies, and primary submission links.
Decomposition: Breaks URLs down into subdomains and primary domains for precise matching.
Evaluation: Matches against the Redis-backed rule store using optimized O(1) lookups.
Dry Run & Audit Logs: Safely test new rules in Audit mode before enforcing them live. Matches are logged to the gh:logs namespace.
### Product Boundaries
Domain Guard focuses exclusively on URL and hostname patterns.
It does not evaluate the content of the linked page (see Word Guard) or the reputation of the author (see User Guard).
## 44. SG-1 Responder

SG-1 Responder is an automated community engagement utility designed for Stargate-themed subreddits. It monitors community activity and delivers contextually relevant responses to maintain engagement and thematic consistency.

### Core Features
Contextual Triggers: Monitors submissions and comments for specific Stargate-themed keywords.
Automated Interaction: Delivers flavor-accurate responses to maintain community engagement.
Safety Filters: Built-in rate limiting and moderator exemptions to prevent spam.
### Usage & Configuration
Feature	Functionality
Trigger Mapping	Custom configuration of keywords and response sets.
Response Logic	Weighted random selection to ensure interaction variety.

## 45. GuardHub - Word Guard 🛡️
### Purpose
Word Guard is a professional-grade keyword moderation engine designed to replace complex AutoModerator YAML with a structured, UI-driven management system. It provides high-performance keyword matching, safe defaults, and a built-in testing environment.

### Major Features
Stealth Dashboard Pattern: Exclusive 'Removed/Locked' dashboard posts provide a ghost-layer management interface invisible to non-moderators.
Unified 2.0 Visual Standard: Clean, header-centric navigation with ultra-stealth status indicators and premium glassmorphism.
Structured Rule Groups: Logical organization of keywords without manual YAML editing.
Matcher Engine: High-performance text normalization and regex-capable keyword matching.
Mobile-Optimized Dashboard: Native Webview interface hardened for stability on iOS and Android.
Security-First Architecture: Absolute server-side API gates and 403-interceptors ensure zero data leakage to non-staff.
Audit Logging: Real-time visibility into which rules were matched and what actions were taken.
### Logic & Behavior
Trigger: Monitors PostCreate, PostUpdate, CommentCreate, and CommentUpdate events.
Normalization: Content is normalized to bypass common filter-evasion techniques.
Action: Executes the configured moderation action (Filter, Remove, or Report).
Dry Run: Safely test new rules in Audit mode before enforcing them live.
### Product Boundaries
Word Guard focuses exclusively on text content analysis.
It does not evaluate URLs (see Domain Guard) or account age/karma (see Filter Guard).
## 46. Answer Triage
Answer Triage is a Devvit moderation tool for communities that regularly handle question posts. It adds a moderator-only post action called Triage question that helps mods leave a consistent, structured triage comment on a thread.

### What it does
Adds a Triage question action to post moderation tools.
Opens a short form where a moderator chooses a queue status and urgency.
Lets the moderator request missing context from the original poster.
Lets the moderator add an optional note for knowledgeable volunteers.
Posts a structured triage comment on the selected thread.
Can optionally sticky the triage comment.
Can optionally apply post flair matching the selected triage status.
### Triage statuses
Needs Context: the original poster needs to provide more detail.
Needs Answer: the question is valid and waiting for a community answer.
Needs Expert: the thread likely needs deeper subject knowledge or direct experience.
Answered: the thread has been marked answered, while still allowing follow-up clarification.
### Urgency levels
Low
Normal
High
When status flair is enabled, the app applies flair text based on the selected status and uses a color based on urgency.

How moderators use it
Open a question post.
Open the post moderation tools. On some Reddit surfaces this appears as a shield button near the post or comment controls.
Choose Triage question.
Select the queue status and urgency.
Add any missing context request or volunteer note.
Choose whether to sticky the triage comment and apply status flair.
Submit the form.
The app will post a structured triage comment to the thread. If the comment is created but sticky or flair updates fail, the app still reports the triage as posted and notes the partial failure.

## 47. TriageBot
TriageBot is a Devvit moderation app that helps moderators move through reported posts and comments faster. It listens for report events, sorts each item into a clear priority bucket, and gives mod teams a persistent dashboard for queue triage.

TriageBot does not auto-ban, auto-remove, or make final moderation decisions. It gives moderators better context, then requires an explicit moderator action before approving, removing, locking, or marking an item as reviewed.

### What Moderators Get
Priority buckets for reported posts and comments: High Priority, Needs Review, and Low Priority.
Triage HQ, a persistent custom dashboard post with filterable queue cards.
Rule Lens, which suggests the closest matching subreddit rule when report text and content match rule wording.
Pattern Radar, which groups repeated report themes so teams can spot clusters like scams, harassment, or heated argument threads.
Incident Mode, which clusters related reports by shared pattern, thread, or external domain.
Evidence Capsule, a compact moderation snapshot with report, rule, signal, pattern, and decision context.
Rule Drift, which highlights rules that are repeatedly matched, approved, removed, or still open.
Queue Heatmap, which shows the most common report signals across the active queue.
Second-mod review workflow for high-risk items that need another moderator before final action.
One-click handoff text for shift changes and async mod teams.
Time-saved and stale-review counters for handoffs between mod shifts.
Mod-only post and comment menu actions for item-specific triage summaries.
Manual quick actions: approve, remove, lock, request second review, and mark reviewed.

### Moderator Workflow
Open TriageBot HQ.
Start with High Priority items.
Read the report reason, detected signal, Rule Lens, Incident Mode, and Evidence Capsule context.
Open the original Reddit item when needed.
Apply a manual action: approve, remove, lock, request second review, or mark reviewed.
Add an optional short review note for team context.
Copy the generated handoff summary when passing the queue to another mod.
Moderators can also open a reported post or comment directly and choose Triage summary from the item menu.

### Safety Model
TriageBot never performs automatic enforcement.
All moderation actions require a manual moderator click.
The dashboard API checks that the current user has moderator permissions before returning queue data.
Post/comment quick actions check moderator permissions before acting.
Deleted posts and comments are removed from TriageBot's Redis queue through delete triggers.

## 48. 📌 Notice Board for Reddit
A premium, high-impact communication suite for subreddit moderators.

Notice Board transforms how you communicate with your community. From critical rule changes and live event updates to curated community blogs, this app provides a bold, professional, and branded space that stays pinned at the top of your subreddit.

🚀 Key Features
📢 High-Impact Announcements
Instant Visibility: Automatically creates and pins a branded post (e.g., r/Subreddit Notice Board) upon installation.
Editorial Typography: Large, bold headlines designed to grab attention immediately in the feed.
Smart Previews: Shows a 60-character snippet of your message with an elegant "Read More" transition for deeper engagement.
Actionable CTAs: Add custom buttons with external links to drive traffic to Discord, wikis, or external sign-up forms.
Announcement Images Add custom images to represnt yourself more.
🎨 Visual Versatility (10+ Themes)
Moderators can choose from a library of high-grade visual identities to match their subreddit's personality. Our custom theme engine ensures these styles look perfect for every user, regardless of their device's light/dark mode settings.

Classic Noir: The definitive high-contrast editorial look.
Wanted Poster: A rugged, sepia-toned "Old West" aesthetic.
Retro Console: Matrix-inspired monospaced green-on-black logic.
Swiss Design: Clean grids, bold red accents, and modern clarity.
Neo Brutalist: Raw, heavy borders and high-impact shadows.
Vintage News: The prestigious feel of a traditional daily newspaper.
Cyberpunk: Vibrant neon pink and cyan glows on a deep dark void.
Modernist: Ultra-clean lines with elegant rounded corners.
Technical Blueprint: Precision technical grids on cobalt blue.
Ornate Gothic: Dramatic gold-on-black with classical blackletter flair.
🛠️ Moderator Command Center
Seamless Creation: A dedicated creation form with real-time character limits (50 for titles) to ensure visual consistency.
Timeline History: A complete archive of all past announcements. Users can browse the history, and moderators can delete old entries with a single tap.
Dynamic Settings: Switch your subreddit's entire visual theme instantly via the in-app settings engine.
💡 Use Cases
📋 Community Notices & Rules
Keep your most important rules and community guidelines front-and-center. When rules change, update the board so everyone sees the big headline the moment they visit.

🎙️ Live Updates & Megathreads
Hosting an AMA, a tournament, or a live event? Use the Notice Board to provide real-time updates. Change the headline as the event progresses to keep the community informed.

✍️ Moderator Blogs & Newsletters
Publish weekly "State of the Subreddit" updates. With the dedicated Story View, your long-form paragraphs are rendered in a beautiful, readable, and immersive webview environment.

🔗 Traffic Routing

## 49. duplicate-detector · Devvit App

### What it does
Two surfaces, one app:

precheck (any user). A poster opens the precheck custom post in a sub. They paste their draft title (and optional body). 1.5s later they see a 5-card lineup of the most-similar past posts from the last 30 days. Each card carries a fingerprint gauge (sage → brass → wanted-red), a WANTED stamp if match% > 80%, the post title, the author, days-ago, and a link to the original. They decide: ship it (and reply to the original instead).

duplicates queue (mod). A mod opens the queue custom post or hits "duplicates queue" in the subreddit menu. They see a corkboard of last-7d posts whose top match against the last 30 days is >= 50%. Each card has the suspect post + top-3 matches + lock/remove/leave action stamps. One click each — Reddit API does the rest.

Cache TTL is 6h on the post pool (per subredditName + days). The same cache is shared by both surfaces, so a mod scanning the queue also warms the precheck pool for posters in the same sub.

The visual personality is WANTED · police lineup — Playfair Display heavy serif + Newsreader body + Special Elite typewriter mono on a cream paper background, sepia ink, corkboard texture for the mod queue, paper- tear top edge on every card, ink-stamp shadows (no blur). See brand-spec.md.

## 50. Judgment Bot
A Reddit bot designed to manage automated post flairs and contributor rewards based on community voting.

### Features
Automated Post Analysis: Scans posts after a set delay (e.g., 18 hours) to determine a verdict based on top-level comments.
Verdict Flairing: Automatically applies judgment flairs (NTA, YTA, ESH, NAH, INFO) to posts.
Contributor Rewards: Tracks user contributions and updates user flairs with ranks and scores (stored in Redis).
OP Status Monitoring: Automatically locks and removes posts if the Original Poster's account is deleted or suspended.
Manual Judgment Escalation: Reports posts to the moderator queue if no clear verdict can be found.
### How It Works
Post Submission: When a post is submitted, a delayed audit task is scheduled.
18-Hour Audit: The bot checks the post status and analyzes top-level comments.
Verdict: The highest-voted valid judgment code becomes the post's verdict.
Scoring: The contributor of the winning judgment is rewarded with points and rank updates.

## 51. ModScript
AI-powered AutoModerator assistant, native to Reddit's mod panel.

React TypeScript Vite Tailwind CSS Node Hono YAML Safe No External UI

Generate AutoMod rules. Explain inherited configs. Catch risky changes before they reach the wiki.

Generate	Explain	Conflict Check	Save Guardrails
Plain English to AutoMod YAML	Rule-by-rule summaries	Duplicate and ordering review	YAML validation, diff preview, risk badge

### The Problem
AutoModerator is the backbone of Reddit moderation — yet writing and maintaining its YAML configuration is one of the highest barriers for mod teams:

Most moderators are not developers. YAML syntax is error-prone and poorly documented.
Inherited configs are black boxes. A 400-line file written by someone who left the mod team two years ago is terrifying to touch.
Configs rot. Over time they accumulate dead rules, duplicate conditions, and ordering issues that nobody catches.
Every existing AI tool requires leaving Reddit. Copy YAML out, paste into a website, copy back. Repeat for every change.
There is no AI-native AutoMod tool built into Reddit's platform — until now.

What ModScript Does
ModScript lives inside Reddit's native mod panel as a Devvit app. Moderators open it directly from their subreddit's mod tools menu and get a conversational AI interface — powered by Google Gemini — to generate, explain, and audit their AutoModerator config without writing a single line of YAML and without ever leaving Reddit.

### Feature Snapshot
Area	Built In
AI workflow	Generate, Explain, Conflict Check
Save safety	YAML validation, verified save re-read, diff preview, undo, Redis backup, native wiki revision history
Judge/demo flow	Guided walkthrough, local demo config, expanded starter templates, example prompt chips
Risk visibility	Low/Medium/High badge, deterministic safety checklist, false-positive notes
Cost controls	Kill switch, daily quotas, BYO subreddit Gemini keys, max input size, short-lived usage logs
### Three Core Modes
Mode	What it does	AI Model
Generate	Plain English → valid AutoMod YAML, appended safely to your existing config	Gemini 2.5 Pro
Explain	Paste a YAML block → rule-by-rule plain English breakdown	Gemini 2.5 Flash
Conflict Check	Structural audit: duplicate rules, redundant conditions, suspicious ordering	Gemini 2.5 Pro
### Who It's For
ModScript is designed around three real moderator personas:

"The Inheritor" Became a mod of an existing subreddit. Has a 500-line AutoMod config written by someone else years ago, no idea what half the rules do, and is afraid to touch them. Primary use: Explain Mode + Conflict Check.

"The Founder" Started a new subreddit that is growing. Knows they need AutoMod but has never written YAML and doesn't know where to start. Primary use: Template picker + Generate Mode.

"The Power Mod" Moderates 15+ subreddits. Needs to quickly iterate and adapt rule sets without a learning curve. Primary use: Generate Mode with multi-turn refinement.

### Features
### Generate Mode
Type a plain English description of a rule. ModScript generates valid, formatted AutoMod YAML and displays it in a syntax-highlighted code panel.

Append-only by default — generated rules are added to the bottom of your existing config. A 400-line hand-tuned config is never silently overwritten.
Multi-turn refinement — follow up in the same conversation to adjust scope, conditions, or phrasing.
Example prompt chips — common starter requests like account-age filters, spam phrases, required flair, suspicious links, and low-karma comments are one click away.
Generated YAML validation — generated rules are validated immediately. Valid YAML is appended with a generated yaml valid confirmation. Invalid YAML is shown in chat with parser location and is not appended automatically.
Deterministic action_reason insertion — remove, filter, and report rules get a concise local action_reason if Gemini omitted one, then the YAML is validated again.
"Why this rule is safe" review — generated YAML gets a deterministic checklist showing append-only behavior, validation, action reasons, detected actions, detected trigger fields, false-positive notes, and a test reminder. This does not use an extra AI call.
Explicit rewrite mode — a clearly labeled "Rewrite full config" option is available behind a confirmation dialog. Triggers an automatic Redis backup before any change is made.
### Explain Mode
Load your existing config (fetched automatically on open) or paste any YAML block. ModScript returns a structured, rule-by-rule breakdown in plain English — what triggers each rule, what action it takes, and edge cases to watch for.

Powered by Gemini 2.5 Flash to keep latency low on the most-used path.

### Conflict Check
Submit your full AutoMod config. ModScript analyzes it for:

Duplicate keyword lists across multiple rules
Rules with identical triggers that could be merged
Suspicious action ordering (e.g., approve before remove)
Structurally redundant conditions
Output is framed as review suggestions — structural pattern analysis for a human mod to evaluate, not a claim about which rules fire at runtime.

### Wiki Read/Write with Guardrails
Auto-fetches the subreddit's config/automoderator wiki page on open — no copy/pasting required.
Permission gate on open — blocks AutoModerator config viewing and editing unless the current user has config or all moderator permission.
Readiness check on open — shows whether the wiki is readable and whether the current moderator can save. Generate, Explain, Conflict Check, history, tester, save, undo, and revision content endpoints also enforce the same config permission server-side.
YAML validation before save — every save path validates the final YAML before showing the diff preview, and the server validates again before writing to Reddit's wiki.
Validation status in the editor — the code panel footer shows valid yaml, invalid yaml, or not checked.
Verified saves — after writing, the server re-reads config/automoderator and only returns success when the saved wiki content exactly matches the submitted content.
Undo last save — the success strip exposes undo last save, restoring the latest pre-write Redis backup and verifying the restored wiki content by re-reading.
Diff preview before every save — additions in green, removals in red. Rule-level review cards summarize added, removed, and changed rules with action, trigger summary, risk level, and action_reason status.
Pre-save risk badge — unsaved changes are labeled Low, Medium, or High based on deterministic checks such as report-only actions, remove/filter actions, regex breadth, author age/karma gates, and full-config rewrites.
Meaningful revision history — every save writes a human-readable reason string to Reddit's native wiki revision history (e.g., "ModScript — appended rule: remove posts from accounts under 3 days old").
Redis backup before every write — previous config snapshotted immediately before any wiki update, with the last 5 backups retained per subreddit.
### Deterministic Rule Tester
Open Tester from the code panel to run the current YAML against a sample submission or comment without calling AI. It checks common AutoModerator fields including title, body, body+title, URL/domain, author age, karma thresholds, content type, regex/includes matching, and detectable flair presence.

Tester output is labeled as a best-effort deterministic check, not an AutoModerator runtime guarantee. Unsupported conditions are reported instead of failing the test.

### Starter Templates
On first open, mods choose a subreddit type to pre-load a sensible starting config, or start blank:

Template	Best For
General	Mixed-content communities
Gaming	Gaming subreddits and tournament communities
Support / Mental Health	Communities requiring stricter content standards
News	News aggregation and discussion communities
Start blank	Building from scratch
### Demo Config
For judging, demos, and first-run exploration, ModScript includes a local "Load demo config" option and a guided Start demo walkthrough flow. The walkthrough loads the demo config without saving, prefills a recommended Generate prompt, and shows steps for Load demo, Generate, Explain, Conflict, and Preview save.

Demo loading is static and local to the app: no external domain is contacted, no AI call is made, no quota is consumed, and nothing is saved until the moderator explicitly confirms a later wiki save.

### Version History
A revision list modal showing the last 10 native Reddit wiki revisions, each with timestamp, author, and reason string. One-click revert to any prior revision, with a Redis backup taken before reverting.

Built directly on Reddit's native wikiPage.getRevisions() and wikiPage.revertTo() APIs — no custom version store required.

### Cost Controls (F11)
Because the developer's shared Gemini key funds all usage, cost controls are non-negotiable infrastructure built into every AI call:

Control	Behavior
Kill switch	Global paused setting — halts all Gemini calls instantly across every subreddit
Daily quotas	Generate: 50/day/sub · Explain: 50/day/sub · Conflict Check: 50/day/sub. Quota increments only after a successful Gemini response.
Max input size	Configs above ~50K tokens are rejected before any API call is made
Usage logging	Token counts written to Redis per subreddit per day, retained for 48 hours during the hackathon window
All quotas are tunable via global settings without redeploying. For the hackathon submission, the developer-provided shared Gemini key keeps judging friction low; the 48-hour usage log retention is intentionally short and exists only to monitor cost and reliability during the judging period.

Conflict Check also has a disabled-by-default IAP gate stub controlled by global settings (iapConflictEnabled, conflictIapSku). When enabled without an entitlement implementation, Conflict Check is blocked with purchase copy; by default it is off and does not affect normal usage.

### Safety Guarantees
ModScript treats your existing AutoMod config as irreplaceable. Every decision in the save flow reflects this.

Append is always the default. A 400-line config is never silently rewritten.
Invalid YAML is blocked before write. Client-side validation stops bad YAML before the diff preview, and server-side validation prevents bypassing the UI.
Diff preview is mandatory. Every save shows exactly what will change before committing, including rule review cards above the raw line diff.
Saves are verified. A save is only considered successful after the server re-reads Reddit's wiki and confirms the content matches.
Undo is verified. The latest Redis backup can be restored through the UI and is also verified by re-reading the wiki.
Risk is visible before save. The editor and diff modal show Low/Medium/High risk with concise reasons so moderators can spot broad removals, broad regexes, or full rewrites before committing.
Config permission is explicit. The app checks moderator permissions before reading or editing AutoModerator config and blocks access unless config or all permission is present.
Redis backup before every write. Fast-restore snapshot taken immediately before each wiki update.
Reddit's native revision history is the canonical record — visible in the wiki's revision log, one-click revertible from within ModScript.
Safety review is deterministic. Generated rules get a local checklist of action, trigger fields, and false-positive notes without making extra AI calls.
Conflict Check copy is scoped. Output is structural pattern analysis for human review, never a claim about which rules fire at runtime.

## 52. Mod Snapshot
Reddit Devvit Archival Security

Mod Snapshot generates a comprehensive, text-based archival record of your subreddit's configuration, from AutoModerator rules to subreddit settings, delivered directly to your Modmail for secure storage and easy reference.

### Core Features
Comprehensive Data Collection: Captures Subreddit Settings, Rules, Removal Reasons, Flair Templates, and Appearance configurations in a single run.
Surgical Extraction: Automatically retrieves the full, raw AutoModerator configuration for offline backup or auditing.
Logical Modmail Delivery: Intelligently splits large snapshots into multiple Modmail discussions to bypass platform character limits while maintaining readability.
Moderator-Only Access: Operations are strictly restricted to the Subreddit Mod Tools menu, ensuring configuration data remains internal to the team.
### Usage & Configuration
Feature	Functionality
Trigger	Accessible via the Subreddit Mod Tools (3-dot overflow menu).
Daily Limit	Configurable via App Settings to limit manual snapshots per 24-hour period (Default: 24).
Cooldown	Built-in 2-minute safety cooldown between generations to ensure platform stability.

## 53. Receipts
Receipts is a Devvit moderator tool for shared modqueue case files. It helps moderators handle reported posts and comments without leaving the queue for context, duplicated coordination, or repeated action clicks.

Receipts is deliberately framed as a context and coordination tool, not a user scoring or detection tool. It does not produce risk scores, authenticity scores, AI-detection labels, or profile judgments.

### Current MVP
Post and comment mod-menu actions that open a shared Receipts dashboard.
Case-file header with author, subreddit, report count, permalink, account context, and neutral badges.
Subreddit context stats for recent posts/comments here, visible removed items, recent mod actions, removal actions, and last matching mod-team action.
Recent public activity preview so moderators can inspect source material before requesting AI processing.
Manual-only Evidence Summary with citation links, JSON schema validation, no-storage OpenAI Responses API calls, 24-hour cache, and deletion-trigger invalidation.
Daily Evidence Summary quota guard: 30 new generations per moderator per UTC day; cached summaries do not consume quota.
Recent modnotes and action log rendering.
Single moderation actions: Approve, Remove, Send Removal Reason, Add Modnote, and Ban User.
Fixed macro: Remove + Send Reason + Add Modnote.
Co-mod presence via Devvit Realtime plus Redis heartbeat fallback.

## 54. Mod Board
A shared kanban board for your mod team. Modmail, internal mod chats, and team to-dos sit on one screen and stay in sync across everyone who has the board open. Live chat, typing indicators, tasks, the usual stuff.

### The Board
Four columns on desktop (stacked sections on mobile):

New: incoming modmail and fresh tasks no one has picked up
In Progress: anything a mod is working on
Mod Discussion: internal threads between mods
Archived: closed conversations and finished tasks
The main board view with cards across all four columns

Each card shows the subject, a short preview, who sent it, who's assigned, and the message count. Cards with unseen activity get an orange left rail and full opacity. Once you've read everything on a thread, the card dims so you can scan past it. A small "N new" pill on a card tells you how many messages have landed since you last opened it.

If a thread is waiting on a mod reply for a while, a "waiting" badge counts up the hours so it doesn't get buried.

Collapsing columns
Any column can be collapsed to a thin rail. Click the chevron in the column header to collapse, click the rail to bring it back. Mod Discussion and Archived start collapsed since most teams don't need them taking up space all day.

Filter tabs
Tabs across the top narrow what's on screen:

All mods: every card on the board
Mine: cards assigned to you
Unassigned: cards no one has picked up
Snoozed: cards you've snoozed for later
Mentions: threads where another mod tagged you in a note
Search
The search bar at the top runs full-text against subjects, message bodies, and usernames. Type a few characters and the kanban filters live to whatever matches. / from anywhere jumps to the search box.

### Live Modmail Syncing
When a new modmail comes in, it shows up on the board right away. If another mod replies, assigns, moves, or archives a card, you see the change happen live. Same for incoming user replies: if a user writes back to a thread you have open, the new message appears in the chat without a refresh.

So everyone's looking at the same state. No double replies, no "wait, who's on this one."

### Live Typing Indicators
Open any conversation and you'll see the full thread laid out as a chat. If another mod is also viewing the same thread and starts typing a reply, you see a "u/modname is typing…" indicator at the bottom.

Typing indicator showing another mod composing a reply

Stops two mods from accidentally writing the same response. If you see someone typing, give them a second, or jump in with a private mod note.

### Replying to Modmail
Click any modmail card to open the conversation. The thread renders as a chat: user messages on the left, mod replies on the right. There's a composer at the bottom.

A modmail conversation with sticky note, macros, and the reply composer

Markdown works in the composer (bold, italic, code, links, blockquotes).

Team vs. Sign as you
The Team / Sign as you toggle decides how your reply is attributed:

Team: posted under the subreddit's name with no individual signature.
Sign as you: still posted under the subreddit (Devvit can't post replies as your real account), but signed off with your username at the end so the user knows who specifically replied.
Mod-only notes
Click the Mod note chip to flip the composer into private mode. Anything you send is visible only to other mods on the thread, never to the user. Good for "I'll handle this one" or pinning context for whoever picks it up next.

Auto-assign on reply
Reply to an unassigned thread and it gets assigned to you automatically. The card also bumps from New to In Progress.

### Macros (Saved Replies)
For the responses you write a lot (appeal received, rule reminder, closing the thread), save them as macros and drop them in with one click. The Macros chip above the composer opens the picker.

Macro picker pinned above the reply composer

Macros are shared across the whole team. When one mod adds, edits, or deletes a macro, everyone else sees the change live.

Variable substitution
Macros support a few variables that get filled in on insert:

{{username}}: the user you're replying to
{{subreddit}}: the current subreddit
{{rule}}: prompts you to type which rule, then substitutes it
Open the Manage panel to add, edit, or delete macros for the whole team.

Manage Macros modal listing the team's saved replies

### Mentioning Other Mods
Type @ in any reply or task comment to bring up an autocomplete list of mods on your sub. Tab or Enter to insert.

@ mention autocomplete showing the mod list

When you mention someone, they get a toast on their board with the excerpt and a link that jumps to the thread. The card also shows up in their Mentions filter until they open it.

### The User Side Panel
Click any username in a conversation to open the user side panel. One view, everything you need to make a call on a user.

The user side panel with quick actions, mod note, and activity stats

The header has the avatar, account age, total karma, email-verified status. Below that:

Quick actions: Mute / Ban / Approve / Flair circle buttons. Each one swaps to its inverse when the state is already set (Mute becomes Unmute, Ban becomes Unban) so you always know what the next click does.
Mod note: a sticky internal note about the user that follows them across every conversation. Add context once ("warned 2x for hate speech, third offense ban") and the next mod to talk to them sees it pinned at the top of the thread.
Activity stats: community karma, previous mutes, previous bans, submission removals. Pulled live from your sub's mod log.
Log, Posts, and Comments tabs
Below the activity stats, four tabs cover the user's full footprint in your sub:

Overview: the activity stats above plus a recent contribution graph.
Log: every mod action taken on this user, with friendly verbs ("Banned 3 days", "Removed post", "Approved comment") and which mod did it.
Per-user moderation log timeline

Posts: recent posts by this user with status badges (live, removed, spam, approved). Removed items get a Restore button. One click to approve a post without leaving the modmail thread.
Comments: same as Posts, for comments.
The point is to let you see and act on a user's pattern of activity without flipping between tabs.

User Actions From the Conversation Header
The chat header has a three-dot menu next to the archive button. It mirrors the side panel quick actions but adds a few more:

Conversation > Archive thread: close the thread without leaving the chat.
Approval > Approve / Unapprove user.
Mute from modmail > Mute · 3 / 7 / 28 days (or Unmute if already muted).
Ban from subreddit > Temp ban · 3 / 7 / 28 days plus Permanent ban… with a two-step confirm, or Unban if already banned.
The state of the user is read live, so if a sibling mod muted them in another tab the menu reflects that without you refreshing.

Sticky Mod Notes
The yellow banner at the top of a conversation is the sticky mod note about the user, not about the thread. Add context once from the user side panel and every modmail thread from that user (now and in the future) starts with that note pinned.

It's where you log the things you want every mod on the team to see before they reply: previous warnings, language preferences, history with the sub. Survives across conversations, persists when the thread is archived, and updates live for everyone.

Assigning, Moving, and Snoozing Cards
Assigning
Right-click (desktop) or long-press (mobile) any card to open its context menu and pick a mod to assign it to. Once assigned, the mod's avatar shows on the card, they see it in their Mine filter, and the rest of the team knows it's covered.

The conversation header shows the assignee too. Replying to an unassigned thread auto-claims it for you.

Moving between columns
On desktop, drag cards between columns to update their status. Drop a card on In Progress when you start working on it, on Archived when it's done, or on the collapsed rails to drop straight into Mod Discussion or Archived without expanding them. On mobile, long-press the card and pick the new status from the menu.

If a user replies to a thread you've archived, it bumps back to In Progress with full unread treatment so it doesn't get buried.

Snoozing
If a card isn't actionable right now (waiting for the user to send proof, say), snooze it from the context menu. Snoozed cards drop out of the default views and show up under the Snoozed filter. When the snooze expires, the card pops back into rotation.

Bulk Actions
For sweeping the queue, shift-click any card to add it to the selection set. A floating action bar appears at the bottom with the count and the available actions.

Bulk action bar with multiple cards selected

Assign to me: claim every selected card.
Unassign: drop the assignee on all of them.
Mute: pick a duration and mute every selected user from modmail at once.
Archive: close out a batch of resolved threads.
Cancel clears the selection.

Composing New Mod Mail
Click + New in the top right to start a new conversation. The Mail tab lets you pick the audience:

Moderators: internal discussion thread with your mod team.
User: DM a specific Reddit user as the subreddit.
Community: message another subreddit's mod team.
The New Mail composer

Add a subject and a markdown body, hit Send, and the conversation lands on the board for the whole team.

### Tasks
Mod Board isn't just for modmail. You can also create tasks for the team. Stuff like "update AutoModerator config", "design the new banner for the holidays", "review reports from this weekend's brigade". Hit + New and switch to the Task tab.

Creating a new task

Each task has a short summary, a longer description for context, an optional assignee, and an optional Reddit DM to that assignee so they know they've been tagged in.

Working a task
Open a task card to see the full thread. Mods can comment, ask questions, share updates, and change the status. Same chat-style UI as a modmail thread, with the same @ mention autocomplete.

Task detail view with status dropdown, assignee, and comments

Move tasks through the columns like any other card. Tasks live on the same board as modmail, so the team gets one shared view of what's going on in the sub right now: incoming reports, ongoing replies, team to-dos.

### Keyboard Shortcuts
Key	Action
j / k	Move focus down / up through cards
Enter	Open the focused card
e	Archive the focused card
c	Compose a new mod mail or task
/	Jump to the search box
?	Show / hide keyboard shortcut help
Esc	Close any open sheet, modal, or help overlay
Shift + click	Toggle bulk selection on a card
Cmd / Ctrl + Enter	Send the current reply
### Tips
Use the Mine filter at the start of a shift to see what's on your plate.
Long-press cards on mobile for the same right-click menu desktop users see.
Mod Discussion is a good column for things you want team input on before replying.
Archived isn't deletion. You can scroll back, search, or move a card out of archived any time.
Sticky mod notes are the most underused feature. Add context once and every future mod talking to that user benefits.

## 55. AI Checker

AI Checker is a manual-only Reddit moderation utility designed to help identify AI-generated content. It provides an integrated way to scan posts and provide transparency to the community via automated result comments under moderator control.

### Core Features
Multi-Provider Support: Integrated with Gemini, GPTZero, Sightengine, and Hive AI.
Standardized Scoring: Normalizes complex confidence percentages into a simple 1-10 scale.
Customizable Templates: Full control over result comments using dynamic template tokens.
Modmail Integration: Optional notification routing for every detection result.
### Usage & Configuration
Feature	Functionality
Manual Trigger	Moderators initiate checks via the native Reddit Post Menu.
Analysis	Detects content type (Text/Image) and queries the active provider.
Transparency	Automatically posts normalized results as a professional comment.

## 56.  translation app for Modmail.

This app supports a !translate command to translate text in Modmail, with the intention being to translate foreign communication from a user to and from a language that the mod team can work with.

Modmail Translator uses the gpt-5.4-mini model to handle requests.

Translating a user's message
Use the command !translate on its own in a modmail. The app will find the last message from the user and translate it to the language you have configured in the app's settings. It will tell you the language that was detected, too.

The app will translate the text of the previous message and respond as a private moderator note. Please remember to use a private mod note when issuing the command.

If you turn the "Continuous translation mode" option on in settings, subsequent messages from the user will be automatically translated without having to issue a !translate command, but only after you have triggered it once.

Example:

Screenshot showing !translate command in isolation

Translating a message to a user
Use the command !translate or !translate French or similar along with the message you wish to translate on subsequent lines. If you have already translated a message from the user, it will assume you want to translate to the language the user used. For example:

!translate

You were banned because you broke our rules on hate speech

or if you want to specify the language:

!translate Russian

All posts on r/Rateme must include a verification image showing you holding a paper sign with the words "Rate me" on it

The app will translate the text to the language specified and respond to the user as the mod team. Please remember to use a private mod note when issuing the command.

Example:

Screenshot showing !translate command for a reply

## 57. Sticky Pro

Sticky Pro is a high-performance moderation tool designed to streamline the process of posting and stickying recurring comments. Built for speed and reliability, it allows moderators to deploy pre-configured templates with a single click, ensuring consistent communication across the subreddit.

### Core Features
Template System: Configure up to three unique sticky templates with custom labels and markdown content.
Three Direct Menu Items: Dedicated post-menu actions for each template — no modal or form required. Works natively on all platforms including Reddit mobile.
Auto-Sticky Posting: Automatically submit and lock a sticky comment on every new post submission (PostSubmit & PostCreate triggers), with built-in Redis-backed concurrency deduplication to prevent duplicate comments.
Scheduler-Based Resiliency: Integrates Devvit Scheduler to automatically retry and bypass API ratelimits when posting auto-stickies.
Command Fail-safe: Robust moderator commands (!sticky 1, 2, 3) as an additional trigger path.
Mobile-First Stability: Engineered without reliance on showForm, which is not reliably supported on Reddit's mobile native renderer.
Security-First: Enforces moderator-only access through platform-native permissions and secondary runtime authorization.
Automated Cleanup: Command triggers are automatically removed after execution to maintain thread professionality.
### Usage & Configuration
Once installed, moderators can access the tool via the post options menu, commenting directly on a post, or using the automated posting option.

### Manual Actions
Method	Instruction
Menu: Template 1	Select "Sticky: Template 1 (FAQ)" from the post options menu.
Menu: Template 2	Select "Sticky: Template 2 (Rules)" from the post options menu.
Menu: Template 3	Select "Sticky: Template 3 (Custom)" from the post options menu.
Command	Reply to any post with !sticky 1, !sticky 2, or !sticky 3.
### Automated Sticky Posting
When Auto-Sticky is enabled, the app listens to all new post events. It will immediately publish the pre-configured markdown sticky text to the thread and lock it. If a standard Reddit rate limit is hit, the app dynamically schedules retries to ensure delivery. The app uses a fast Redis-backed lock state machine to seamlessly deduplicate concurrent platform events (PostSubmit and PostCreate), guaranteeing only a single sticky comment is posted.

### Configuration
Update your templates and automated settings in the App Settings panel on Reddit: Mod Tools > Apps > Sticky Pro > Settings

Setting	Type	Description	Default
Button Label 1-3	string	Label displayed on the moderator menu buttons.	FAQ, Rules, Custom
Sticky Content 1-3	paragraph	Markdown content deployed by manual actions.	Empty
Enable Auto-Sticky	boolean	If true, posts a sticky comment on every new post.	false
Auto-Sticky Content	paragraph	Markdown content deployed automatically.	Empty

## 58. Scan Slop - Fight Bots
Captcha verification + link spam detection for Reddit. Automatically challenges unverified users with an image captcha and detects repeated link promotion.

### Captcha Verification
A new user posts or comments in your subreddit
The content is temporarily removed and a sticky comment appears with a captcha link
The user clicks the link, sees a distorted code image, and replies with the code
If correct - the user is verified and their content is restored instantly
If too many wrong attempts - temporary ban (attempts and ban duration are configurable)
Moderators are always exempt. Verified users are remembered and never challenged again (configurable TTL).

### Link Spam Detection
Monitors posts and comments for repeated promotion of the same URLs or domains. Tracks how often each user posts the same domain.

User posts a link to example.com - recorded
Same user posts example.com again - recorded (2/3)
Third time within the cooldown window - all posts with that link are removed, user is banned, mods get notified via modmail
Each detection expires individually after the cooldown period (rolling window, not a fixed reset date). Works on all users including verified ones.

### Settings
Captcha
Setting	Default	Description
Verify on posts	true	Challenge unverified users on posts
Verify on comments	true	Challenge unverified users on comments
Verification TTL	0 (forever)	How long verification lasts in minutes. 0 = permanent
Max attempts	3	Wrong codes allowed before temp ban
Ban duration	28 days	Temp ban length after failed captcha
Min account age	0	Skip accounts older than X days
Min karma	0	Skip users with karma above X
Max held items	5	Max posts/comments held per user. Prevents spam-then-verify abuse
Check mods	false	Require verification for moderators too
### Link Spam Detection
Setting	Default	Description
Link detection	true	Enable/disable link scanning
Cooldown window	30 days	Rolling window per detection
Threshold	3	Times a user can post the same domain before action
Ban duration	28 days	0 = just remove content, no ban
### Features
Image-based captcha verification
Instant verification via comment replies
Held content is automatically restored after verification
Works alongside AutoModerator without conflicts
Link spam detection: tracks how often each user posts the same domain. Set a threshold (e.g. 3 mentions in 30 days) and users who exceed it get their content removed and are restricted from the sub. Each mention expires individually based on a rolling window, so users naturally regain their allowance over time
Mod notifications via modmail when link spam is detected
Configurable account age and karma thresholds to skip trusted users
Collects behavioral signals during verification to detect bot patterns and multi-account abuse

