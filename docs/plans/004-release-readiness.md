# 004 · Release readiness: tests and visuals

| | |
|---|---|
| **Status** | **Active** · R0–R2 ✅ (24 baselines approved by the user 2026-10-05); next R3 |
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

Coverage today ([qa.md](../qa.md)): 62 cases → 28 ✅, 15 🟡, 19 ⬜. Scenarios S01–S24 → 3 ✅ without snapshot, 9 🟡 by eye, 12 ⬜.

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

Validated against the code and with a probe on the real extension (2026-10-05): `context.clock.setFixedTime()` and `timezoneId` both apply on the extension's new-tab page (it showed "11:00 AM", Asia/Tokyo), and timers keep running.

- **Build:** visual tests run on the **dev build** (`.output/chrome-mv3-dev`, built with `wxt build --mode development`). Functional E2E stays on the production build.
- **Separate suite:** a Playwright **project** (or `testIgnore`) so `npm run test:e2e` doesn't pick up `visual.spec.ts` (it builds only production); new script `npm run test:visual` builds dev, then runs only the visual project.
- **Determinism:**
  - **Clock:** `context.clock.setFixedTime(<fixed date + hour>)`: `Date` is frozen (sky, greeting, "Day N", due questions), timers still run. **No `?hour=`**: the dev override only changes the sky, not the scheduler, so it would contradict the frozen clock.
  - **Time zone:** fixed `timezoneId` per context (e.g. `Asia/Tokyo`), so baselines don't depend on the machine's zone.
  - **Data:** one helper `seedScenario(spec, now)` writes settings, events, checkpoint and garden. **Every timestamp derives from the frozen `now`, never from the test runner's `Date.now()`.** Growth comes from the simulator; garden plants are written directly (`moved[]` with `movedCareDays ≤` the total care days).
  - **Avoid incidental toasts:** `lastExportAt = now` (backup reminder), no open vacation older than 14 days unless that's the scene.
  - **Pill state:** set explicitly (collapsed via class, expanded via hover) instead of waiting for the 6 s timer.
  - **Motion:** reduce motion on for still scenes (health snaps, no answer animation, no flight). It does **not** stop the canvas fade-in (a CSS animation, 0.25 s): wait ≥ 0.4 s, or use `toHaveScreenshot({ animations: 'disabled' })`.
  - **Help video:** it has `preload="none"` and doesn't play with reduce motion, so it would be blank: the test loads it and seeks to a fixed time (e.g. 4.8 s, the wilted frame) before the snapshot.
  - **Flight (S08):** motion on, `__marumado.manual(true)` then `frame(dt)` steps to a fixed point of the flight.
  - **Renderer:** SwiftShader as today.
