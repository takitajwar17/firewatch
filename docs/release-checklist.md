# Firewatch Release Checklist

## Code

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run dev:edge`
- Open the playtest URL and verify:
  - queue loads
  - each demo drill can be created
  - multiple demo drills can be created and pile up in the queue
  - demo reset deletes Firewatch demo queue items, demo strikes, and Reddit demo posts
  - app reset deletes stored Firewatch data, demo posts, and the Firewatch queue post
  - combined filter settings save and update
  - review progress numbers update after actions
  - comment approve works
  - comment remove works
  - user ban removes queued comments first
  - sticky reminder posts once
  - lock post updates status
  - latest action updates after each mod action
  - handoff note saves
  - resolved is blocked while comments still need review

## Reddit Developer App Listing

- Display name: `Firewatch: Hot Thread Queue`
- Description: `Find threads heating up. Firewatch groups reports, risky comments, and watched domains into one mod queue with clear reasons, mod ownership, Reddit actions, and handoff notes.`
- Privacy policy: `https://raw.githubusercontent.com/takitajwar17/firewatch/main/PRIVACY.md`
- Terms: `https://raw.githubusercontent.com/takitajwar17/firewatch/main/TERMS.md`
- NSFW: off
- Upload latest private version.
- Install in `r/firewatch17_dev`.
- Confirm app permissions match the README.

## Devpost

- App listing URL: `https://developers.reddit.com/apps/firewatch17`
- Reddit username: `u/Sorry-Highway9666`
- Category: Best New Mod Tool
- Tool Overview: use `docs/hackathon-submission.md`
- Project Impact: use `docs/hackathon-submission.md`
- Demo video: use `docs/demo-script.md`
- Screenshots:
  - Overview
  - Review progress
  - Comments
  - Activity
  - Handoff
  - Settings page
  - App listing/install page

## Final Sanity Checks

- No claim that Firewatch uses AI or automatic enforcement.
- No claim that communities have adopted it unless they actually have.
- No hidden demo-only behavior in the core workflow.
- Demo comments are described as sample review signals, not real Reddit comments.
- No app-generated comments included in user repeated wording.
- No `Resolved` status while comments still need review.
