# Firewatch Development Setup

This document keeps contributor setup and Devvit playtest details outside the
project README.

## Requirements

- Node.js `22.2.0` or newer.
- npm.
- A Reddit account with access to Reddit for Developers.
- Moderator access to a small private or restricted subreddit for playtesting.

## Install

```bash
npm install
```

## Authenticate Devvit

```bash
npm run login
```

The local Devvit CLI is pinned in this repository. Prefer `npm run ...` or
`npx devvit ...` so all contributors use the same CLI version.

## Commands

- `npm run build`: builds client and server bundles.
- `npm run type-check`: runs TypeScript project checks.
- `npm run lint`: runs ESLint.
- `npm run test`: runs the project test suite.
- `npm run login`: logs the Devvit CLI into Reddit.
- `npm run dev`: starts Devvit playtest without the retry patch.
- `npm run dev:edge`: starts Devvit playtest with the Reddit/Fastly retry patch.
- `npm run deploy`: uploads a private app version.
- `npm run deploy:edge`: uploads with the Reddit/Fastly retry patch.
- `npm run launch`: submits the app for review.

## Current App

- App slug: `firewatch17`
- Playtest subreddit: set `DEVVIT_SUBREDDIT=<test-subreddit-name>` when running
  `npm run dev`.
- Playtest URL: Devvit prints the active playtest URL after upload.

## Playtest

```bash
DEVVIT_SUBREDDIT=<test-subreddit-name> npm run dev
```

Use a small subreddit you moderate. Playtests run on reddit.com and can create
real posts, comments, mod logs, and Redis records.

## Deploy

```bash
npm run type-check
npm run lint
npm run test
npm run build
npm run deploy
npx devvit install <subreddit-name>
```

## Network Note

Some networks can hit Reddit edge timeouts during Devvit upload or playtest.
Use `npm run dev:edge` or `npm run deploy:edge` if normal commands repeatedly
fail with transient `fetch failed` errors.