- **Assertion:** `expect(page).toHaveScreenshot('S07.png')` with project defaults `maxDiffPixels: 50, animations: 'disabled'`. Tuned in R1: rendering is pixel-deterministic (0 px over 2 runs); the planned 1 % ratio missed a moved lantern (bug #29).
- **Viewport:** **1280×800** by default (smaller baselines); S20 720×450 and S21 480×820.
- **Platform:** text uses system fonts besides the bundled Shippori Mincho, so baselines are **per OS**. Playwright already names them per platform (`…-chromium-darwin.png`); we keep macOS baselines only and run visual tests on macOS.
- **Baselines:** stored next to the spec (`tests/e2e/visual.spec.ts-snapshots/`), committed. First run generates them; they're reviewed by eye on a contact sheet in `.output/TEMP - visual-baselines/` and approved by the user before committing.
- **Updating:** deliberate visual changes re-run with `--update-snapshots`; the commit says which scenes changed and why.

## 5. Phases

| # | Phase | Tasks | Done when |
|---|---|---|---|
| R0 | Plan | This document; qa.md | ✅ 2026-10-05 |
| R1 | **Visual harness** | Playwright projects (`functional` / `visual`) + `npm run test:visual`; dev-build fixture with `timezoneId` and frozen clock; `seedScenario()` (generalises `seed` + `seedSixMonths`, timestamps from the frozen `now`); screenshot options; contact-sheet script into `.output/TEMP - visual-baselines/` | ✅ 2026-10-05: pilots stable over 3 runs; all 24 scenes then 0 px drift over 2 runs |
| R2 | **24 scenario baselines** | One test per S01–S24 (table in §6); review sheet; fix anything that looks wrong (logged in bugs.md) | ✅ 2026-10-05: 24 baselines approved; review fixed #28 (lantern), #30 (flight) and redesigned the help modal (§10) |
| R3 | **On-screen assertions for engine-only cases** | Off-hours / weekend; vacation greeting; daily cap; overnight shift; "Almost ready"; anti-farming toast; Later toast + snooze | Each listed case ✅ in qa.md §2 |
| R4 | **Garden edge cases** | Escape can't dismiss the new-seed dialog; light mode ≤ 3 garden plants; Start over erases the garden; restoring a pre-move backup; 9th plant takes slot 0 on screen | All ✅ |
| R5 | **Onboarding and Settings limits** | Start = end and no workdays in onboarding; max 5 / min 1 habit; Enter renames; onboarding colour reaches the state; closing mid-onboarding saves nothing; "Download backup & erase" downloads then erases; restore v1 and newer-schema files from the UI | All ✅ |
| R6 | **Time and platform** | Midnight rollover with the tab open (`clock.install` + `runFor` past midnight, then the 30 s re-render / tab shown); time-zone change (two contexts with different `timezoneId`, same storage) keeps history | All ✅. Session restore stays **manual**: headless reports every tab as visible (same limit as the hidden-tab check) |
| R7 | **Accessibility, names, memory** | Keyboard-only flow (tab order, focus trapped in dialogs, Escape); long and kanji names (ellipsis, backup filename); day / night contrast (computed colours, WCAG AA); garden builds disposed after many renders (dev hook exposes `renderer.info.memory`) | All ✅. Frame-time budgets are **manual on a real GPU** (SwiftShader timings mean nothing) |
| R8 | **Release run** | qa.md §5 checklist: suites, baselines, bump `package.json` version (0.1.0 → 0.2.0; WXT copies it into the manifest), `npm run zip`, install in Chrome and Edge, manual hidden-tab / session-restore / real-GPU checks | Checklist ticked; tag `v0.2.0` |

## 6. Scenario specs (for R2)

Each scene = data + frozen clock + viewport + UI state. Tests use 7 workdays a week, so 1 care day = 1 day of healthy answers; potted look = care days × 7/5 × 365/180 (move at 129 care days, "almost" from 122).

Health words below are what the scene **shows**, produced by an explicit history (a plant with no answers starts at 0.8, not 1):

- **healthy** = the last 7 days all answered Yes
- **thirsty** = healthy history, then the last 2 days "Not yet" on every habit
- **wilted** = healthy history, then 7 days of neglect
- **one low** = healthy, but "Not yet" on water the last 2 days
- **dormant** = healthy history, then 14 days with no answers (health stops dropping after 3)

| # | Health · care days · garden (moved) | Clock (Asia/Tokyo) · settings | Viewport | UI state |
|---|---|---|---|---|
| S01 | none (first run) | 11:00 | 1280×800 | Onboarding step 2: name + colour |
| S02 | no answers yet · 0 · — | 11:00 | 1280×800 | Card + pill (fresh sprout, health 0.8) |
| S03 | healthy · 10 · — | 07:00 | 1280×800 | Card (dawn sky) |
| S04 | thirsty · 30 · — | 18:00 | 1280×800 | Card + pill expanded |
| S05 | wilted · 64 · — | 22:00 | 1280×800 | All caught up (night) |
| S06 | one low · 64 · — | 11:00 | 1280×800 | Pill collapsed with a low dot |
| S07 | healthy · 122 · — | 11:00 | 1280×800 | Pill "Almost ready for the garden" |
| S08 | healthy · 130 · — → 1 | 11:00 · motion on | 1280×800 | Mid-flight (manual frames) |
| S09 | healthy · 130 · 1, pending seed | 11:00 | 1280×800 | New-seed dialog |
| S10 | healthy · gen 2 day 1 · 1 | 03:00 | 1280×800 | Card at night |
| S11 | thirsty · gen 3, 30 · 2 | 11:00 | 1280×800 | Garden dull (soft health) |
| S12 | healthy · gen 5, 64 · 4 | 18:00 | 1280×800 | Card |
| S13 | healthy · gen 9, 110 · 8 | 11:00 | 1280×800 | Settings: "Your garden · 8" |
| S14 | healthy · gen 10, 10 · 9 | 11:00 | 1280×800 | Card (9th plant on slot 0) |
| S15 | dormant · 64 · 2 | 11:00 | 1280×800 | Card |
| S16 | healthy · 64 · 2 | 22:00 · **work hours 09:00–18:00** | 1280×800 | No card, "resting" |
| S17 | healthy · 64 · 2 | 11:00 · vacation on (started today) | 1280×800 | Vacation greeting, no card |
| S18 | healthy · 64 · 8 | 11:00 · light mode | 1280×800 | ≤ 3 garden plants |
| S19 | healthy · 64 · 2 | 11:00 · `--disable-3d-apis` | 1280×800 | CSS window |
| S20 | healthy · 64 · 2 | 11:00 | 720×450 (200 %) | Card + pill |
| S21 | healthy · 30 · 1 | 11:00 | 480×820 | Card + pill |
| S22 | healthy · 64 · 2 | 11:00 | 1280×800 | Help modal (video loaded, seeked to 4.8 s) |
| S23 | healthy · 130 · — → 1 | 11:00 · reduce motion | 1280×800 | New-seed dialog straight away |
| S24 | wilted · gen 2, 110 · 1 | 18:00 | 1280×800 | Wilted pot + garden side by side |

## 7. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | Commit the baseline images to the public repo? (~24 PNGs, a few MB) | **Yes**: without them the visual tests can't run anywhere else |
| 2 | Pixel-diff threshold | ~~1 %~~ → **50 px** (decided in R1, see bug #29) |
| 3 | Version to tag when R8 passes | `v0.2.0` (MVP + garden) |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Flaky screenshots (timing, fonts, GL) | Frozen clock + fixed time zone, animations off, fixed viewport, SwiftShader; R1 requires 3 stable runs |
| Baselines differ by OS (system fonts) | macOS baselines only, run visual tests on macOS |
| Seeds use the runner's clock instead of the frozen one (wrong "Day N", due questions) | `seedScenario` takes `now` from the fixed time, never `Date.now()` in Node |
| Suite gets slow (24 scenes × ~10 s + 27 E2E) | Visual tests in their own spec / project, run before releases and on visual changes |
| Baselines approved with a hidden flaw | User reviews the full sheet in R2; anything odd goes to bugs.md before committing |
| Engine changes shift many images at once (e.g. growth tuning) | Expected: re-baseline deliberately with `--update-snapshots`, note it in the commit |

## 9. Review against the code (2026-10-05)

| Finding | Kind | Change |
|---|---|---|
| `?hour=` only moves the sky; the scheduler still uses real time | Conflict | Freeze `Date` with `clock.setFixedTime`; drop `?hour=` |
| Snapshots would depend on the machine's time zone | Bug in the plan | Fixed `timezoneId` per context |
| Seeds built from Node's `Date.now()` disagree with the frozen page time | Bug in the plan | `seedScenario(spec, now)` |
| A plant with no answers starts at 0.8, not "healthy" | Wrong assumption | Health words defined by an explicit history (§6) |
| S16 "22:00 off-hours" with the test default hours (00:00–23:59) is *working* time | Bug in the plan | S16 sets work hours 09:00–18:00 |
| Help video has `preload="none"` and doesn't play with reduce motion → blank | Bug in the plan | Load and seek to a fixed time before the snapshot |
| Reduce motion doesn't stop the canvas CSS fade-in | Gap | Wait ≥ 0.4 s or `animations: 'disabled'` |
| `test:e2e` would also pick up `visual.spec.ts` (needs the dev build) | Conflict | Separate Playwright projects + `test:visual` |
| 1440×860 in the table vs ~1280×800 in the approach | Inconsistency | 1280×800 everywhere (plus the two small viewports) |
| System fonts make baselines OS-specific | Gap | macOS baselines only (Playwright suffixes the platform) |
| Session restore and hidden-tab release can't run headless | Wrong assumption (R6) | Manual in R8 |
| SwiftShader frame times aren't meaningful | Wrong assumption (R7) | Frame budgets manual on a real GPU; automated check is memory (disposed builds) |
| `package.json` is 0.1.0; manifest version comes from it | Gap (R8) | Bump to 0.2.0 before tagging |
| qa.md counts were rough (~70 / 32 / 16 / 18) | Inconsistency | Recounted: 62 cases → 28 ✅, 15 🟡, 19 ⬜; scenarios 3 / 9 / 12 |

## 10. Help modal redesign (from the S22 review, 2026-10-05)

Decided with the user: four steps with looping clips of the real scene (1A card + cursor taps Yes + drops · 2A sprout → 6 months · 3A wilt → care → recovery · 4B flight to the garden, then the garden filling over years); an intro about why healthy habits matter instead of the plant's status (it read like onboarding); credit "Made by Daniel Kishimoto" → danielkishimoto.com with UTMs (`utm_source=marumado&utm_medium=extension&utm_campaign=help_modal&utm_content=credit`), opens in a new tab.

- Clips: `npm run render:help` (`tests/e2e/clips/help-clips.spec.ts`, Playwright project `clips`), frame-exact from the dev build with `__marumado.frame`, `set`, `cheer`, `garden` and `fly`; VP9 WebM + JPEG stills for reduce motion; review copies (MP4) in `.output/TEMP - help-clips/`. ~1.6 MB with stills.
- The old explainer video and its script were removed.
- Guards: functional E2E "help modal: four steps…" and visual S22 (step 4, stills).

## 11. Stable extension ID (decided 2026-10-05)

Unpacked extensions get an ID derived from their folder path, and their storage follows the ID: unzipping a new release elsewhere would silently lose the plant. The manifest now carries a public `key`, pinning the ID to `libfkdleonljckjnpocjmkoccmafebmb` (E2E guards it). The private key lives outside the repo (author's machine, `*.pem` is gitignored). The Chrome Web Store rejects the `key` field: strip it for a store upload if we publish there later.

Migration for existing installs (the author's): export a backup, update, restore.
