# Firewatch Demo Script

Target length: 90 to 120 seconds.

## Shot List

1. Open the Firewatch queue in `r/firewatch17_dev`.
2. Choose **Scam link cleanup** or **Heated thread**, then click
   **Create demo**.
3. Show the new incident in the sidebar with current attention and status.
4. Open the incident and point at the four proof areas:
   - reports filed
   - comments to review
   - users in review
   - reply clusters
5. Show **Moderator impact**: reports grouped, comments waiting, actions taken,
   and time open.
6. Open **Why this post is here** and show that the score is explainable.
7. Open **Activity** and show the Reddit signals and mod actions timeline.
8. Open **Comments**.
9. Approve one acceptable comment.
10. Remove one rule-breaking comment with the removal reason.
11. Ban one user, showing that Firewatch removes that user’s queued comments
   before recording the ban.
12. Click **Take post**.
13. Click **Sticky reminder**.
14. Click **Lock post** if the incident is still risky.
15. Click **Save handoff note** and show the generated note.
16. Once the review queue is clear, click **Mark handled**.
17. Show the final mod note and mod log.
18. Open **Settings** from the sidebar and show the combined watched words and
    domains.

## Voiceover

```text
Firewatch is incident command for Reddit moderators.

The normal mod queue tells you something was reported. Firewatch tells you why
a post is heating up, who is handling it, what comments still need a decision,
and what has already been done.

Here I create a demo drill. The app creates a real source post and feeds the
same signal pipeline used in production: reports, comments, watched words,
watched domains, repeated user wording, reply clusters, and mod sends.

Every score is explainable. Firewatch does not make hidden AI decisions and it
does not automatically punish users.

The impact snapshot shows what the mod team has already handled.

In comments, mods can approve what is acceptable, remove rule-breaking comments
with a removal note, or ban a user after Firewatch removes that user’s queued
comments first.

One mod can take the post, add a sticky reminder, lock the post if needed, save
a handoff note, and mark the incident handled when the review queue is clear.

The result is less scattered mod work and a cleaner closeout record for the
team.
```

## Screenshot Checklist

- Queue with at least one incident selected.
- Overview showing current attention, peak score, and reasons.
- Overview showing Moderator impact.
- Comments tab showing Approve, Remove, and Ban user.
- Activity tab showing Reddit signals and mod actions.
- Mod notes tab showing handoff or final note.
- Settings page showing watched words and domains.
- Developer app listing showing Firewatch installed in the test subreddit.
