# Firewatch Reliability Audit

Date: 2026-05-26

Scope: current Firewatch codebase, with emphasis on data correctness, native
Reddit action consistency, Devvit runtime stability, demo reliability, and
anything that can make the app feel less dependable to moderators or judges.

This started as an audit document. The issues below were worked through in the
follow-up reliability pass; keep the finding text as the original diagnosis.

## Resolution Update

The follow-up pass addressed the reliability issues in app-owned code:

- Native Reddit reads and mutations now go through shared runtime wrappers with
  transient-read fallback, pending/succeeded/failed action records, and
  per-target bulk action results.
- Bulk comment, undo, and user-content cleanup paths record only successful
  native targets and surface partial failures.
- Queue indexes are subreddit-scoped, claim state is synchronized, remembered
  stale selections are ignored, and reset paths clean Firewatch-owned Redis keys
  plus demo/queue posts on Reddit on a best-effort basis.
- Dashboard queue reads no longer refresh every stored incident. The selected
  incident can still refresh for current Reddit state, mutation refresh
  failures preserve the last good state, trigger failures are logged without
  failing the Devvit hook, trigger timestamps are sanitized, and route errors
  use typed retryable codes for transient Reddit failures.
- Automations enforce trigger and scope matching, fail closed when moderator
  exclusion cannot verify the moderator list, and auto-run all requires the
  claiming moderator as actor.
- Automations and Firewatch strike summaries persist until explicit reset or
  deletion, while incidents, claims, and rule logs keep bounded retention.
- Demo APIs return batch partial results, demo wording is honest about sample
  review signals, and docs no longer claim demo comments are real Reddit
  comments.
- Capped signals/comments now expose omitted counts in the model and UI.
- Server reliability logs now use structured Firewatch log codes instead of
  scattered plain `console.error` calls.
- The app no longer raises Vite's chunk-size warning limit. The remaining build
  warnings come from the current published `@devvit/start@0.12.24` Vite plugin,
  which hardcodes `sourcemapFileNames` and `inlineDynamicImports`; the project
  is already pinned to that latest Devvit version.

## Executive Summary

Firewatch is now much stronger than a simple demo app: it has permission checks,
claim ownership, deterministic scoring, native Reddit actions, automation logs,
demo drills, and delete-trigger cleanup. The main remaining reliability risks
are not UI polish. They are consistency and runtime risks around:

- too much Reddit API work during dashboard reads
- native Reddit actions and Firewatch Redis state drifting apart
- bulk actions succeeding partially but being recorded as one all-or-nothing
  result
- broad user-content cleanup that can remove more content than the current
  review queue implies
- global or split persistence keys that can drift across communities or between
  Redis records
- demo reset and app reset semantics that do not fully match "delete
  everything"
- weak typed error reporting for partial, retryable, and native Reddit failures
- tests that often assert source strings instead of behavior

The app is not broken, but the issues below are the ones most likely to create a
"this feels unstable" moment during judging or real moderator use.

## Severity Key

- Critical: can cause wrong moderation action, data exposure, or major state
  corruption.
- High: can cause visible stale state, failed workflows, partial action drift,
  or judge-facing instability.
- Medium: can confuse moderators, weaken trust, or create long-term maintenance
  risk.
- Low: polish, documentation, or tooling drift that should be cleaned up.

## Critical Findings

### REL-01: Native Reddit actions can succeed while Firewatch fails to record them

Evidence:

- `src/server/core/firewatch/actions/post-actions.ts` performs the Reddit action
  first, then calls `appendAction`.
- `src/server/core/firewatch/actions/comment-actions.ts` approves/removes
  native comments first, then calls `appendAction`.
- `src/server/core/firewatch/actions/user-actions.ts` can remove content or ban
  a user before the Firewatch action log is saved.
- `src/server/core/firewatch/incidents.ts` `appendAction` refreshes and saves
  after constructing the action.

Why it matters:

If a Reddit API mutation succeeds, but `appendAction`, `refreshIncident`, or
`saveIncident` fails afterward, Reddit has changed but Firewatch may still show
the old state. A moderator may retry and double-act, or the audit trail may miss
the action.

Examples:

- post remove succeeds, action log write fails
- comment approve succeeds, Firewatch still shows it as open
- ban succeeds, Firewatch does not record the ban
- sticky comment posts, status/log update fails

Recommended fix:

Introduce an action ledger with explicit statuses:

1. Write `pending` action intent before native mutation.
2. Run the Reddit action.
3. Mark the action `succeeded` with native target IDs.
4. If native mutation fails, mark it `failed` with a safe error message.
5. Reconcile pending actions on next incident refresh.

This is the highest-value reliability improvement because it protects the trust
boundary between Reddit and Firewatch.

### REL-02: Bulk actions can partially mutate Reddit but fail as a whole

Evidence:

- `src/server/core/firewatch/actions/comment-actions.ts` uses `Promise.all` in
  `bulkReviewComments` for approve/remove.
- `src/server/core/firewatch/actions/comment-actions.ts` uses `Promise.all` for
  `remove-thread`.
- `src/server/core/firewatch/actions/undo-actions.ts` uses `Promise.all` while
  applying comment toggles.
- `src/server/core/firewatch/actions/user-actions.ts` uses `Promise.all` when
  removing tracked comments for a user.

Why it matters:

`Promise.all` rejects on the first failure, but earlier items may already have
been changed on Reddit. Firewatch then does not know which target IDs succeeded.
This can show an error while some comments were actually removed or approved.

Recommended fix:

Use per-target result collection:

- `Promise.allSettled` or a sequential loop
- record successful target IDs only
- record failed target IDs separately
- return a typed partial-success response to the client
- show "3 removed, 1 failed" instead of a generic failure

### REL-03: "Remove recent user content" is too broad for a queue action

Evidence:

- `src/server/core/firewatch/actions/user-actions.ts`
  `removeRecentUserContent` fetches up to 1000 recent comments/posts by user:
  `getCommentsAndPostsByUser({ limit: 1000, pageSize: 100 })`.
- It filters only by subreddit and skips already approved/removed content.
- It can remove content beyond the current Firewatch incident.

Why it matters:

The UI context is a post review queue. A moderator may expect this action to
remove the user's open comments in this incident, but the implementation can
remove many recent subreddit items. That is powerful and risky, especially if
the user has mixed good and bad content.

Recommended fix:

Make this a preview-first action:

- default to unresolved Firewatch comments only
- show a preview count and sample before broader cleanup
- require an explicit max age and max count
- record each removed target individually
- make the destructive label say exactly what scope will be removed

## High Findings

### REL-04: Dashboard reads mutate and refresh too much state

Evidence:

- `src/server/core/firewatch/signals.ts` `getIncidents` refreshes every indexed
  incident, saves each refreshed incident, filters the index, then refreshes up
  to 100 registry entries to find resolved incidents.
- `src/server/routes/api.ts` `/api/init` calls `loadDashboardData`, which calls
  `getIncidents`.

Why it matters:

Opening the dashboard can fan out into many Reddit reads:

- post snapshot reads
- flagged comment hydration reads
- automation scope checks
- resolved incident refreshes

This can create the exact runtime failure already seen in logs:
`1 CANCELLED: Call cancelled`. It also means a read-only UI load can mutate
scores, status, trend, matched rules, and index order.

Recommended fix:

Separate read from refresh:

- `/api/init` should load stored incidents quickly.
- Refresh only the selected incident by default.
- Add an explicit "Refresh" action for full queue hydration.
- Cache native Reddit snapshots with a short TTL.
- Do not refresh resolved incidents on every init.

### REL-05: Native comment state hydration fails silently

Evidence:

- `src/server/core/firewatch/incidents.ts` `applyNativeCommentState` catches
  failures from `reddit.getCommentById` and returns the stored comment without
  marking it stale.

Why it matters:

If Reddit comment reads fail, Firewatch can display outdated lock, approval,
ignore-reports, spam, report count, or removed state. The user sees a normal
comment row and cannot tell that Firewatch is using stale local state.

Recommended fix:

Track hydration metadata per incident or per comment:

- `nativeStateCheckedAt`
- `nativeStateStatus: "fresh" | "stale" | "unavailable"`
- optional `nativeStateErrorCode`

Then show a quiet inline warning only when needed.

### REL-06: Reddit read retry/fallback is only implemented for post snapshots

Evidence:

- `src/server/core/firewatch/incidents.ts` has retry/fallback for
  `getPostSnapshot`.
- Other direct reads still call native APIs without the same retry wrapper:
  - `src/server/core/firewatch/actions/post-actions.ts`
  - `src/server/core/firewatch/actions/comment-helpers.ts`
  - `src/server/core/firewatch/actions/undo-actions.ts`
  - `src/server/core/firewatch/board.ts`
  - `src/server/core/firewatch/demo.ts`

Why it matters:

The app fixed one major `getPostById` cancellation path, but native action
paths and demo reset can still fail on the same transient Devvit/Reddit errors.

Recommended fix:

Centralize native Reddit reads:

- `readPostSnapshotOrStored`
- `getPostForAction`
- `getCommentForAction`
- `isTransientRedditError`
- standard retry delays and typed failure results

Use these wrappers everywhere.

### REL-07: Claim ownership has two sources of truth

Evidence:

- `src/server/core/firewatch/incidents.ts` `claimIncident` writes both
  `claimKey(postId)` and the `incident.claim` field.
- `src/server/routes/api.ts` `requireIncidentClaim` checks the incident field,
  not the separate claim key.
- `unclaimIncident` deletes the claim key and then saves the incident without a
  claim.

Why it matters:

If Redis write order is interrupted, `claimKey` and `incident.claim` can drift.
The server gate can then allow or deny actions based on stale incident data.

Recommended fix:

Use one source of truth:

- either store claim only inside the incident
- or always hydrate `incident.claim` from `claimKey` before checks

Also add a repair path when the two values disagree.

### REL-08: Claim enforcement is route-level, not action-layer guaranteed

Evidence:

- `src/server/routes/api.ts` `claimedIncidentAction` enforces claim ownership.
- Core mutation functions like `removeFlaggedComment`, `applyNativePostAction`,
  `banUserAndRemoveComments`, `coolDownIncident`, and `resolveIncident` do not
  independently verify the claim.
- Automation paths call core action functions from
  `src/server/core/firewatch/automation.ts`.

Why it matters:

The current API routes are mostly protected, but future endpoints or menu
actions can bypass the claim gate by calling core functions directly. This is a
maintainability reliability issue: the invariant is not enforced where the
mutation actually happens.

Recommended fix:

Create a single action service entry point:

- verifies moderator permission
- verifies claim ownership
- validates action controls
- executes action ledger
- records result

Core mutation helpers should not be exported in a way that bypasses that gate.

### REL-09: Queue index is global, not subreddit-scoped

Evidence:

- `src/server/core/firewatch-constants.ts` defines `INDEX_KEY = 'fw:index'`.
- `src/server/core/firewatch/store.ts` `getIndex`, `saveIndex`, `addToIndex`,
  and `removeFromIndex` all use the same global key.
- Other keys are subreddit-scoped, such as config, board post, registry, rules,
  and rule logs.

Why it matters:

If the app is installed in more than one community, unresolved queue IDs can
collide in a single global index. That can make one subreddit load another
subreddit's incident IDs, then fail to refresh or show wrong queue counts.

Recommended fix:

Replace `INDEX_KEY` with `indexKey(subredditName)`.

Migration path:

- read old `fw:index` once
- keep only incidents whose stored `subredditName` matches the current context
- write to the new scoped key
- then delete or ignore the legacy global key

### REL-10: Saving an incident is not atomic across registry, incident, and index

Evidence:

- `src/server/core/firewatch/store.ts` `saveIncident` writes registry first,
  then the incident record, then adds/removes the index.

