# Firewatch Competitive Analysis

Source: `docs/other_apps.md`

This document analyzes the 58 listed hackathon submissions as Firewatch's
competitive field. The goal is not to copy features. The goal is to identify
which competitor patterns make moderators and judges trust a tool, then choose
the additions that strengthen Firewatch's core product.

## Thesis

Firewatch should win as the Reddit-native incident room for hot threads.

The strongest product claim is:

> One messy Reddit thread. Every signal, user, comment, action, handoff, and
> cleanup step in one moderator room.

This is stronger than positioning Firewatch as another AI moderator, another
AutoMod helper, another strike tracker, or another queue sorter. The field is
crowded with narrow tools. Firewatch's advantage is that it connects the parts
of real thread moderation that usually live in separate places:

- Why the post needs review.
- Which comments are still open.
- Which users are involved.
- Which Reddit-native actions are available.
- Which mod has the item.
- What has already happened.
- What the next mod needs to know.
- Whether the incident can be closed.

Firewatch should stay focused on that loop.

## Second-Pass Findings

The second pass made the thesis stronger for three reasons.

1. Most competitors solve one slice of moderation.

   Examples: repeat offender tracking, AutoMod editing, repost detection, sticky
   comments, modmail appeals, captcha, analytics, translation, or domain rules.
   These are useful, but they are not the same as handling a live thread that is
   receiving reports, risky comments, repeated phrases, and mod actions.

2. The strongest direct competitors are not narrow bots. They are workflow tools.

   Firewatch should take the direct-threat group seriously:

   - Drama Radar
   - QueueIQ
   - Triage
   - TriageBot
   - Receipts
   - ModTower
   - Mod Triage Board
   - Raid Radar / RaidPulse
   - Sky For Redbrain
   - Sentinel AI

   These apps compete on "where should mods look, why, and what should they do
   next." Firewatch already lives in that space.

3. Judges will reward reliability and coherent scope.

   The submissions repeatedly mention:

   - Human confirmation.
   - Dry run or shadow mode.
   - Undo.
   - Audit logs.
   - False-positive handling.
   - Mod-only access.
   - Demo-ready flows.
   - Clear evidence.
   - No black-box decisions.

   Firewatch should emphasize those same trust markers, but inside the incident
   room instead of expanding into unrelated products.

## Competitive Landscape

| Category | Representative apps | What they promise | Firewatch response |
| --- | --- | --- | --- |
| Prioritized queue and triage | QueueIQ, Triage, TriageBot | Sort reports by urgency and act faster | Firewatch should not be a generic queue sorter. It should be the deeper room after a thread becomes an incident. |
| Thread risk and raid detection | Drama Radar, RaidPulse, Raid Radar | Detect heated threads or raids early | Firewatch should own "hot thread cleanup," with clearer thread dynamics and watch/snooze states. |
| Repeat offender tracking | RecidivWatch, VerdictBot, Strike System, ReputiBot, ModTower | Remember user history and escalate consistently | Firewatch should show factual user priors inside each incident, not become a standalone reputation product. |
| AutoMod/rule tooling | Automod Wizard, ModSandbox, ModScript, ModTrials, GuardHub | Help mods create, test, or replace rules | Firewatch should avoid this lane except for explaining which Firewatch automation matched. |
| AI moderation | DesiMode AI, Sentinel AI, aisafemod, Sky For Redbrain, AI Checker | Classify or summarize content | Firewatch should avoid broad AI claims. If AI is added later, it should be manual-only evidence summarization. |
| Coordination and handoff | Mod Triage Board, Receipts, Mod Board, Mod Notes Memo | Prevent duplicate work and preserve context | Firewatch should strengthen claim, second review, handoff, watch, and action history. |
| Analytics and reporting | Mod Stats, Community Health Dashboard, Mod Snapshot | Generate reports and dashboards | Firewatch should keep only incident-level metrics. Community analytics is a separate product. |
| Single-purpose utilities | Repost Radar, FlairGuard, Sticky Pro, Redact Helper, Scan Slop | Solve one specific moderation task | Firewatch can learn reliability patterns but should not absorb these whole products. |

## Firewatch's Best Differentiation

Firewatch should be judged against the direct competitors, not against every
single-purpose utility.

### What Firewatch Can Say That Others Cannot

- Queue sorters show the item. Firewatch shows the incident.
- Strike trackers remember the user. Firewatch shows the user inside the thread.
- Raid tools watch the community. Firewatch helps clean the thread.
- AutoMod tools write rules. Firewatch shows the real moderation work after rules
  and reports have created a mess.
