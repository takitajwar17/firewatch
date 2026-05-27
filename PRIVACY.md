# Firewatch Privacy Policy

Effective date: May 23, 2026

This Privacy Policy explains how Firewatch handles data when installed in a
Reddit community. Firewatch is a Devvit moderation app that helps moderators
detect escalating posts, review public signals, coordinate response work, run
configurable Automations, take Reddit-native moderation actions, and save
handoff notes.

This policy covers Firewatch's app-specific data practices. Reddit's own
privacy policy and platform terms also apply to Reddit accounts, Reddit content,
Reddit logs, and Reddit-side moderation records.

## Scope

Firewatch processes data only for communities where the app is installed and
only for moderation workflows available to authorized moderators. It does not
monitor communities where it is not installed.

## Data Firewatch May Store

Firewatch may store the following data in Devvit Redis:

- Community data: subreddit name, subreddit identifier, Firewatch queue post
  identifier, and app configuration.
- Configuration: watched words, watched domains, review thresholds, reminder
  text, signal weights, enabled mod action controls, and Automations.
- Incident data: post IDs, comment IDs, post titles, permalinks, report counts,
  timestamps, incident status, score, level, top reasons, trend points, matched
  rules, and impact metrics.
- Public Reddit content needed for review: public post text excerpts, public
  comment excerpts, parent IDs, public usernames, report reasons, AutoModerator
  filter reasons, and mod-action signals connected to an incident.
- Moderator workflow data: moderator username for claims and actions, action
  history, removal reasons entered through Firewatch, handoff notes, final
  summaries, rule execution logs, prepared actions, skipped actions, and user
  strike summaries.
- Demo data: demo source posts, synthetic demo signals, and demo incident state
  created by moderators for testing.
- Per-moderator view state: the last selected incident, used to reopen the
  dashboard in the same context.

## Data Firewatch Does Not Intentionally Collect

Firewatch does not ask for or intentionally collect:

- Reddit passwords or login credentials.
- Private messages.
- Payment information.
- Email addresses.
- Precise location, camera, microphone, contacts, or notification data.
- Off-Reddit browsing history.
- Data from subreddits where Firewatch is not installed.

Public Reddit posts, comments, reports, removal reasons, and moderator notes may
contain personal or sensitive information because users or moderators entered it
on Reddit. Firewatch may temporarily store excerpts of that public or
moderator-provided content when it is part of an incident review.

Firewatch does not use external analytics, advertising trackers, or third-party
data brokers.

## How Firewatch Uses Data

Firewatch uses stored data to:

- Build and display the moderator incident queue.
- Explain why a post or comment needs review.
- Calculate deterministic attention scores and visible reason labels.
- Show flagged comments, repeated wording, involved users, recent activity, and
  moderation impact.
- Remember configuration selected by the moderator team.
- Coordinate ownership and handoff between moderators.
- Run dry tests for Automations.
- Prepare, execute, and log Automation actions.
- Record which comments or users have already been reviewed, approved, removed,
  muted, banned, or otherwise actioned through the app.
- Clean stored incident state when Reddit delete events are received.

## Reddit Moderation Actions

When a moderator uses Firewatch, or when a trusted Response Rule is configured
to run automatically, Firewatch may call Reddit moderation APIs to perform
actions supported by the installed app permissions. These may include approving,
removing, or marking content as spam; locking or unlocking posts and comments;
adding sticky moderator reminders; adding removal notes; ignoring or watching
reports; setting flair; applying crowd control; approving users; muting users;
adding moderator notes; removing recent user content; and banning users.

Those actions may create Reddit-side records such as mod logs, removal notes,
moderator notes, comments, bans, mutes, or post state changes. Reddit controls
those Reddit-side records according to Reddit's policies and platform behavior.

## Storage And Processing

Firewatch runs on Reddit's Developer Platform. App data is processed by Devvit
serverless code and stored in Devvit Redis for the installed community. Stored
incident data is shown through the Firewatch web view to authorized moderators
of that community.

