# Firewatch Architecture

Firewatch is split into a Devvit Web client, a Devvit server, and shared TypeScript contracts.

## Runtime Shape

- `src/client` contains the React 19 web view shown inside reddit.com.
- `src/server` contains Hono route modules executed by the Devvit serverless runtime.
- `src/shared` contains typed API contracts, configuration models, incident helpers, and automation labels shared by client and server.
- `devvit.json` declares the web view entrypoint, server bundle, menu actions, forms, triggers, scripts, and permissions.

The client calls `/api/*` routes. Devvit menu actions, forms, and triggers call `/internal/*` routes that are registered in `devvit.json`.

## Devvit Capabilities

Firewatch uses:

- Custom posts through `reddit.submitCustomPost` for the subreddit review board.
- Menu actions for opening Firewatch, configuring settings, creating demo incidents, and sending a post to Firewatch.
- Forms for quick subreddit configuration from Reddit menu actions.
- Triggers for post, comment, report, delete, AutoModerator filter, mod action, and app install events.
- Devvit Redis for incident state, configuration, queue indexes, claim locks, automation rules, rule logs, user strikes, and selected incident state.
- Reddit API methods for moderation actions and post/comment/user context.

Firewatch does not use Devvit scheduler, realtime, payments, media upload, blob storage, or external HTTP permissions.

## Data Flow

1. A Reddit trigger, mod menu action, or demo action produces an incident signal.
2. The server normalizes Reddit thing IDs, usernames, timestamps, and text.
3. `upsertIncidentSignal` merges the signal into the relevant incident and dedupes recent signal types.
4. `calculateIncident` recomputes the Firewatch rating, visible reasons, statistics, safety review, repeated wording, and impact state.
5. Automation matching attaches matched rules and prepares or runs allowed actions.
6. The incident is saved in Redis and appears in the client queue.
7. Moderators claim, action, hand off, resolve, or reset incidents through typed `/api/*` routes.

All client/server payloads flow through types in `src/shared/api.ts`.

## Redis State

Redis keys are scoped by subreddit name. Important state includes:

- Firewatch board post reference.
- Incident registry and queue index.
- Individual incident records.
- Claim records.
- Community configuration.
- Automation rule definitions.
- Automation execution logs.
- User strike summaries and strike key registry.
- Per-moderator selected incident.

Incident records, claims, automation logs, and strike records have app-managed expiry windows. Community configuration and the board post reference remain until changed, reset by app logic, or removed by platform storage behavior.

## Permissions

`src/server/routes/auth.ts` maps workflows to Reddit moderator permissions. The UI also hides unavailable actions, but the server is the source of truth.

- Review queue and post/comment actions require post moderation access.
- Settings, automation management, demo reset, and full app reset require config access.
- User actions require access permissions.
- Flair actions require both post and flair permissions.

Moderators without enough access receive an access-denied payload instead of private moderation data.

## Automations

Automations are stored as community configuration in Redis. They can:

- Suggest actions only.
- Prepare actions for moderator approval.
- Auto-run Firewatch-internal actions.
- Auto-run all selected actions only when explicitly configured.

Reddit-native actions remain permission checked on the server. Automation matches record why they matched, which actions were prepared, which actions ran, and which actions were skipped.

## Delete Handling

Post delete triggers remove stored incident data for that post. Comment delete triggers remove stored signal and review content for that comment and sanitize action details that referenced it.

## Testing Strategy

The current tests are Node tests that inspect shared helpers, scoring behavior, permissions, and release-critical source patterns. Run:

```bash
npm run type-check
npm run lint
npm run test
```

Playtests run against a real subreddit. Changes that affect Devvit route
behavior should also be playtested in a small subreddit with:

```bash
DEVVIT_SUBREDDIT=<test-subreddit-name> npm run dev
```
