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
- Playtest subreddit: `r/firewatch17_dev`
- Playtest URL: https://www.reddit.com/r/firewatch17_dev/?playtest=firewatch17

## Network Note

On this machine, Reddit's Fastly edge sometimes causes Node `fetch failed`
timeouts during Devvit upload/playtest. Use `npm run dev:edge` when that
happens.
