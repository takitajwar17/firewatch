# Firewatch Demo Script

Target length: 90 to 120 seconds.

## Shot List

1. Open Firewatch in `r/firewatch17_dev`.
2. If the queue is empty, click **Suspicious giveaway thread**.
3. Show the new incident in **Posts to review** with its review score and state.
4. Open the incident and show the top post state: author, title, post score,
   comments, review score, flair/lock/removal badges if present.
5. In **Mod actions**, show the primary loop: Open on Reddit, Review comments,
   Claim, Save handoff note, Mark resolved.
6. Show **Post tools** briefly, then skip the secondary controls.
7. Show **Prepared automation** and say actions wait for moderator approval.
8. Show **Signals** so the score is visibly explainable.
9. Open **Comments**.
10. Approve one acceptable comment.
11. Remove one rule-breaking comment with a removal reason.
12. Use **Remove and ban** only if the demo needs the strongest cleanup path.
13. Return to **Post review** and show **Latest action**.
14. Add a sticky comment or lock the post if the thread still looks risky.
15. Open **Handoff**, save the generated handoff note, and show the summary.
16. Once no comments remain open, click **Mark resolved**.
17. Open **Activity** and show Reddit activity, review progress, and mod log.
18. Open **Settings** only at the end to show watched words/domains and demo
    reset.

## Voiceover

```text
Firewatch is a hot-thread queue for Reddit moderators.

The normal mod queue tells you something was reported. Firewatch shows why a
post is heating up, which comments still need a decision, who is handling it,
and what has already been done.

Here I create a clean demo drill. The app creates a real source post and feeds
the same signal pipeline used in production: reports, comments, watched words,
watched domains, repeated user wording, reply clusters, and mod sends.

Every score is explainable. Firewatch does not make hidden AI decisions and it
does not automatically punish users.

The review progress panel shows what the mod team has already resolved.

In comments, mods can approve what is acceptable, remove rule-breaking comments
with a removal reason, or ban a user after Firewatch removes that user’s queued
comments first.

One mod can claim the post, add a sticky reminder, lock the post if needed,
save a handoff note, and mark the incident resolved when the review queue is
clear.

The result is less scattered mod work and a cleaner closeout record for the
team.
```

## Screenshot Checklist

- Queue with at least one incident selected.
- Post review showing review score, state badges, actions, and signals.
- Post review showing latest action and prepared automation.
- Comments tab showing Approve, Remove, and Ban user.
- Activity tab showing Reddit activity, review progress, and mod log.
- Handoff tab showing handoff or final note.
- Settings page showing watched words and domains.
- Developer app listing showing Firewatch installed in the test subreddit.
