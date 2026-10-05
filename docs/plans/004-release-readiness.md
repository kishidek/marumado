# 004 · Release readiness: tests and visuals

| | |
|---|---|
| **Status** | **Active** · planned 2026-10-05; nothing built yet (next: R1) |
| **Created** | 2026-10-05 |
| **Updated** | 2026-10-05 |
| **Supersedes** | — |
| **Superseded by** | — |
| **Live status** | [qa.md](../qa.md) (cases, scenarios, coverage) · [tracker.md](../tracker.md) |

## 1. Goal

Be able to share a build (zip / unpacked in Chrome and Edge) knowing that **every flow and every look** has been checked, and that any later change that breaks one is caught automatically.

"Ready" means: all suites green, the 24 plant scenarios have reviewed visual baselines, every 🟡 / ⬜ case in [qa.md §2](../qa.md#2-common-and-edge-cases) is ✅ or explicitly accepted as manual, and the release checklist ([qa.md §5](../qa.md#5-release-checklist-sharing-a-build)) passes.

## 2. Starting point (2026-10-05)

| Suite | Count | Gap |
|---|---|---|
| Vitest (engine, × 3 time zones) | 42 tests | Solid; little to add |
| Playwright E2E (real build) | 27 | Several cases asserted in the engine but not on screen |
| Visual regression | **0** | All visuals checked by eye from screenshots |

Coverage today ([qa.md](../qa.md)): ~70 cases → 32 ✅, 16 🟡, 18 ⬜ (+ manual). Scenarios S01–S24 → 3 ✅ without snapshot, 8 🟡 by eye, 13 ⬜.

## 3. Building blocks we already have (grow from these)

| Asset | Where | Reuse for |
|---|---|---|
| Real-extension fixtures (`launch`, `newTab`, `seed`, `storedEvents`) | `tests/e2e/fixtures.ts` | Every new E2E and visual test |
| `seedSixMonths` (260 days of healthy answers) | `tests/e2e/newtab.spec.ts` | Garden scenarios; generalise into `seedScenario()` |
| Day simulator (`healthy` / `neglect` / `mixed`, `shiftBack`) | `src/engine/simulate.ts` | Any health × growth combination |
| Dev hooks `window.__marumado` (`set`, `manual`, `frame`, `cheer`) and `?hour=` | `src/entrypoints/newtab/main.ts` (dev builds only) | Freeze sky hour, plant look, health; drive frames for the flight |
| Garden previews | `lab/garden.html` | Reference images for the garden scenes |
| Capture scripts (frame by frame) | `scripts/render-*.mjs` | Pattern for deterministic screenshots |

## 4. Approach for visual tests

- **Build:** visual tests run on the **dev build** (`.output/chrome-mv3-dev`): it has the hooks and `?hour=`. Functional E2E stays on the production build.
- **Determinism:**
  - Time frozen with Playwright's `page.clock` (fixed date + hour), so the sky, greeting, "Day N" and due questions never drift.
  - Data seeded per scenario through a single helper, `seedScenario({ health, growthCareDays, garden, habits, … })`, built on the simulator (no hand-written events).
  - Animations off for snapshots: reduce motion on, answer feedback idle, the help video paused at a fixed frame; the flight scene (S08) captured mid-flight with `__marumado.manual(true)` + `frame(dt)`.
  - Software GL (SwiftShader) as today: same renderer on every run.
- **Assertion:** `expect(page).toHaveScreenshot('S07-almost-ready.png', { maxDiffPixelRatio: 0.01 })` (threshold tuned in R1).
- **Baselines:** stored next to the spec (`tests/e2e/visual.spec.ts-snapshots/`), committed, ~1280×800 PNG. First run generates them; they are reviewed by eye (a contact sheet in `.output/TEMP - visual-baselines/`) and approved by the user before being committed.
- **Updating:** a deliberate visual change re-runs with `--update-snapshots`; the PR / commit says which scenes changed and why.

## 5. Phases

| # | Phase | Tasks | Done when |
|---|---|---|---|
| R0 | Plan | This document; qa.md | ✅ 2026-10-05 |
| R1 | **Visual harness** | `tests/e2e/visual.spec.ts`; `seedScenario()` helper (generalises `seed` + `seedSixMonths`); frozen clock; dev-build fixture; screenshot options and threshold; contact-sheet script into `.output/TEMP - visual-baselines/` | 3 pilot scenes (S02, S05, S13) stable over 3 consecutive runs (no diffs) |
| R2 | **24 scenario baselines** | One test per S01–S24 (table in §6); review sheet; fix anything that looks wrong (logged in bugs.md) | User approves the sheet; baselines committed; qa.md §3 all ✅ |
| R3 | **On-screen assertions for engine-only cases** | Off-hours / weekend; vacation greeting; daily cap; overnight shift; "Almost ready"; anti-farming toast; Later toast + snooze | Each listed case ✅ in qa.md §2 |
| R4 | **Garden edge cases** | Escape can't dismiss the new-seed dialog; light mode ≤ 3 garden plants; Start over erases the garden; restoring a pre-move backup; 9th plant takes slot 0 on screen | All ✅ |
| R5 | **Onboarding and Settings limits** | Start = end and no workdays in onboarding; max 5 / min 1 habit; Enter renames; onboarding colour reaches the state; closing mid-onboarding saves nothing; "Download backup & erase" downloads then erases; restore v1 and newer-schema files from the UI | All ✅ |
| R6 | **Time and platform** | Midnight rollover with the tab open (`page.clock.fastForward`); time-zone change (`timezoneId`) keeps history; session restore (background tabs don't create WebGL until shown) | All ✅ (or documented as manual) |
| R7 | **Accessibility, names, performance** | Keyboard-only flow (tab order, focus trapped in dialogs, Escape); long and kanji names (ellipsis, backup filename); day / night contrast check; garden builds disposed after many renders; frame time with 8 garden plants under a budget | All ✅; budgets recorded in qa.md |
| R8 | **Release run** | qa.md §5 checklist: suites, baselines, `npm run zip`, install in Chrome and Edge, manual hidden-tab check, real-GPU first frame | Checklist ticked; version tagged (e.g. `v0.2.0`) |

## 6. Scenario specs (for R2)

Each scene is defined by data + clock + viewport + UI state. Growth uses care days (7 workdays a week in tests): potted look = care days × 7/5 × 365/180.

| # | Data (health · care days · garden) | Clock | Viewport / mode | UI state to capture |
|---|---|---|---|---|
| S01 | none (first run) | 11:00 | 1440×860 | Onboarding step 2: name + colour |
| S02 | healthy · 0 · — | 11:00 | 1440×860 | Card + pill |
| S03 | healthy · 10 · — | 07:00 | 1440×860 | Card (dawn sky) |
| S04 | thirsty · 30 · — | 18:00 | 1440×860 | Card + pill expanded |
| S05 | wilted · 64 · — | 22:00 | 1440×860 | All caught up (night) |
| S06 | one habit low · 64 · — | 11:00 | 1440×860 | Pill collapsed with a low dot |
| S07 | healthy · 122 · — | 11:00 | 1440×860 | Pill "Almost ready for the garden" |
| S08 | healthy · 130 · — → 1 | 11:00 | 1440×860 | Mid-flight (manual frames) |
| S09 | healthy · 130 · 1, pending seed | 11:00 | 1440×860 | New-seed dialog |
| S10 | healthy · gen 2 day 1 · 1 | 03:00 | 1440×860 | Card at night |
| S11 | thirsty · gen 3, 30 · 2 | 11:00 | 1440×860 | Garden dull (soft health) |
| S12 | healthy · gen 5, 64 · 4 | 18:00 | 1440×860 | Card |
| S13 | healthy · gen 9, 110 · 8 | 11:00 | 1440×860 | Settings: "Your garden · 8" |
| S14 | healthy · gen 10, 10 · 9 | 11:00 | 1440×860 | Card (9th plant on slot 0) |
| S15 | dormant (no answers 14 days) · 64 · 2 | 11:00 | 1440×860 | Card |
| S16 | healthy · 64 · 2 | 22:00, off-hours | 1440×860 | No card, "resting" |
| S17 | healthy · 64 · 2 | 11:00, vacation | 1440×860 | Vacation greeting, no card |
| S18 | healthy · 64 · 8 | 11:00, light mode | 1440×860 | ≤ 3 garden plants |
| S19 | healthy · 64 · 2 | 11:00, no WebGL | 1440×860 | CSS window |
| S20 | healthy · 64 · 2 | 11:00 | 720×450 (200 %) | Card + pill |
| S21 | healthy · 30 · 1 | 11:00 | 480×820 | Card + pill |
| S22 | healthy · 64 · 2 | 11:00 | 1440×860 | Help modal (video paused) |
| S23 | healthy · 130 · — → 1 | 11:00, reduce motion | 1440×860 | New-seed dialog straight away |
| S24 | wilted · gen 2, 110 · 1 | 18:00 | 1440×860 | Wilted pot + garden side by side |

## 7. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | Commit the baseline images to the public repo? (~24 PNGs, a few MB) | **Yes**: without them the visual tests can't run anywhere else |
| 2 | Pixel-diff threshold | Start at 1 % of pixels; tune in R1 so 3 runs in a row pass |
| 3 | Version to tag when R8 passes | `v0.2.0` (MVP + garden) |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Flaky screenshots (timing, fonts, GL) | Frozen clock, animations off, fixed viewport, SwiftShader; R1 requires 3 stable runs |
| Suite gets slow (24 scenes × ~10 s + 27 E2E) | Visual tests in their own spec / project, run before releases and on visual changes |
| Baselines approved with a hidden flaw | User reviews the full sheet in R2; anything odd goes to bugs.md before committing |
| Engine changes shift many images at once (e.g. growth tuning) | Expected: re-baseline deliberately with `--update-snapshots`, note it in the commit |