- Modmail tools manage appeals. Firewatch handles the pre-appeal cleanup and
  records why the action happened.

This is the product boundary to protect.

## Direct Threats

### QueueIQ

Threat: Clear value proposition. "Reddit's mod queue is chronological. QueueIQ
doesn't." It has transparent scoring and inline actions.

Firewatch response:

- Keep the score explainable, but avoid competing as a generic queue ranker.
- Add a stronger incident evidence packet so Firewatch feels deeper than a ranked
  row.
- Make the top of the incident answer: "Why now? What changed? What remains?"

### Triage

Threat: Strong emotional pitch around crisis detection and urgent items.

Firewatch response:

- Add a conservative safety lane for self-harm, threats, doxxing, and minor
  safety language.
- Keep it advisory and transparent.
- Avoid overbroad automatic action.

### TriageBot

Threat: Very close to Firewatch conceptually: Rule Lens, Pattern Radar, Incident
Mode, Evidence Capsule, second-mod review, handoff text.

Firewatch response:

- Build Firewatch's version of Evidence Capsule.
- Add second-mod review.
- Make handoff more central.
- Make Firewatch's advantage the full thread cleanup workflow with Reddit-native
  actions, not just summaries.

### Receipts

Threat: Strong positioning as shared modqueue case files without scoring.

Firewatch response:

- Firewatch should be careful with language. Scores must feel like triage, not
  judgment.
- Add neutral "case packet" language and factual evidence.
- Keep comments, users, actions, and handoff in one place.

### Drama Radar

Threat: Very demoable and focused on high-conflict threads.

Firewatch response:

- Keep demo drills polished.
- Add a guided judge walkthrough.
- Make thread dynamics concrete: report spike, repeated phrase, reply cluster,
  active users, open comments.

### Raid Radar / RaidPulse

Threat: Strong one-click protection story.

Firewatch response:

- Do not become a community lockdown tool.
- Add watch/snooze states for threads.
- Consider an "escalating fast" signal inside a thread when comment/report
  velocity jumps.

### ModTower / Strike System / RecidivWatch

Threat: User memory and progressive enforcement are easy for judges to
understand.

Firewatch response:

- Add user priors inside incident review.
- Keep them factual: recent removals, Firewatch strikes, reports, mod notes.
- Do not introduce a moral reputation score unless it is very defensible.

### Sky For Redbrain / Sentinel AI

Threat: Ambitious, adaptive, AI-heavy dashboards.

Firewatch response:

- Win on trust, speed, and restraint.
- No black-box model needed.
- If adding intelligence, keep it deterministic or moderator-triggered.

### Mod Board

Threat: Deep team workflow with assignment, live state, notes, and user side
panel.

Firewatch response:

- Firewatch does not need modmail kanban.
- Firewatch should improve team coordination inside one incident: claim, second
  review, handoff, watch, snooze, and action log.

## Highest-Value Additions

These are ranked by hackathon value, Firewatch fit, and implementation risk.

### 1. Evidence Capsule

Priority: P0

Competitor signal:

- TriageBot has Evidence Capsule.
- Receipts has case-file context.
- ModGather has metadata packets.

Firewatch version:

Add a compact packet near the top of each incident:

- Top reason this is queued.
- Worst open comment.
- Main report reason.
- Watched domain or phrase.
- Most involved user.
- Last mod action.
- Recommended next step.

Why it helps:

Judges immediately understand the app in one glance. Mods do not have to scan
every panel before deciding what happened.

Avoid:

- Do not add a giant analytics card.
- Do not include every signal.
- Do not call it AI or evidence if it is only a score summary.

### 2. Undo Last Action

Priority: P0

Competitor signal:

- Triage has undo.
- OmniMod has bulk revert.
- ModScript has save undo and backups.
- vibe-mod has 30-day undo.

Firewatch version:

Add undo affordances for reversible incident actions:

- Approve after remove.
- Remove after approve.
- Lock/unlock.
- Mark/unmark NSFW.
- Mark/unmark spoiler.
- Ignore/unignore reports.
- Ban/unban only if current permissions and API support are clear.

Why it helps:

Undo is a trust feature. It makes Firewatch feel safer during high-pressure
moderation.

Avoid:

- Do not promise undo for actions that are not reliably reversible.
- If undo cannot be guaranteed, label it as the inverse Reddit action.

### 3. Bulk Comment Review

Priority: P0

Competitor signal:

- Sky For Redbrain has bulk actions.
- Mod Board has bulk selection.
- Queue tools emphasize faster clearing.

Firewatch version:

Inside the comments tab:

- Select comments.
- Approve selected.
- Remove selected with one shared reason.
- Mark selected as reviewed if appropriate.