Why it matters:

A failure in the middle can leave:

- registry points to missing incident
- incident exists but is not in the queue index
- resolved incident remains in the active index

The app has some filtering and repair behavior, but the write path itself can
still produce inconsistent state.

Recommended fix:

Prefer this order:

1. Save incident body.
2. Update queue index.
3. Update registry.
4. On dashboard load, run a cheap reconciliation pass for missing IDs.

Also return and log a structured consistency warning when repair occurs.

### REL-11: Full app reset does not delete Reddit-side app artifacts

Evidence:

- `src/server/core/firewatch/store.ts` `resetAppData` deletes Redis keys only.
- It deletes `boardPostKey(subredditName)` but does not delete the custom
  Firewatch queue post on Reddit.
- It does not call `resetDemoIncidents`, so demo Reddit posts are not deleted
  through the full app reset path.

Why it matters:

The UI says "Delete all Firewatch data." A moderator may expect Firewatch demo
posts and app-created queue posts to disappear too. The separate demo reset does
delete demo Reddit posts, but full app reset does not.

Recommended fix:

Decide and document one exact contract:

- "Delete stored Firewatch data only" and keep Reddit posts, or
- "Delete all Firewatch-owned data and demo posts" and best-effort delete the
  board post plus demo posts before clearing Redis.

Given the current product language, the second behavior is more consistent.

### REL-12: Demo reset can abort internal cleanup when Reddit post deletion fails

Evidence:

- `src/server/core/firewatch/demo.ts` `resetDemoIncidents` calls
  `deleteDemoRedditPost(postId)` before deleting incident keys.
- `deleteDemoRedditPost` rethrows non-missing errors.

Why it matters:

If Reddit deletion fails for one demo post, the loop stops before cleaning the
internal queue state. The UI can keep showing demo incidents even though the
user clicked reset.

Recommended fix:

Make Reddit deletion best-effort:

- try deleting each Reddit post
- always remove Firewatch internal demo state
- collect failed Reddit deletes
- show "Demo state reset. 1 Reddit post could not be deleted; try again later."

### REL-13: Trigger handlers lack a shared safe wrapper

Evidence:

- `src/server/routes/triggers.ts` wraps only `/on-app-install` in try/catch.
- Most trigger routes directly call `upsertIncidentSignal` or delete helpers
  and then return `ok`.

Why it matters:

Any parsing, Redis, or Reddit API error can fail the whole trigger. Failed
triggers mean lost signals and noisy Devvit logs. For moderation tools, missing
a report or delete trigger can create stale queue data.

Recommended fix:

Add a `safeTrigger` wrapper:

- logs trigger type, post ID, comment ID, and non-sensitive error code
- never logs full private-sensitive bodies
- returns `ok` for recoverable failures
- optionally stores a small diagnostic counter in Redis

### REL-14: Invalid trigger timestamps can poison incident scoring

Evidence:

- `src/server/routes/triggers.ts` `eventTimestamp(value?: string)` returns
  `new Date(value).getTime()` without checking `Number.isFinite`.

Why it matters:

Invalid dates become `NaN`. A `NaN` timestamp can break one-hour filtering,
trend buckets, updatedAt calculations, and sorting.

Recommended fix:

Validate timestamps:

```ts
const timestamp = value ? new Date(value).getTime() : Date.now();
return Number.isFinite(timestamp) ? timestamp : Date.now();
```

### REL-15: Client can report failure after a mutation already succeeded

Evidence:

- `src/client/firewatch/use-dashboard.ts` `runAction` performs the mutation,
  updates the incident, sets a success notice, then awaits `refresh()` inside
  the same `try`.
- `saveDashboardConfig`, `saveAutomation`, `importRuleTemplates`, and
  `disableAllRules` follow the same pattern.

Why it matters:

If the mutation succeeds but the follow-up refresh fails, the `catch` path shows
a failure message. This is especially confusing for moderation actions because
the Reddit action may already have happened.

Recommended fix:

