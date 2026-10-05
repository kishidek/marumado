# 002 · Moving to the garden (庭へ)

| | |
|---|---|
| **Status** | **Active** · G0–G3 done; G4: help clips ✅ (approved), deck videos left |
| **Created** | 2026-10-04 |
| **Updated** | 2026-10-05 |
| **Supersedes** | — (extends [001 · MVP](001-mvp-wxt.md), "post-MVP: garden graduation") |
| **Superseded by** | — |
| **Live status** | [tracker.md](../tracker.md) → Post-MVP |

## 1. Why

Growth slows down as the plant matures and it hits its leaf/flower caps: without a next step the game stops changing, and so does the habit loop. Moving the ajisai to the garden outside the round window turns six months of care into something permanent and visible, and gives the user a fresh seed to grow next to it. That makes the game infinite.

## 2. The idea in one paragraph

The potted ajisai reaches its **full look at 6 months of care**, and then **moves to the garden on its own**: it flies out through the round window and lands in a terraced Japanese garden. It **keeps growing there forever**, more and more slowly. A **new pot** arrives with **a new seed**: the user names it and picks its flower colour; its leaves get a different green and the pot a different glaze, so each generation is recognisable. Over the years the garden fills with the plants you raised, from the centre outward, a living record of your habits that gently reflects how you're doing today.

## 3. Decisions