Why it helps:

This directly improves the incident cleanup loop. It is not feature bloat.

Avoid:

- No cross-post bulk actions.
- No bulk ban by default.
- Keep destructive bulk actions behind confirmation.

### 4. Second-Mod Review

Priority: P1

Competitor signal:

- TriageBot has request second review.
- Mod Triage Board supports collaborators.
- Mod Board reduces duplicate replies.

Firewatch version:

Add an incident state:

- Request second review.
- Optional short reason.
- Shows who requested it and when.
- Shows in sidebar as "Second review".

Why it helps:

This proves Firewatch understands real mod teams, not just solo moderation.

Avoid:

- Do not create a whole ticketing workflow.
- Keep it one state and one note.

### 5. Watch and Snooze

Priority: P1

Competitor signal:

- Drama Radar has watch thread.
- Mod Board has snooze.
- Raid tools monitor changing state.

Firewatch version:

- Watch: keep incident visible and wake it when new reports/comments arrive.
- Snooze: hide from active queue until a timer or new signal wakes it.

Why it helps:

Mods often cannot decide immediately. This gives them a native-feeling way to
park a thread without pretending it is resolved.

Avoid:

- Do not add complex reminders or calendars.
- One or two fixed snooze durations are enough.

### 6. User Priors

Priority: P1

Competitor signal:

- RecidivWatch, VerdictBot, Strike System, ModTower, ReputiBot all promise user
  history.

Firewatch version:

In each user row, show factual priors:

- Open comments in this incident.
- Recent Firewatch strikes.
- Recent removals seen by Firewatch.
- Recent reports seen by Firewatch.
- Native mod note availability if present.

Why it helps:

The user section becomes more useful without becoming a standalone reputation
engine.

Avoid:

- Avoid "trust score" or "bad user" language.
- Avoid cross-community claims.
- Avoid history Firewatch cannot verify.

### 7. Safety Lane

Priority: P1

Competitor signal:

- Triage has crisis detection.
- OmniMod mentions doxxing and high-risk safety scans.
- aisafemod covers safety categories.

Firewatch version:

Add a conservative safety indicator for:

- Self-harm or suicide language.
- Doxxing or personal information exposure.
- Threats.
- Minor safety terms.

The output should be advisory:

- "Safety review"
- "Review before routine cleanup"
- "Do not auto-act from this signal alone"

Why it helps:

Safety is high-stakes and judge-relevant. It also shows responsible design.

Avoid:

- Do not over-detect.
- Do not auto-remove solely from this.
- Do not claim clinical or policy expertise.

### 8. False-Positive Tuning

Priority: P2

Competitor signal:

- Repost Radar has ignore lists and approval rollback.
- Sky has whitelists and ignore.
- GuardHub has dry run and audit logs.

Firewatch version:

After a mod approves a flagged comment or post, offer lightweight tuning:

- Ignore this word.
- Ignore this domain.
- Lower this signal weight.
- Keep watching without changing settings.

Why it helps:

This makes Firewatch feel like it learns from mod judgment without needing AI.

Avoid:

- Do not make automatic setting changes without confirmation.
- Do not bury the moderator in tuning prompts.

### 9. Prepared Reminder Templates

Priority: P2

Competitor signal:

- Sticky Pro has templates.
- Answer Triage has structured comments.
- FlairGuard has configurable warning/removal text.

Firewatch version:

Add 3 configurable thread reminder templates:

- Keep it civil.
- Stay on topic.
- Avoid support/scam links.

Make them available from the incident's post tools.

Why it helps:

Firewatch already deals with heated and scam threads. Prepared reminders make
intervention feel lighter than lock/remove.

Avoid:

- Do not add many templates.
- Do not make this a general sticky-comment product.

### 10. Judge Walkthrough Mode

Priority: P2

Competitor signal:

- Drama Radar has a three-state demo.
- ModScript has a guided walkthrough.
- Several apps seed demo data on install.

Firewatch version:

Add a small walkthrough for demo incidents:

1. Review why this post is here.
2. Open comments.
3. Take one comment action.
4. Save handoff.
5. Mark resolved.

Why it helps:

Judges need to understand the value quickly.

Avoid:

- Do not show tutorial text in normal production incidents.
- Keep walkthrough visible only on demo mode or first run.

## App-by-App Lessons

