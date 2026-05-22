# Firewatch Winning Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the highest-leverage winner-oriented Firewatch improvements: measurable moderator impact, combined mod filters, and repeatable judge demo drills.

**Architecture:** Keep Firewatch deterministic and Devvit-native. Shared preset definitions live in `src/shared`, server scoring enriches the incident object with computed impact data, and the React UI renders these values without inventing client-only state.

**Tech Stack:** Devvit Web, Hono, React 19, Tailwind CSS 4, TypeScript.

---

### Task 1: Shared Product Model

**Files:**
- Modify: `src/shared/api.ts`
- Create: `src/shared/firewatch-presets.ts`

**Steps:**
1. Add type aliases for demo scenario ids and impact snapshots.
2. Add combined watched words and domains for the default filter config.
3. Add shared demo scenario metadata used by both server and client.
4. Run `npm run type-check` after server/client integration, not before isolated type usage exists.

### Task 2: Server Scoring And Config

**Files:**
- Modify: `src/server/core/firewatch.ts`
- Modify: `src/server/core/firewatch-scoring.ts`
- Modify: `src/server/core/firewatch-constants.ts`
- Modify: `src/server/routes/api.ts`

**Steps:**
1. Compute `incident.impact` from actual reports, review actions, active review comments, user decisions, and time open.
2. Support `/api/demo/incident` with a selected scenario id.
3. Add `/api/demo/reset` to remove demo incidents from the Firewatch queue state.

### Task 3: React UI Surfaces

**Files:**
- Modify: `src/client/firewatch/types.ts`
- Modify: `src/client/firewatch/use-dashboard.ts`
- Modify: `src/client/firewatch/shell.tsx`
- Modify: `src/client/firewatch/board-states.tsx`
- Modify: `src/client/firewatch/incident-detail.tsx`
- Modify: `src/client/firewatch/incident-overview.tsx`
- Modify: `src/client/firewatch/shell.tsx`
- Modify: `src/client/firewatch/incident-activity.tsx`

**Steps:**
1. Let the header and empty state create a selected demo scenario.
2. Add reset demo control when demo incidents exist.
3. Add a Moderator impact card in the incident overview.
4. Keep existing colors and visual language unchanged.

### Task 4: Documentation

**Files:**
- Modify: `FIREWATCH.md`
- Modify: `docs/hackathon-submission.md`
- Modify: `docs/demo-script.md`

**Steps:**
1. Update product capabilities with combined filters, impact snapshot, and demo drills.
2. Strengthen Devpost copy around community impact and reliable UX.
3. Update the demo script so judges see the new surfaces in under two minutes.

### Task 5: Verification

**Commands:**
- `npm run type-check`
- `npm run lint`
- `npm run build`

**Steps:**
1. Run each command fresh.
2. Fix every TypeScript, ESLint, or build issue.
3. Report exact verification status and any remaining warnings.