| Topic | Decision | When |
|---|---|---|
| **When** | **Automatic at 6 months of care** (`plantDays ≥ 180`, ≈ 129 care days). The ceremony plays on the first visible new tab after the threshold (page open or tab shown), never right after an answer | 2026-10-04 |
| **Growth curve** | **Compressed**: the potted plant reaches its full look (the old "1 year" look: most blooms, 4th pot, full-room camera) **at 6 months of care**. Renderer "look days" = plant days × 365 / 180 | 2026-10-05 |
| **In the garden** | Starts at the full potted size and **keeps growing indefinitely** (more stems, bigger clump; asymptotic so it never explodes) | 2026-10-05 |
| **After moving** | **New pot + new seed**: growth restarts from 0, health carries on (same habits). New glaze and a new leaf green | 2026-10-04 |
| **Garden plants' health** | **Soft reaction**: displayed health = 0.65 + 0.35 × current health; they look dull, never wilt | 2026-10-04 |
| **Flower colour** | **The user picks it** for every plant, **including the first** (in onboarding's name step): blue · violet · pink · white. Existing plants keep blue | 2026-10-05 |
| **Leaf greens** | Only greens that can't be mistaken for "thirsty" (yellow-olive) or "wilting" (brown edges): emerald · blue-green · deep forest · jade | 2026-10-05 |
| **Garden layout** | **Terraced Japanese garden** (lawn, two stone-walled terraces, a central tsukiyama hill, side mounds), seen through a **bigger, lower round window** (r 0.49 m, centre 0.52 m; was 0.42 / 0.50). Plants stand on raised ground so the potted plant never hides them | 2026-10-05 |
| **Order** | **Centre-out**: 1 = top of the hill (centre), then left / right alternating, outward and up: middle terrace L/R, mounds L/R, hill shoulders L/R, front lawn | 2026-10-05 |
| **Garden size** | 8 visible; with more, the newest takes the slot of the oldest (`slot = generation % 8`). All stay in the data and the backup | 2026-10-04 |
| **Name** | Asked again for each new seed (with suggestions) | 2026-10-04 |
| **Start over** | Erases everything, garden included | 2026-10-04 |

### Generation styles

| Trait | Options |
|---|---|
| Flowers (user) | blue · violet · pink · white |
| Leaves (automatic, by generation) | emerald (gen 1) · blue-green · deep forest · jade |
| Pot (automatic, by generation) | indigo namako (gen 1) · celadon · black tenmoku · white shino · terracotta |

## 4. Design

### 4.1 Scene (validated in the lab: `npm run lab` → `/lab/garden.html?scene=stage&stage=1`)

- The room keeps its layout; the round window grows to r 0.49 m and sits at 0.52 m **from day one**, so the garden is visible (empty, with lantern and path) before the first move.
- Garden ground 0.5 m below the counter; terrain = lawn → terrace 1 (+0.2 m) → terrace 2 (+0.2 m) → tsukiyama (+0.34 m) with side mounds. Waving terrace edges with nozura-zumi stone walls (one instanced mesh); stepping stones up the middle; Kasuga lantern on the left; clipped hedge at the back.
- Garden plants: no pot (a soil/moss mound), **low detail** (36 florets per head instead of 80), rebuilt only when their look moves ≥ 5 days or their displayed health moves a full step (0.2). Light mode shows at most 3.

### 4.2 Data

A new storage item, separate from Settings (it's game state, not a preference):

```ts
interface PlantStyle { flowers: 'blue' | 'violet' | 'pink' | 'white'; leaves: number; pot: number }

interface GardenState {
  current: { style: PlantStyle; plantedAt: number; startCareDays: number };
  moved: { id: string; name: string; style: PlantStyle; plantedAt: number; movedAt: number;
           startCareDays: number; movedCareDays: number }[];   // oldest first
  pendingSeed: boolean;  // the new seed hasn't been named yet
}
```

- Missing item = first generation (blue, started at planting, 0 care days): existing plants need no migration.
- Potted growth: `plantDays = (careDays − current.startCareDays) × 7/5`. Garden growth: `look = 365 + (careDays − movedCareDays) × 7/5 × 365/180`.
- **No checkpoint needed for a move**: care days are cumulative and nothing is reinterpreted; health simply continues.
- "Day N" counts from `current.plantedAt`; the pill adds "N in the garden".
- Backups: `schemaVersion: 2` adds `garden`; v1 backups restore with the default (first generation).

### 4.3 Experience

1. **Almost ready**: from 170 plant days the pill says "Almost ready for the garden".
2. **Ceremony** (≈ 2.5 s): the plant (without its pot) lifts out of the pot, flies through the round window and lands on its slot; the camera eases back to the close-up; a new pot with the sprout appears. Reduce motion / light mode: instant.
3. **New seed dialog**: "Hana moved to the garden. Plant a new seed": name (suggestions) + flower colour. It comes back on the next tab if closed; it closes itself in other tabs once answered.
4. Help modal: one extra tile ("After 6 months · it moves to the garden").

### 4.4 Edge cases

| Case | Behaviour |
|---|---|
| Tab closed before naming the new seed | Plant already in the garden; dialog returns on the next tab. Meanwhile the sprout uses a suggested name and the default colour |
| Several tabs open at the threshold | The move is written once, under the Web Lock, re-checking the stored state; other tabs just update |
| Vacation / off-hours / dormant at the threshold | The move happens anyway on the next visible tab |
| Restoring a backup from before the move | Restores exactly that state (plant back in the pot) |
| Start over | Erases the garden too |
| More than 8 moved plants | Newest replaces the oldest slot on screen; data keeps all |
| Clock set back | Growth is clamped at 0; a move never happens twice (stored state re-checked) |

## 5. Phases

| # | Phase | Status | Done when |
|---|---|---|---|
| G0 | Decisions (§3) | ✅ 2026-10-04/05 | Answered |
| G1 | Lab: garden scene, layout study (5 concepts → terraced, centre-out), generation styles | ✅ 2026-10-05 | Validated by the user from screenshots |
| G2 | Engine + data: `engine/garden.ts` (compression, move, styles, garden growth/health), storage item, backup v2 | ✅ 2026-10-05 | Vitest 46 green in 3 time zones |
| G3 | New tab: bigger window, terraced garden, garden plants, almost-ready, ceremony, new-seed dialog, flower colour in onboarding, help tile | ✅ 2026-10-05 | E2E 26/26 incl. move, two tabs, dialog after closing, backup v2 |
| G4 | Help videos and the deck (+ "to the garden"); docs | 🟡 Help modal now has 4 clips incl. the move and the garden (plan 004 §10). **Deck videos still pending** (captions use the old scale) | Videos regenerated; docs updated |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Frame cost with 8 garden plants | Low detail, rebuilt only on look/health steps; ≤ 3 in light mode |
| Compression makes Hana jump in size on update | Expected and accepted (decision 2026-10-05); she was at day ~1 |
| An automatic move feels abrupt | "Almost ready" notice; ceremony only when a tab opens / is shown |
| Old backups / older builds | v1 restores into v2; older builds already reject newer schemas |

## Known deviations

| Plan | Implemented |
|---|---|
| §3 Layout study kept 5 concepts in code | Only the terraced layout remains (`scene/garden.ts`); the others were removed after the decision, and the lab preview now shows the chosen design only |
| §4.3 "petals drift" on landing | A sparkle on the new pot after landing (reuses the answer animation) |