| # | App | Firewatch relevance | Useful lesson |
| --- | --- | --- | --- |
| 1 | RecidivWatch | Medium | User history is valuable, but it should appear as factual incident context, not as Firewatch's main product. |
| 2 | Drama Radar | High | Thread dynamics and demo clarity matter. Firewatch should make the thread's escalation story obvious. |
| 3 | DesiMode AI | Low/medium | Strike escalation and structured modmail are understandable, but broad AI moderation is risky for Firewatch. |
| 4 | xcancel-bot | Low | Strong narrow utility; not a Firewatch direction. |
| 5 | RaidPulse | Medium/high | Timelines, resolved history, and incident reconstruction are useful. Community lockdown is outside scope. |
| 6 | ModTrials | Medium | Shadow testing and false-positive labeling are trust patterns Firewatch can reuse for automations. |
| 7 | Community Playground | Low | Not a moderation competitor for Firewatch. |
| 8 | ModSandbox | Medium | Safe testing and visual match highlights are useful patterns for Firewatch automation testing. |
| 9 | SubNotify | Low | User opt-in notifications are not Firewatch's lane. |
| 10 | WholesomeShield | Medium | Conservative defaults and duplicate-trigger protection are useful reliability signals. |
| 11 | Community Kanban Board | Low/medium | Reddit-native attribution for user text is a good safety pattern, but public planning is unrelated. |
| 12 | QueueIQ | High | Transparent scoring plus inline actions is a direct threat. Firewatch must be deeper than a ranked queue row. |
| 13 | FlairGuard | Low/medium | Grace periods and clear user messaging are useful, but flair enforcement is a separate tool. |
| 14 | Automod Wizard | Medium | Round-trip preservation and onboarding recovery are strong reliability patterns. Avoid becoming AutoMod tooling. |
| 15 | Repost Radar | Medium | Dry run, ignore lists, approval rollback, and false-positive handling are very relevant trust features. |
| 16 | VerdictBot | Medium | Consistent enforcement ladders are useful, but Firewatch should keep user enforcement inside incident context. |
| 17 | OmniMod | Medium/high | Ledger, revert, and export are strong. Firewatch should add smaller action undo, not a full ledger product. |
| 18 | vibe-mod | Medium | Shadow mode, guarded actions, and undo are highly relevant to Firewatch automations. |
| 19 | Mod Notes Memo | Medium | Private context on the item is exactly aligned with Firewatch handoff and final notes. |
| 20 | ModTower | High | User priors, claim locks, and shared notepad overlap with Firewatch. Firewatch should integrate these inside incidents. |
| 21 | AutoMod Playground | Low/medium | Rule testing is useful, but outside Firewatch's primary lane. |
| 22 | Sentinel AI | Medium | Detector toggles and evidence summaries are useful, but AI-heavy positioning is risky. |
| 23 | Raid Radar | Medium/high | One-tap emergency response is memorable. Firewatch should own thread watch/snooze, not subreddit lockdown. |
| 24 | FlairGuard | Low/medium | Moderator-applied flair as trigger is useful inspiration for future automation triggers. |
| 25 | Mod Stats | Low | Analytics is a separate product. Firewatch should only keep incident-level impact stats. |
| 26 | Community Roster | Low | Member database is not Firewatch. Avoid scope creep. |
| 27 | ModRelayHQ | Low/medium | Dry-run preview and permission checks are useful, cross-community relay is outside scope. |
| 28 | Triage | High | Crisis sorting, undo, and real-time sync are major trust features. Firewatch should add safety lane and undo. |
| 29 | Redact Helper Bot | Low | Retroactive cleanup is useful but too narrow and unrelated. |
| 30 | ecidivWatch | Medium | Duplicate of RecidivWatch lessons. |
| 31 | Mod Triage Board | High | Claim, collaborator, notes, stale items, and handoff are directly relevant. Firewatch should add second review and snooze. |
| 32 | ModGather | Medium | Structured metadata packets are useful. Firewatch should add an Evidence Capsule. |
| 33 | AuraCouncil | Low | User draft coaching is outside Firewatch. |
| 34 | aisafemod | Low/medium | Category thresholds are useful only if Firewatch later adds safety classifiers. |
| 35 | GuardHub Filter Guard | Low/medium | Dry run and audit logs are relevant to automations, but gate rules are outside scope. |
| 36 | GuardHub User Guard | Medium | Account age/karma/user identity signals are useful as user priors, not as a separate gate engine. |
| 37 | Community Health Dashboard | Low | Broad health analytics should not be added. |
| 38 | Ban Appeal Manager | Low/medium | Audit logs and structured decisions are useful, but appeals are a separate workflow. |
| 39 | ReputiBot | Medium | Trust reports are tempting but risky. Firewatch should stick to factual user priors. |
| 40 | ZenQueue-Mod | Low/medium | Cooldown/structured aftermath is interesting, but modmail appeals are outside Firewatch. |
| 41 | Sky For Redbrain | High | Highlighted reasons, ignore, undo, and model caution are useful. Avoid its broad ML ambition. |
| 42 | Strike System | Medium | Rule dropdowns and user history before action are useful. Firewatch already has strikes; improve context. |
| 43 | GuardHub Domain Guard | Medium | Domain rules and audit mode align with Firewatch watched domains. Do not build a full domain product. |
| 44 | SG-1 Responder | Low | Engagement bot, not a mod incident competitor. |
| 45 | GuardHub Word Guard | Medium | Text normalization, rule groups, and audit logs are useful for watched words. |
| 46 | Answer Triage | Medium | Structured sticky/comment templates are useful for Firewatch reminders. |
| 47 | TriageBot | Very high | Closest conceptual competitor. Evidence Capsule, second review, incident mode, and handoff are must-study. |
| 48 | Notice Board | Low | Announcement UI is outside Firewatch. |
| 49 | duplicate-detector | Low/medium | Precheck/queue split is interesting, but duplicate detection is outside Firewatch. |
| 50 | Judgment Bot | Low | Community voting workflow is unrelated. |
| 51 | ModScript | Medium | Risk badges, verified saves, undo, and guided demos are strong trust patterns. |
| 52 | Mod Snapshot | Low | Configuration backup is useful but unrelated. |
| 53 | Receipts | Very high | Strong case-file framing. Firewatch should make its incident record feel like a shared case packet. |
| 54 | Mod Board | Medium/high | Assignment, snooze, side panel, and sticky user notes are useful coordination patterns. Avoid full modmail board scope. |
| 55 | AI Checker | Low | Manual-only AI is safer than auto AI, but AI detection is unrelated. |
| 56 | Modmail Translator | Low | Modmail translation is outside scope. |
| 57 | Sticky Pro | Medium | Reliable templates and direct menu actions are useful for Firewatch reminder templates. |
| 58 | Scan Slop | Medium | Verification and repeated link thresholds are relevant to scam incidents, but captcha is outside scope. |