Separate mutation failure from refresh failure:

- mutation success should stay success
- refresh failure should show "Action saved, but refresh failed. Press refresh."
- return the updated incident from the successful mutation immediately

### REL-16: Error responses are not typed enough for reliability

Evidence:

- `src/server/routes/responses.ts` returns `{ status: 'error', message }`.
- Non-permission failures all use HTTP 400.
- `src/client/firewatch/api-client.ts` throws only `Error(message)`.

Why it matters:

The client cannot distinguish:

- permission denied
- stale claim
- validation error
- transient Reddit API failure
- partial success
- internal bug

Recommended fix:

Extend `ErrorResponse`:

```ts
type ErrorResponse = {
  status: 'error';
  code:
    | 'permission_denied'
    | 'claim_required'
    | 'claim_conflict'
    | 'validation_error'
    | 'reddit_unavailable'
    | 'partial_success'
    | 'internal_error';
  message: string;
  retryable?: boolean;
};
```

Use 409 for claim conflicts, 422 for validation, 503 for retryable Reddit
failures, and 500 for internal errors.

### REL-17: Automation execution can partially run without complete execution logs

Evidence:

- `src/server/core/firewatch/automation.ts` `runPreparedRuleActions` executes
  prepared actions in sequence.
- It records the rule execution log after the loop.
- If an action succeeds and a later action throws, the earlier action may be
  applied without a rule execution log for that run.

Why it matters:

Automations are a trust-heavy feature. The UI promises visible playbooks and
auditability. Partial automation execution without accurate logging undermines
that trust.

Recommended fix:

Record per-action execution state:

- before each action: `started`
- after success: `succeeded`
- after failure: `failed`
- continue or stop according to rule policy

The rule execution log should survive partial failure.

### REL-18: Automation "auto-run all" can run as Firewatch once any mod has claimed

Evidence:

- `src/server/core/firewatch/automation.ts` `requireAutomationClaim` skips
  ownership matching when `actor === 'firewatch'`.
- `runAutoAllRuleActions` calls `runPreparedRuleActions(..., 'firewatch', ...)`.

Why it matters:

The app recently introduced "claim before actions." Auto-run-all requires a
claim to exist, but does not require the claimant to be the actor that confirms
execution. This may be intended for automation, but it is a subtle exception
that should be explicit in UI and docs.

Recommended fix:

For hackathon stability, safest behavior is:

- auto-run safe Firewatch-only actions may run after any claim
- auto-run all Reddit-native actions should require explicit mod execution, or
  record the claimant as the responsible actor

If kept, document the exception in README and automation UI.

## Medium Findings

### REL-19: Moderator exclusion in automation scope can fail open

Evidence:

- `src/server/core/firewatch-rules/scope.ts` `getModeratorUsernames` catches
  Reddit moderator list failures and returns only known moderators from action
  history.

Why it matters:

Rules with `excludeModerators` may still match moderators if Reddit moderator
list fetching fails and those moderators have not appeared in action history.

Recommended fix:

Fail closed for rules that explicitly require moderator exclusion:

- mark scope as unresolved when moderator list cannot load
- skip matching those rules
- log "Skipped: could not verify moderator list"

### REL-20: Incident score and reasons are current-window values, but the UI can read like durable truth

Evidence:

- `src/server/core/firewatch-scoring.ts` filters `recentSignals` to the last
  hour for current scoring.
- It preserves peak score/reasons, but current reasons, involved users, and
  trend are recalculated from the current window.

Why it matters:

A post can have a high peak because it was risky earlier, then later show fewer
current reasons. That can confuse moderators if labels do not clearly separate
"current" from "peak."

Recommended fix:

Make the data model explicit:

- `currentScore`
- `peakScore`
- `currentReasons`
- `peakReasons`
- `lastSignalAt`

Use the UI language "Why now" for current reasons and "Peak reason" for history.

### REL-21: Hard caps can drop context without warning

Evidence:

- `MAX_RECENT_SIGNALS = 80`
- `MAX_FLAGGED_COMMENTS = 12`
- index cap: `saveIndex(...slice(0, 100))`
- registry cap: `saveStringList(...slice(0, 500))`
- resolved incident display cap: 25
- rule log cap: `MAX_RULE_LOGS`

Why it matters:

Caps are necessary in Devvit, but moderators are not told when Firewatch has
truncated context. Large threads can exceed these caps and lose older signals,
comments, users, or logs.

Recommended fix:

Track truncation metadata:

- `signalCountTotal`
- `signalCountStored`
- `flaggedCommentCountTotal`
- `truncated: true`

Show a small "showing top 12 review comments" note when relevant.

### REL-22: Demo comments are synthetic Firewatch signals, not real Reddit comments

Evidence:

- `src/server/core/firewatch/demo.ts` creates one real Reddit post with
  `reddit.submitPost`.
- Demo comments use IDs like `t1_fw_demo_*` and enter the incident through
  `upsertIncidentSignal`.

Why it matters:

Inside Firewatch the demo is useful and fast. But if judges open the Reddit
post, they will not see the same comments there. That can feel inconsistent
unless the demo is clearly explained.

Recommended fix:

Either:

- create real Reddit comments for demos if Devvit supports it reliably, or
- explicitly label the demo comments as "sample review signals" in the demo
  explanation, not as actual Reddit comments.

### REL-23: Demo multi-create hides partial failures at the API boundary

Evidence:

- `src/server/core/firewatch/demo.ts` `createDemoIncidents` catches each
  scenario failure, returns the latest successful incident if any succeeded,
  and throws only if none succeeded.
- The client currently fans out one request per scenario, but the API still
  supports a bulk `scenarioIds` input.

Why it matters:

If a future caller uses the bulk endpoint, partial failure can look like a
normal success because only one incident is returned.

Recommended fix:

Return a proper bulk response:

- created incidents
- failed scenario IDs
- error messages
- selected latest incident

### REL-24: Full reset can miss orphaned user strike keys

Evidence:

- `src/server/core/firewatch/store.ts` `resetAppData` builds strike keys from
  `userRegistryKey`, incident authors, claims, actions, comments, and signals.
- Redis key listing is not available, so any old or orphaned user strike key not
  represented in those lists can remain.

Why it matters:

The UI says full reset deletes stored records. Old strike keys from previous
versions or registry drift can remain and later affect user automation matches.

Recommended fix:

Keep a durable, subreddit-scoped registry for every generated key family.
Register user strike keys whenever they are written, not only usernames.

### REL-25: Automations and strike registries expire after 30 days

Evidence:

- `src/server/core/firewatch-rules/store.ts` saves automations with
  `retentionExpiration()`.
- `src/server/core/firewatch-rules/strikes.ts` saves user registry and strikes
  with `retentionExpiration()`.

Why it matters:

Rule expiration is documented in the privacy policy, but it is a surprising
product behavior. A moderation team may expect configured automations to persist
until changed.

Recommended fix:

For user trust, either:

- make automations/config durable until explicit deletion, or
- add UI copy: "Automations expire after 30 days unless updated."

For hackathon polish, durable automations are more impressive and less risky.

### REL-26: Board post recovery can recreate duplicate queue posts

Evidence:

- `src/server/core/firewatch/board.ts` reads `boardPostKey`.
- If `reddit.getPostById(storedPostId)` fails, it logs and creates a new custom
  post.

Why it matters:

Transient Reddit read failures can create duplicate Firewatch board posts. The
old post may still exist, but Firewatch loses the pointer and creates another.

Recommended fix:

Use the same transient retry wrapper as post snapshots. Only recreate the board
post after a verified missing/deleted response.

### REL-27: Detection intentionally handles common obfuscation but remains easy to evade

Evidence:

- `src/server/core/firewatch-detection.ts` detects normal domains,
  `hxxp(s)`, and `(dot)` / `[dot]` style obfuscation.
