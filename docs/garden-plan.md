# Plan: moving to the garden (庭へ)

Status: **decided, ready to build** (G0 done) · 2026-10-04 · part of the post-MVP work in [tracker.md](tracker.md)

## 1. Why

Growth slows down as the plant matures and it hits its leaf/flower caps: without a next step the game stops changing, and so does the habit loop. Moving the ajisai to the garden outside the round window turns six months of care into something permanent and visible, and gives the user a fresh seed to grow next to it. That makes the game infinite.

## 2. The idea in one paragraph

When the potted ajisai reaches **6 months of care**, it **moves to the garden on its own**. A short ceremony carries it out through the window; it is now planted in the garden you see through the marumado, next to the mountains. A **new pot** arrives with **a new seed**: the user names it and picks its flower colour, and its leaves get a different green so each generation is recognisable. The camera is close to the sprout again. Over the years the garden fills with the plants you raised, a living record of your habits, gently reflecting how you're doing today.

## 3. Decisions (2026-10-04)

| Topic | Decision |
|---|---|
| **When** | **Automatic at 6 months of care** (`plantDays ≥ 180`, ≈ 129 care days). The ceremony plays on the first visible new tab after the threshold is reached, never in the middle of answering a question |
| **After moving** | **New pot + new seed**: growth restarts from 0, health carries on (same habits). The new pot has a different glaze, and the new plant's **leaves get a different green**, so generations are easy to tell apart |
| **Garden plants** | **Soft reaction**: they look a little dull and droop slightly when your current health is low, but never wilt (displayed health = 0.65 + 0.35 × current health) |
| **Variety** | **The user picks the flower colour** of each new seed: blue · violet · pink · white. The first plant keeps today's blue-violet |
| **Name** | Asked again for the new seed (with suggestions) |
| **Garden size** | Up to 8 visible plants; older ones stay in the data and the backup |
| **Start over** | Erases everything, garden included (unchanged meaning) |

### Generation styles

Each generation combines three traits; leaves and pot rotate automatically so two neighbours never match, flowers are the user's choice.

| Trait | Options |
|---|---|
| Flowers (user) | blue · violet · pink · white |
| Leaves (automatic, in order) | emerald (gen 1) · yellow-green · blue-green · deep forest · variegated (cream edges) |
| Pot (automatic, in order) | indigo namako (gen 1) · celadon · black tenmoku with rust drips · white shino · unglazed terracotta |

## 4. Design

### 4.1 Scene

- A garden ground outside the wall: moss, a gravel band, stepping stones and a small stone lantern (tōrō), between the window and the near hills (≈ 2–9 m away), lower than the counter.
- **8 fixed slots** at different depths so plants don't hide each other and stay inside the round window from the close-up camera *and* from the full-room camera. Slot positions get validated in the lab (phase G1).
- Garden plants use **lower detail** (fewer florets and leaves, simpler stems) and are rebuilt only when the displayed health moves a full step (5 steps between dull and fresh), so they cost almost nothing per frame. Light mode shows at most 3.
- With more than 8 plants, the garden shows the 8 most recent; older ones stay in the data and the backup.
- Sky / day–night light the garden like the mountains (same palette); at night the lantern glows faintly.

### 4.2 Data (backup schema v2)

```ts
interface PlantStyle {
  flowers: 'blue' | 'violet' | 'pink' | 'white'; // user's choice
  leaves: number;        // index into the leaf palette (automatic)
  pot: number;           // index into the pot styles (automatic)
  seed: number;          // shape variation
}

interface GardenPlant {
  id: string;
  name: string;
  style: PlantStyle;
  plantedAt: number;
  movedAt: number;
  careDays: number;      // growth when it moved (fixes its size)
  slot: number;          // 0–7
}

// Settings gains:
garden: GardenPlant[];
current: { style: PlantStyle; plantedAt: number; careDaysAtStart: number };
```

