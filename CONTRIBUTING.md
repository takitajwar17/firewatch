# Contributing

Thanks for helping improve Firewatch. This project is a Devvit Web app that runs inside reddit.com, so changes should be tested against a real subreddit before they are merged.

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Devvit version.
- Reddit client where the issue appears: web, iOS, or Android.
- Subreddit context, without sharing private moderator data.
- Steps to reproduce.
- Expected and actual behavior.
- Logs or screenshots when they do not expose private information.

Do not report security vulnerabilities in public issues. Use [.github/SECURITY.md](.github/SECURITY.md).

## Requesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Describe the moderation problem, the proposed workflow, alternatives considered, and whether it needs new Reddit permissions, Redis data, triggers, menu actions, forms, or client UI.

## Development Setup

1. Install Node.js `22.2.0` or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Authenticate Devvit:

   ```bash
   npm run login
   ```

4. Run checks:

   ```bash
   npm run type-check
   npm run lint
   npm run test
   ```

5. Start a playtest in a small subreddit you moderate:

   ```bash
   DEVVIT_SUBREDDIT=<test-subreddit-name> npm run dev
   ```

The local `devvit` CLI is pinned in `devDependencies`. Prefer `npm run ...` or `npx devvit ...` so contributors use the same CLI version.

## Branch Naming

Use short, descriptive branches:

- `feat/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`
- `chore/<short-description>`

If you work through Codex or another automation that creates branches, use the repository's configured automation prefix when applicable.

## Commit Messages

Use Conventional Commits:

- `feat: add queued report summary`
- `fix: ignore reports after post report reset`
- `docs: document playtest workflow`
- `chore: update devvit dependencies`
- `test: cover automation rule scope`

Keep commits focused. Do not mix unrelated formatting, dependency, and feature changes unless the PR is explicitly a maintenance sweep.

## Pull Request Process

Before opening a PR:

- Run `npm run type-check`.
- Run `npm run lint`.
- Run `npm run test`.
- Run `npm run build`.
- Playtest against a subreddit you moderate when the change affects Devvit routes, triggers, menu actions, forms, Redis state, Reddit API calls, or the web view.
- Update `README.md`, `CONTRIBUTING.md`, or `docs/architecture.md` when behavior or setup changes.
- Add or update tests when changing scoring, automations, permissions, data retention, typed API contracts, or action behavior.

Reviewers expect a clear description of the moderation workflow affected, screenshots for UI changes, and a note about playtesting.

## Code Style

- Use TypeScript type aliases instead of interfaces.
- Prefer named exports.
- Do not use TypeScript casts.
- Keep client/server contracts in `src/shared/api.ts`.
- Keep Devvit server capabilities in `src/server`.
- Use `navigateTo`, `showToast`, or `showForm` from `@devvit/web/client` for client-side Devvit effects.
- Do not use `@devvit/public-api` or legacy Blocks APIs in this Devvit Web app.
- Avoid commented-out code, personal TODOs, hardcoded test subreddit names, and debug logs.

## Devvit Notes

- Playtests run against a real subreddit and can create real posts, comments, mod logs, and Redis records.
- Use a small private or restricted test subreddit for development.
- Moderator permissions matter. Some workflows require `posts`, `config`, `access`, or `flair` permissions.
- Any new menu endpoint must also be registered in `devvit.json`.
- Any new trigger endpoint must be registered in `devvit.json`.
- Any new shared request or response shape should be typed in `src/shared/api.ts`.
- Do not commit `.env` files, Devvit tokens, Reddit credentials, OAuth secrets, raw Reddit page captures, or subreddit-specific private notes.