- It does not handle many common evasions such as spaces between all letters,
  homoglyphs beyond NFKC, punycode lookalikes, URL shortener redirects, or
  image-only links.

Why it matters:

This is acceptable for deterministic hackathon scope, but copy should avoid
implying full scam detection. It is a watched-word/domain signal engine, not a
complete abuse detector.

Recommended fix:

Add a "known limits" note in developer docs and consider:

- expanded obfuscation normalization
- punycode normalization
- allow mods to add local regex rules
- tests for false positives and false negatives

### REL-28: Repeated phrase extraction may surface low-value phrases

Evidence:

- `src/server/core/firewatch-scoring/helpers.ts` extracts 2- and 3-token
  phrases after a small stop-word list.
- It counts each phrase once per signal and keeps top 6.

Why it matters:

Repeated wording is useful, but short phrases can still be generic. If it
surfaces weak phrases, moderators may distrust the score.

Recommended fix:

Improve phrase quality:

- require at least two distinct authors for high-confidence repeated wording
- weight 3-token phrases above 2-token phrases
- expand stop words based on real Reddit data
- add tests with realistic discussion text

### REL-29: Permission checks are good, but load does duplicate permission work

Evidence:

- `src/server/routes/api.ts` `/api/init` first calls `getModeratorAccess`.
- `loadDashboardData` then calls `getModeratorAccess` again in `Promise.all`.

Why it matters:

This is not a security bug, but it adds a redundant Reddit API call to the
critical dashboard load path.

Recommended fix:

Pass the already-loaded access object into `loadDashboardData`.

### REL-30: Non-config moderators get sanitized config but action controls still leak some settings intent

Evidence:

- `src/server/routes/api.ts` `reviewVisibleConfig` returns `EMPTY_CONFIG` plus
  `actionControls` and `reminderText` for moderators without config permission.

Why it matters:

This is probably acceptable: action controls are needed to render available
actions. But if a community treats reminder text or enabled controls as private
configuration, this is still partial configuration disclosure.

Recommended fix:

Document this exactly. Or split config into:

- `reviewRuntimeConfig` for action availability
- `settingsConfig` only for config-authorized mods

### REL-31: Selected incident memory can point at stale/deleted incidents

Evidence:

- `src/server/core/firewatch/store.ts` stores per-moderator selected post ID.
- `loadDashboardData` tries to merge the selected incident if found.
- `deleteStoredPostContent` clears only current user's remembered selection
  indirectly in some paths, not all moderators' selections.

Why it matters:

A mod may reopen Firewatch and get no selected incident or a stale context after
another mod resets/deletes content.

Recommended fix:

When deleting an incident, clear selection keys for known moderators or ignore
selected IDs that no longer exist without trying to refresh them.

### REL-32: Current test suite relies heavily on source-code string assertions

Evidence:

- `tests/shared-helpers.test.mjs` imports some compiled helpers, but many tests
  read source files and assert regex matches.

Why it matters:

String tests can catch accidental deletion of important branches, but they do
not prove behavior. They can pass while runtime behavior is wrong, or fail
during harmless refactors.

Recommended fix:

Add behavior tests with fake Reddit and Redis adapters for:

- scoring and flagged comment durability
- claim ownership conflicts
- bulk partial success
- reset behavior
- automation run logs
- route permission failures
- demo creation/reset

Keep a small number of source assertions for architecture invariants only.

## Low Findings

### REL-33: Build/tooling warnings remain normalized instead of fixed

Evidence:

- `npm run build` previously passed but emitted warnings about invalid
  `sourcemapFileNames` and deprecated `inlineDynamicImports`.
- Before the resolution pass, `vite.config.ts` raised
  `chunkSizeWarningLimit` to 2500, hiding any large chunk warning rather than
  exposing the real bundle state.

Why it matters:

Not a runtime issue today, but Devvit/Vite updates can turn deprecated options
into failures. Large client bundles also make first load feel slower inside
Reddit.

Recommended fix:

- Remove invalid output options if they are generated by Devvit config, or pin
  to a known-good Devvit/Vite combination.
