# Firewatch

Firewatch is an incident command board for Reddit moderators. It helps mod
teams notice fast-moving thread escalation, understand why a thread is risky,
claim ownership of the response, apply common response playbooks, and generate
an after-action summary.

## What It Does

- Scores active threads using deterministic, explainable signals.
- Tracks comment velocity, report activity, configured keywords, suspicious
  domains, repeated phrases, clustered reply branches, removal clusters, and
  manual moderator escalation.
- Shows a live incident panel with the current risk score, top reasons, flagged
  comments, repeated phrases, involved users, newest signals, response
  suggestion, risk trend, and action history.
- Lets one moderator claim an incident so the rest of the team can see who is
  handling it.
- Provides response playbooks for cooldown, selected-comment cleanup, lockdown,
  escalation handoff, and resolution.
- Generates escalation summaries and after-action reports for mod handoff and
  review.
- Includes a demo incident seeder that creates a real source post and populates
  incident state through the same signal pipeline as production events.

## Moderator Workflow

1. Open the subreddit menu and choose **Open Firewatch board**.
2. Use **Configure Firewatch** to tune heated keywords, suspicious domains, and
   score thresholds for the community.
3. Use **Create Firewatch demo incident** or the dashboard demo button to seed a
   realistic test incident.
4. On any post, choose **Escalate to Firewatch** to create an incident manually.
5. Review the score and reasons, claim the incident, and choose an appropriate
   response.
6. Resolve the incident to create an after-action summary.

## Signals

Firewatch is intentionally deterministic. It does not make hidden AI moderation
decisions or automatically punish users based on a black-box score. Moderators
stay in control and every risk score is explained by visible reasons.

## Privacy And Data

Firewatch stores incident state for installed communities, including post IDs,
comment IDs, public usernames, public comment excerpts, configured keywords,
moderator actions taken through the app, and generated incident summaries. This
data is used only to show moderation workflow state inside the app.

## Hackathon Positioning

Firewatch is built for the Reddit Mod Tools and Migrated Apps Hackathon in the
New Mod Tool category. The goal is to reduce moderator load during fast-moving
threads by compressing detection, context gathering, coordination, response,
and reporting into one Devvit-native workflow.