- The potted plant's growth = `careDays − current.careDaysAtStart`. Health is unchanged (same habits, same engine).
- "Day N" counts from `current.plantedAt`.
- Moving freezes the past with a checkpoint (same mechanism as settings changes), so nothing is recomputed retroactively.
- Backups become `schemaVersion: 2`; v1 backups still restore (no garden). Older builds already refuse newer backups.

### 4.3 Experience

1. **Approaching**: a few care days before the threshold, the plant pill says "Almost ready for the garden" so the move isn't a surprise.
2. **Ceremony** (automatic, ≈ 3 s, on the first visible tab after the threshold): the plant lifts from the pot, passes through the round window and settles in its garden slot; petals drift. Reduce motion / light mode: a simple cross-fade.
3. **New pot, new seed**: a short dialog: "Aoi is in the garden. Plant a new seed": name it (suggestions) and pick its flower colour. A new pot appears with the sprout; the camera goes back to the close-up, with the previous plant visible in the garden behind it.
4. The help modal and onboarding mention the garden in one line each.

### 4.4 Edge cases

| Case | Behaviour |
|---|---|
| The tab is closed before naming the new seed | The plant is already in the garden; the new-seed dialog comes back on the next tab. Until then the pot shows the sprout with default choices (suggested name, blue flowers) |
| Several tabs open when the threshold is reached | The move is written once, under the same Web Lock as every other write; the other tabs just update (garden + new sprout), and only the tab that ran the ceremony shows the dialog |
| Vacation, off-hours or a dormant plant at the threshold | Doesn't matter: the move happens on the next visible tab |
| Restoring a backup from before the move | Restores exactly that state (plant back in the pot, no garden entry) |
| Start over | Erases the garden too |
| Reduce motion / light mode | Cross-fade instead of the flight through the window |

### 4.5 Engine and tests

- Pure functions: `isGardenTime(state)`, `moveToGarden(settings, state, now, choices)`, `nextStyle(garden, flowers)`; growth offset applied in one place.
- Vitest: eligibility thresholds, growth restarts, health continuity, checkpoint exactness across a move, schema v1 → v2 restore.
- E2E: simulate 6 months with the dev time travel, check the automatic move, garden slot, new pot + sprout, the new-seed dialog (also after closing the tab), two tabs at once, and backup round-trip.
- Deck: a 4th video "six months later: to the garden" from `npm run render:deck`.

## 5. Phases

| # | Phase | Done when |
|---|---|---|
| G0 | Decisions (§3) | ✅ Answered 2026-10-04 |
| G1 | Lab: garden scene (ground, lantern, 8 slots, low-detail plants, day/night) **and the generation styles** (4 flower colours, 5 leaf greens, 5 pots) | Screenshots with 1, 3 and 8 plants from both cameras; every style variant side by side; frame cost measured |
| G2 | Engine + data (schema v2, growth offset, move, eligibility) | Vitest green in 3 time zones |
| G3 | New tab: garden rendering, "almost ready" notice, automatic ceremony, new pot, new-seed dialog | E2E: 6 months → automatic move → new pot + sprout → reload keeps everything |
| G4 | Backup v2, help/onboarding copy, deck video, docs (tracker, bug log, plan) | Full suites green; docs updated |

## 6. Decisions

All answered in §3 (G0 done).

## 7. Risks

| Risk | Mitigation |
|---|---|
| Garden hidden by the counter or outside the round window at some camera distances | Validate slots in the lab from both cameras before building the rest (G1) |
| Frame cost with 8 plants | Low-detail garden plants, rebuilt only on a health step; cap in light mode; measure in G1 |
| Growth reset confuses the camera / pot size | Camera and pot already key on growth: the new seed gets the close-up and the small pot back, by design (in its new glaze) |
| An automatic move feels abrupt | "Almost ready" notice beforehand; the ceremony waits for a fresh tab, not mid-answer |
| Old backups / older extension versions | v1 restores into v2; older builds already reject newer schemas |
