# Contributing

Thanks for helping improve Firewatch. Firewatch is a Devvit Web moderation app
that runs inside reddit.com, so changes that touch app behavior should be tested
against a real subreddit before they are merged.

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Devvit version from `npx devvit version`.
- Reddit client where the issue appears: web, iOS, or Android.
- Subreddit context, without sharing private moderator data.
- Steps to reproduce.
- Expected and actual behavior.
- Relevant logs or screenshots, with private moderation data removed.

Do not report security vulnerabilities in public issues. Use the private process
in [.github/SECURITY.md](.github/SECURITY.md).

## Requesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).
Describe the moderation problem, the proposed workflow, alternatives considered,
and whether the change needs new Reddit permissions, Redis data, triggers, menu
actions, forms, or client UI.

## Development Setup

### Requirements

- Node.js `22.2.0` or newer.
- npm.
- A Reddit account with access to [Reddit for Developers](https://developers.reddit.com/).
- Moderator access to a small private or restricted subreddit for playtesting.

### Install

```bash
npm install
```

This repository pins the Devvit CLI in `devDependencies`. Prefer `npm run ...`
or `npx devvit ...` so contributors use the project version instead of a
different global CLI.

### Authenticate Devvit

```bash
npm run login
npx devvit whoami
npx devvit version
```

Use `npx devvit login --copy-paste` if your environment cannot complete the
browser-based login flow.

### Local Checks

Run these before opening a pull request:

```bash
npm run type-check
npm run lint
npm run test
npm run build
```

`npm run test` runs TypeScript project checks first and then executes the Node
test suite in `tests/`.

### Playtest

Playtests install the app into a real subreddit and stream logs while rebuilding
on code changes. Use a small test subreddit you moderate.

```bash
DEVVIT_SUBREDDIT=<test-subreddit-name> npm run dev
```

You can also pass the subreddit directly:

```bash
npx devvit playtest <test-subreddit-name>
```

The `r/` prefix is optional. Do not commit personal or private subreddit names
to `devvit.json`; use `DEVVIT_SUBREDDIT` or a local shell profile instead.

### Deploy

Upload a private version after local checks pass:

```bash
npm run deploy
```

Install the uploaded app into a subreddit you moderate:

```bash
npx devvit install <subreddit-name>
```

Public release is handled through the Devvit publish flow:

```bash
npm run launch:public
```

`devvit publish` uploads the release version and the source-code bundle Devvit
requires for review. Do not run `npm run deploy` immediately before
`npm run launch:public`; that creates an extra private upload and version bump.
If the CLI attempts to install into a default playtest subreddit that already
has the app installed, the duplicate-install warning is non-fatal. Set
`DEVVIT_SUBREDDIT=<test-subreddit-name>` before publish if you want the CLI to
use a specific test subreddit during that step.

## Branch Naming

Use short, descriptive branches:

- `feat/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`
- `chore/<short-description>`
- `test/<short-description>`

If automation creates branches for you, use the repository's configured
automation prefix when applicable.

## Commit Messages

Use Conventional Commits:

- `feat: add queued report summary`
- `fix: ignore reports after post report reset`
- `docs: document playtest workflow`
- `chore: update devvit dependencies`
- `test: cover automation rule scope`

Keep commits focused. Do not mix unrelated formatting, dependency, and feature
changes unless the pull request is explicitly a maintenance sweep.

## Pull Request Process

Before opening a pull request:

- Run `npm run type-check`.
- Run `npm run lint`.
- Run `npm run test`.
- Run `npm run build`.
- Playtest against a subreddit you moderate when the change affects Devvit
  routes, triggers, menu actions, forms, Redis state, Reddit API calls, or the
  web view.
- Update docs when behavior, setup, permissions, data retention, or contributor
  workflow changes.
- Add or update tests when changing scoring, automations, permissions, typed API
  contracts, data retention, Redis keys, or action behavior.

Reviewers expect a clear description of the moderation workflow affected,
screenshots or screen recordings for UI changes, notes about playtesting, and a
link to the related issue when one exists.

## Code Style

- Use TypeScript type aliases instead of interfaces.
- Prefer named exports.
- Do not use TypeScript casts.
- Keep client/server request and response contracts in `src/shared/api.ts`.
- Keep Devvit server capabilities in `src/server`.
- Keep React webview code in `src/client`.
- Use `navigateTo`, `showToast`, or `showForm` from `@devvit/web/client` for
  client-side Devvit effects.
- Do not use `@devvit/public-api` or legacy Blocks APIs in this Devvit Web app.
- Avoid commented-out code, personal TODOs, hardcoded test subreddit names, and
  debug logs.

## Devvit-Specific Notes

- `devvit.json` is the app configuration file for entrypoints, permissions,
  scripts, menu actions, forms, and triggers.
- Any new menu endpoint must also be registered in `devvit.json`.
- Any new form endpoint must also be registered in `devvit.json`.
- Any new trigger endpoint must also be registered in `devvit.json`.
- Trigger endpoints must be server endpoints and should remain under the
  existing `/internal/` route structure.
- Keep requested Devvit permissions minimal. Add a permission only when the code
  path actually needs it.
- Playtests can create real posts, comments, mod logs, and Redis records.
- Moderator permissions matter. Some workflows require `posts`, `config`,
  `access`, or `flair` permissions.
- Do not commit `.env` files, Devvit tokens, Reddit credentials, OAuth secrets,
  raw Reddit page captures, or subreddit-specific private notes.

## Useful Devvit References

- [Devvit documentation](https://developers.reddit.com/docs)
- [Devvit CLI reference](https://developers.reddit.com/docs/guides/tools/devvit_cli)
- [Devvit Web configuration](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration)
- [Devvit playtest command](https://developers.reddit.com/docs/cli/playtest)
- [Devvit install command](https://developers.reddit.com/docs/cli/install)
- [Devvit triggers](https://developers.reddit.com/docs/capabilities/server/triggers)