Firewatch does not sell stored data. Firewatch does not share stored incident
data with advertisers, analytics providers, or external services.

## Access Controls

Firewatch is designed as a moderator-only app. Its subreddit and post menu
items are registered for moderators, and the server checks the current user's
subreddit moderator permissions before returning mod-only data or accepting
mod-only actions.

- The review queue is shown only to mods who can manage posts and comments.
  Reddit calls this `posts`, or `all` for full mod access.
- Settings, automations, demo reset, and full app reset are available only to
  mods who can change subreddit settings. Reddit calls this `config`, or `all`.
- Post and comment actions are available only to mods who can manage posts and
  comments.
- User actions such as bans, mutes, approvals, mod notes, Firewatch strikes,
  strike clearing, and user-content cleanup are available only to mods who can
  manage users. Reddit calls this `access`, or `all`. User-content cleanup also
  requires post and comment moderation access.
- Post flair actions are available only to mods who can manage both posts and
  post flair. Reddit calls these `posts` and `flair`, or `all`.
- Mods who cannot change subreddit settings do not receive watched lists, score
  thresholds, automation rules, or automation logs in the webview payload.
- Mods who cannot manage post flair do not receive post flair templates or run
  flair actions.

If someone without enough mod access opens Firewatch, Firewatch returns an
access screen instead of incident, configuration, automation, or action data.

## Security Incidents

If Firewatch discovers unauthorized access, a data breach, or another
compromise affecting stored subreddit moderation data, the app maintainer will
notify Reddit and affected communities with the information needed to assess the
incident and respond.

## Retention

Firewatch uses the following retention periods:

- Incident records expire after 30 days.
- Incident claim records expire after 30 days.
- Automations saved in Redis expire after 30 days unless a moderator saves,
  imports, or disables rules again before expiry.
- Rule execution logs expire after 30 days and are capped to recent entries.
- Firewatch user strike records expire after 30 days unless refreshed by later
  strike activity or updates.
- Per-moderator selected incident state expires after 24 hours.
- Community configuration and the Firewatch queue post reference do not have an
  app-set expiry and remain until a moderator changes them, Firewatch deletes
  them through app logic, or Reddit/Devvit platform storage removes them.

When Reddit sends a post delete trigger, Firewatch deletes the stored incident
and related claim for that post. When Reddit sends a comment delete trigger,
Firewatch removes that comment's stored signal and review content from the
incident and sanitizes action details that referenced the deleted comment.

Removing Firewatch from a subreddit stops new Firewatch collection for that
community and may limit future access to app data through Devvit. Reddit-side
records created through prior moderation actions may remain on Reddit according
to Reddit's policies and moderator tools.

## Moderator Controls

Moderators can reduce or control Firewatch processing by:

- Editing watched words, watched domains, thresholds, signal weights, reminder
  text, and enabled mod action controls in Firewatch settings.
- Disabling Automations or keeping rules in suggest-only or
  prepare-for-approval mode.
- Resetting demo incidents.
- Removing the app from the subreddit to stop new collection.

## Security

Firewatch relies on Reddit's Developer Platform permissions, Devvit serverless
execution, and Devvit Redis storage. The app requests Reddit moderator scope
because Reddit currently requires that scope for moderation apps that perform
native mod actions.

No system is perfectly secure. If you believe Firewatch data or behavior is
incorrect, exposed, or being misused, contact the app maintainer.

## Children And Sensitive Information

Firewatch is for subreddit moderation workflows and is not directed to children
under 13. Firewatch does not ask users to provide sensitive personal
information. Because Reddit users may post sensitive information publicly,
moderators should handle those incidents according to Reddit policies and remove
or report harmful content when appropriate.

## Changes

This policy may be updated as Firewatch changes. The effective date will be
updated when material changes are made.

## Contact

For privacy questions, contact the app maintainer through the Reddit account
listed on the app's developer page. For questions about Reddit account data or
Reddit-side records, use Reddit's privacy and support processes.