- Keep `splash.html` extremely light.
- Lazy-load settings/automation views if supported by Devvit bundling.

### REL-34: Release checklist is out of date for demo behavior

Evidence:

- `docs/release-checklist.md` still says "creating a new demo clears old demo
  queue state and demo strikes."
- Current behavior is additive: existing demo threads stay until reset.

Why it matters:

Docs drift makes final launch QA less reliable.

Recommended fix:

Update the checklist to say:

- multiple demo drills can be created
- demo reset deletes Firewatch demo queue items and Reddit demo posts
- app reset behavior is explicitly verified according to its final contract

### REL-35: Logs are useful but not structured enough for fast production debugging

Evidence:

- Before the resolution pass, most server paths used plain `console.error`.
- Errors often lack stable codes, action IDs, post IDs, subreddit name, and
  retryability.

Why it matters:

When `devvit logs` shows a runtime issue, debugging depends on bundled stack
traces and string messages. That slows down response during judging or live use.

Recommended fix:

Add a small logging helper:

```ts
logError('incident.refresh_failed', {
  postId,
  subredditName,
  operation: 'refreshIncident',
  retryable,
  error,
});
```

Do not log full user content bodies.

### REL-36: Some product claims need careful wording

Evidence:

- README says Firewatch includes demo drills that "create a real source post
  and feed the same signal pipeline used by production events."
- That is accurate, but demo comments are not real Reddit comments.

Why it matters:

Judges and mods may inspect both Reddit and Firewatch. Anything that looks like
real Reddit state inside Firewatch but is only synthetic needs careful wording.

Recommended fix:

Use wording like:

"Demo drills create a real source post, then seed sample reports and comments
into Firewatch's review pipeline so moderators can test the workflow without
posting harmful comments on Reddit."

## Stability Strengths Already Present

These areas are good and should be preserved:

- Server-side moderator permission checks exist for dashboard data, settings,
  automations, user actions, flair actions, reset paths, menu actions, and
  forms.
- All menu items in `devvit.json` use `forUserType: "moderator"`.
- Claim gating is applied to the main mutation routes.
- The app has a plain access-denied UI instead of exposing private mod data.
- Delete triggers remove stored post/comment content.
- Post snapshot refresh now retries transient Reddit read errors and falls back
  to stored incident state.
- Automation matching now checks triggers and scope fields.
- Current demo posts avoid raw clickable URLs in post bodies.
- Type-check, lint, tests, and build have recently passed.

## Recommended Fix Order

1. Implement action ledger for native Reddit actions.
2. Change bulk actions to per-target partial success.
3. Scope `INDEX_KEY` by subreddit and migrate old index data.
4. Split dashboard read from selected-incident refresh.
5. Centralize Reddit native read/mutation wrappers with retry and typed errors.
6. Make full reset and demo reset semantics exact and best-effort safe.
7. Move claim enforcement into the action service layer.
8. Add typed error responses and client handling for retryable/partial results.
9. Add behavior tests with fake Reddit/Redis.
10. Update release checklist and demo wording.

## Judge-Facing Risk Checklist

Before final submission, verify these flows manually in playtest:

- dashboard opens quickly with 0, 1, and multiple incidents
- creating 1 demo succeeds
- creating multiple demos succeeds or reports exact partial results
- reset demos deletes the Reddit demo posts and Firewatch queue items
- full app reset matches the exact UI language
- claim by one mod blocks another mod from all actions
- losing Reddit read access shows stale-state warning instead of wrong
  certainty
- bulk comment remove with one failing target shows partial success
- automation run with a failing action logs the successful and failed steps
- app reload after every action shows the same state as before reload

## Bottom Line

Firewatch is much closer to a stable Reddit-native mod tool after this pass.
Native Reddit mutations now record attempted, succeeded, failed, and partial
target state, while dashboard reads avoid unnecessary Reddit refresh fan-out.
The remaining risk is runtime-only: real Devvit/Reddit API behavior should still
be spot-checked in playtest before each public upload.
