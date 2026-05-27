# Firewatch

Firewatch is a Devvit Web moderation app that gives Reddit moderator teams a shared incident queue for posts that need coordinated review. It is designed for high-volume, support, marketplace, gaming, advice, technology, and other communities where reports, watched words, watched domains, AutoModerator filters, repeated wording, or fast comment growth can turn one thread into a team workflow.

## Key Features

- Creates a moderator-only Firewatch review post for each installed subreddit.
- Queues posts from moderator menu actions, reports, post and comment triggers, AutoModerator filters, watched words, watched domains, repeated wording, and mod actions.
- Calculates a deterministic 0-5 Firewatch rating with visible reasons.
- Lets one moderator claim an incident so the team can see who is handling it.
- Shows flagged comments, repeated phrases, involved users, post state, mod log context, and review history in one web view.
- Supports Reddit-native moderation actions such as approve, remove, spam, lock, unlock, flair, NSFW, spoiler, ignore reports, mod notes, mutes, user approvals, bans, and recent content cleanup.
- Includes configurable Automations that can suggest actions, prepare actions for approval, or run explicitly enabled safe workflows.
- Stores incident, configuration, claim, action, automation, and strike data in Devvit Redis.
- Cleans stored post and comment content when Reddit delete triggers arrive.
- Provides demo incident creation for moderator training and sandbox testing by seeding sample reports
  and comments into Firewatch's review pipeline.

## Tech Stack

- Devvit Web `0.13.0`
- Devvit CLI `0.13.0`
- Node.js `>=22.2.0`
- TypeScript `6.0`
- React `19`
- Vite `8`
- Tailwind CSS `4`
- Hono REST routes for the Devvit server
- Devvit APIs: custom posts, menu actions, forms, triggers, Reddit API, Redis, and client navigation

This project uses `devvit.json`; there is no `devvit.yaml`. Devvit's current configuration docs describe `devvit.json` as the app configuration file for entrypoints, permissions, triggers, menus, forms, and build scripts. See the official [Devvit documentation](https://developers.reddit.com/docs) and [Devvit Web configuration guide](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration).

## Prerequisites

- Node.js `22.2.0` or newer.
- npm.
- A Reddit account with access to [Reddit for Developers](https://developers.reddit.com/).
- Moderator permissions on a small test subreddit for playtesting.
- For production installation, moderator permissions on the target subreddit.

The Devvit CLI is installed as this project's local `devvit` dev dependency. You can run it through npm scripts or `npx devvit`. A global CLI install is optional, but the local CLI keeps the project pinned to the same Devvit version for every contributor.

## Installation

1. Clone the repository.

   ```bash
   git clone <repository-url>
   cd Firewatch
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Authenticate the Devvit CLI.

   ```bash
   npm run login
   ```

   This opens Reddit authentication in your browser. You can also run `npx devvit login --copy-paste` if your environment cannot open a browser.

4. Confirm the local CLI works.

   ```bash
   npx devvit version
   ```

## Playtest

Devvit playtests install the app into a real test subreddit and stream logs while rebuilding on changes. Use a small subreddit you moderate.

```bash
DEVVIT_SUBREDDIT=<test-subreddit-name> npm run dev
```

You can also pass the subreddit directly:

```bash
npx devvit playtest <test-subreddit-name>
```

If your network has intermittent Reddit edge timeouts, this repository includes an optional retry patch for Devvit upload/playtest traffic:

```bash
DEVVIT_SUBREDDIT=<test-subreddit-name> npm run dev:edge
```

After playtest starts, open the subreddit on reddit.com and use the subreddit menu item named **Open Firewatch**. Use **Firewatch settings** to configure watched words, domains, thresholds, and available actions.

## Deploy

1. Run local checks.

   ```bash
   npm run type-check
   npm run lint
   npm run test
   npm run build
   ```

2. Upload a private app version.

   ```bash
   npm run deploy
   ```

   If needed, use the edge retry variant:

   ```bash
   npm run deploy:edge
   ```

3. Install the uploaded app into a subreddit you moderate.

   ```bash
   npx devvit install <subreddit-name>
   ```

4. To publish publicly after Reddit review, use the Devvit publish workflow:

   ```bash
   npm run launch:public
   ```

See the official [Devvit CLI docs](https://developers.reddit.com/docs/guides/tools/devvit_cli), [playtest docs](https://developers.reddit.com/docs/get-started/playtest), and [`devvit install` reference](https://developers.reddit.com/docs/cli/install) for command details.

## Subreddit Configuration

Firewatch is moderator-only. The app requests Devvit Reddit moderator scope and Redis because it reads subreddit moderation context, writes queue state, and performs moderator-approved Reddit actions.

Recommended moderator permissions:

- `posts` or `all` to open the queue and moderate posts/comments.
- `config` or `all` to change Firewatch settings, automations, demo data, and reset app data.
- `access` or `all` to ban, mute, approve users, add mod notes, clear Firewatch strikes, or clean up recent user content.
- `flair` plus `posts`, or `all`, to set or clear post flair.

If a moderator does not have enough access, Firewatch returns an access screen instead of private queue, configuration, automation, or action data.

## Tests

```bash
npm run type-check
npm run lint
npm run test
```

`npm run test` runs the TypeScript build first and then executes the Node test suite in `tests/`.

## Project Structure

- `src/client`: React web view rendered inside Reddit.
- `src/server`: Hono routes and Devvit server code.
- `src/shared`: Typed request/response contracts and shared domain helpers.
- `docs/architecture.md`: High-level architecture and data-flow notes.
- `devvit.json`: Devvit Web manifest, entrypoints, triggers, forms, menu actions, scripts, and permissions.

The client and server communicate through typed contracts in `src/shared/api.ts`.

## Known Limitations

- Firewatch is a deterministic moderation workflow tool, not a machine-learning abuse classifier.
- Firewatch is a deterministic signal queue, not a complete abuse detector.
- Devvit apps run on Reddit's platform and are subject to Devvit API availability, Reddit API limits, permissions, and platform behavior.
- Playtesting happens in a real subreddit. Use a small private or restricted test subreddit before installing into an active community.
- Firewatch cannot access Reddit private messages, private profile data, off-Reddit browsing history, or communities where it is not installed.
- Reddit-native automated actions should be enabled only after moderators have tested the rule in a sandbox subreddit.
- File downloads are not used in this app because Devvit web views run inside reddit.com.
- Incident records expire after the configured retention window. Configuration, automations, user strike
  summaries, and rule logs persist until a moderator changes or resets them.

## Security

Do not commit Reddit credentials, Devvit tokens, OAuth secrets, `.env` files, local page captures, or subreddit-specific private notes. Devvit handles Reddit API authentication for this app when the Reddit permission is enabled; this repository does not need Reddit OAuth client IDs or client secrets.

Report vulnerabilities privately using the process in [.github/SECURITY.md](.github/SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch naming, commit conventions, pull request expectations, and Devvit-specific testing notes.

## License

Firewatch is released under the [MIT License](LICENSE).
