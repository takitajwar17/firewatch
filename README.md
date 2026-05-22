# Firewatch

Incident command for Reddit moderators, built for the Reddit Mod Tools and
Migrated Apps Hackathon.

Firewatch tracks thread-level escalation signals, gives mods a live incident
panel, lets one moderator claim ownership, applies response actions, and
generates an after-action summary.

## Getting Started

Prerequisites:

- Node 22+
- A Reddit account with Developer Platform access
- A small test subreddit you moderate, or let Devvit create one during playtest

## Commands

- `npm run build`: builds client and server bundles.
- `npm run type-check`: runs TypeScript project checks.
- `npm run lint`: runs ESLint.
- `npm run login`: logs the Devvit CLI into Reddit.
- `npm run dev`: starts Devvit playtest on Reddit.
- `npm run deploy`: uploads a private app version.
- `npm run launch`: submits the app for review.

## Human Setup Required

Reddit's current Devvit app wizard requires account login and produces an app
initialization code. To connect this local project to your Reddit app:

1. Go to https://developers.reddit.com/new while logged into your Reddit account.
2. Create an app named `firewatch` using the React or Devvit Web starter.
3. Copy the initialization code shown by Reddit.
4. Run `npx devvit init <code>` in this directory, or share the generated code
   here. Do not use `--force`; this directory is already a Devvit app and the
   init command should only attach it to your Reddit-created app.

After that, run:

```sh
npm run login
npm run dev
```

## MVP Scope

- Subreddit menu: open the Firewatch incident board.
- Subreddit menu: configure keywords, suspicious domains, and thresholds.
- Post menu: manually escalate a thread into Firewatch.
- Triggers: ingest comment creation, comment reports, and post reports.
- Dashboard: score incidents, show reasons, claim ownership, cool down, lock,
  remove flagged comments, resolve, and generate an after-action summary.