## Product Principles For New Features

1. Add only features that help resolve a hot thread.

   If a feature is about whole-community analytics, modmail management, AutoMod
   authoring, member rosters, or public engagement, it is probably not
   Firewatch.

2. Keep all recommendations factual and explainable.

   Firewatch can say "3 watched word matches" or "2 comments from this user are
   still open." It should avoid "this user is bad" or "AI says remove."

3. Put safety features before power features.

   Undo, second review, false-positive handling, and clear action history are
   more important than more automations.

4. Prefer thread-level depth over subreddit-level breadth.

   The product should feel complete inside one incident. That is the strongest
   differentiator.

5. Keep Reddit-native actions close to evidence.

   A mod should see the reason, the target, and the action in the same place.

## Recommended Build Plan

### Phase 1: Trust And Clarity

Build these first:

- Evidence Capsule.
- Undo/inverse actions in the action log.
- Bulk comment review.

Reason:

These immediately improve the core incident workflow and make Firewatch feel
more mature than a demo dashboard.

### Phase 2: Team Workflow

Build next:

- Second-mod review.
- Watch.
- Snooze.
- Stronger handoff prominence.

Reason:

These features make Firewatch feel like it was built for real mod teams.

### Phase 3: Better Context

Build after the core workflow is stable:

- User priors.
- Safety lane.
- False-positive tuning.

Reason:

These deepen trust, but they need careful language and state handling.

### Phase 4: Demo And Submission Polish

Build last:

- Judge walkthrough mode.
- README/app listing updates that emphasize the incident-room thesis.
- Demo script that shows one complete cleanup pass.

Reason:

Judges need to see the full loop quickly.

## Features To Avoid

Avoid these unless Firewatch's core loop is already complete:

- AutoMod YAML builder.
- Full modmail board.
- Ban appeal portal.
- Community analytics dashboard.
- Cross-community relay.
- Captcha verification.
- AI-generated moderation decisions.
- Image repost detection.
- Public announcement boards.
- Full user reputation scoring.

These are legitimate products, but they dilute Firewatch.

## Final Strategic Position

Firewatch should not try to be the biggest app in the competition.

It should try to be the most coherent moderation app:

- It detects when a thread needs attention.
- It explains why in plain Reddit terms.
- It lets a mod review the exact comments and users.
- It provides Reddit-native actions at the point of evidence.
- It records the cleanup.
- It lets the next mod understand the case.
- It closes the incident when the work is done.

That is a winning product shape because it is concrete, visual, falsifiable, and
hard for a narrow competitor to copy without becoming Firewatch.
