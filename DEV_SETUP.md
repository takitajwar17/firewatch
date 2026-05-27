# Firewatch Development Setup

## Commands

- `npm run build`: builds client and server bundles.
- `npm run type-check`: runs TypeScript project checks.
- `npm run lint`: runs ESLint.
- `npm run login`: logs the Devvit CLI into Reddit.
- `npm run dev:edge`: starts Devvit playtest with the Reddit/Fastly retry patch.
- `npm run dev`: starts Devvit playtest without the retry patch.
- `npm run deploy`: uploads a private app version.
- `npm run launch`: submits the app for review.

## Current App

- App slug: `firewatch17`
- Playtest subreddit: set `DEVVIT_SUBREDDIT=<test-subreddit-name>` when running `npm run dev`.
- Playtest URL: Devvit prints the active playtest URL after upload.

## Network Note

Some networks can hit Reddit edge timeouts during Devvit upload or playtest.
Use `npm run dev:edge` if normal playtest or upload commands repeatedly fail
with transient `fetch failed` errors.
