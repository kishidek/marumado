# QA: cases, scenarios and coverage

**Living document.** What we test, what's missing, and the release checklist for sharing a version. Index of all docs: [README.md](README.md). Bugs: [bugs.md](bugs.md).

Status: ✅ automated · 🟡 partial (unit only, or no assertion on the UI, or manual only) · ⬜ missing

## 1. Inventory (2026-10-05)

| Suite | Where | Count | Covers |
|---|---|---|---|
| Vitest (engine) | `tests/engine/*.test.ts`, run in 3 time zones (`npm run test:tz`) | 42 tests (46 with cases) | Model, scheduler, time/DST, settings changes, checkpoints, backup, simulator, garden |
| Playwright E2E | `tests/e2e/newtab.spec.ts` on the real unpacked build (`npm run test:e2e`) | 27 | Onboarding, answering, multi-tab, settings, backup, WebGL loss/fallback, layout, garden |
| Visual regression | `tests/e2e/visual/` on the dev build (`npm run test:visual`) | **24 scenes** (S01–S24) | Frozen Tokyo clock, 50 px tolerance; review with `npm run visual:sheet` |

## 2. Common and edge cases

62 cases: 28 ✅ · 15 🟡 · 19 ⬜ (2026-10-05).

### Install and first run
| Case | Status | Test / note |
|---|---|---|
| First tab shows mandatory onboarding; no console / CSP errors | ✅ | E2E first run |
| Empty name blocks Continue | ✅ | E2E first run |
| Onboarding: start = end, no workdays rejected | 🟡 | Same picker as Settings (#20 covers workdays only) |
| Onboarding: max 5 / min 1 habit | ⬜ | |
| Flower colour picked in onboarding reaches the plant / garden state | ⬜ | |
| Tab closed mid-onboarding → starts over next tab, nothing saved | ⬜ | |
| Another tab plants while this one is onboarding (bug #4) | 🟡 | Exercised indirectly by seeding; no dedicated test |

### Daily loop
| Case | Status | Test / note |
|---|---|---|
| Question order, intervals, first tab of the day | ✅ | Vitest scheduler |
| Yes / Not yet / Later from the card | ✅ | E2E (Yes, Not yet); Later 🟡 Vitest only |
| Answer from the plant pill (forced habit) | ✅ | E2E #21–22 |
| "All caught up" then the card disappears | ✅ | E2E |
| Anti-farming toast "already counted" | 🟡 | Vitest; UI toast not asserted |
| Off-hours / weekend: no card, "resting" greeting and statuses | 🟡 | Vitest; UI not asserted |
| Daily prompt cap reached | 🟡 | Vitest; UI not asserted |
| Overnight shift (22:00–06:00) | 🟡 | Vitest; UI not asserted |
| Daily-only habit asked once a day | ✅ | Vitest + E2E interval options |
| Answer animation (water drops vs glints) and health easing | ⬜ | Visual |

### Time
| Case | Status | Test / note |
|---|---|---|
| DST changes (Madrid, Santiago, Tokyo) | ✅ | Vitest × 3 TZ |
| Clock set backwards | ✅ | Vitest #19 |
| Tab left open across midnight (day rolls over) | ⬜ | Needs Playwright clock |
| Time-zone change (travel) | ⬜ | |
| Sky / UI theme at 7 h, 11 h, 18 h, 22 h, 3 h | 🟡 | Screenshots by eye only |

### Settings
| Case | Status | Test / note |
|---|---|---|
| Rename (button) and propagation to other tabs | ✅ | E2E |
| Rename with Enter | ⬜ | |
| Add / remove habit; drawer in sync | ✅ | E2E #18 |
| Remove disabled at 1 habit; add disabled at 5 | ⬜ | |
| Interval change rewords the question | ✅ | E2E #21 |
| Workdays: rejected change snaps back | ✅ | E2E #20 |
| Hours: start = end rejected; overnight hint | ⬜ | |
| Settings changes don't rewrite the past | ✅ | Vitest #14–16 + E2E #14 |
| Vacation on / off; reminder after 14 days | ✅ | E2E |
| Reduce motion: no answer animation, no flight | 🟡 | Flight skip used in garden E2E; animation not asserted |
| Light mode | ✅ | E2E |
| Export / restore / corrupt file | ✅ | E2E |
| Restore a v1 backup / a newer-schema backup in the UI | 🟡 | Vitest only |
| Start over: Cancel / Erase / Download & erase | 🟡 | Cancel and Erase ✅; "Download & erase" ⬜ |
| Diagnostics log | ✅ | E2E |

### Tabs, lifecycle, platform
| Case | Status | Test / note |
|---|---|---|
| Two tabs answer at once | ✅ | E2E |
| > 16 tabs: lost context → CSS window → recovers | ✅ | E2E |
| Hidden tab releases WebGL after 5 s | 🟡 | Manual only (headless reports all tabs visible) |
| No WebGL | ✅ | E2E |
| Extension update with tabs open | ✅ | E2E |
| Session restore (tabs opened in background) | ⬜ | Manual (headless reports all tabs visible) |
| Installed in Edge and Chrome from the zip | 🟡 | Manual (Edge done) |

### Garden
| Case | Status | Test / note |
|---|---|---|
| Automatic move at 6 months; new seed named; no second move | ✅ | E2E |
| Two tabs at the threshold; dialog returns after closing | ✅ | E2E |
| Backup v2 carries the garden | ✅ | E2E |
| Settings lists the garden; pending-seed texts | ✅ | E2E |
| "Almost ready for the garden" in the pill | 🟡 | Vitest; UI not asserted |
| New-seed dialog can't be dismissed with Escape | ⬜ | |
| 9th plant replaces the oldest slot on screen | 🟡 | Vitest only |
| Light mode shows ≤ 3 garden plants | ⬜ | |
| Start over erases the garden | ⬜ | |
| Restoring a pre-move backup puts the plant back in the pot | ⬜ | |
| Garden builds disposed (no memory growth over many renders) | ⬜ | |

### Layout and accessibility
| Case | Status | Test / note |
|---|---|---|
| 200 % zoom / narrow window: no overlap | ✅ | E2E (2 sizes) |
| Touch opens the pill | ✅ | E2E |
| Keyboard only: tab order, dialogs trap focus, Escape | ⬜ | |
| Long / kanji names (ellipsis, backup filename) | ⬜ | |
| Contrast of day and night themes | ⬜ | |

### Performance
| Case | Status | Test / note |
|---|---|---|
| First 3D frame | 🟡 | Measured (77–120 ms on M1); no budget assertion |
| Frame cost with 8 garden plants | ⬜ | Manual on a real GPU; automated: builds disposed (memory) |

## 3. Plant scenarios (visual matrix)

Dimensions: **habits / health** (healthy 1 · thirsty 0.5 · wilted 0.1 · one habit low · dormant), **growth** (day 0 · 2 w · 6 w · 3 mo · ~5.5 mo "almost" · moving day · pending seed), **garden** (0 · 1 · 2 · 4 · 8 · 9+ plants, mixed colours, mixed ages), **time** (7 · 11 · 18 · 22 · 3 h), **modes** (off-hours · vacation · reduce motion · light · no WebGL), **viewport** (1440×860 · 720×450 · 480×820), **UI state** (onboarding · card · caught up · settings · help · new-seed dialog).

The full product is thousands of combinations; this list covers every value of every dimension at least once and the risky pairs (pairwise).

| # | Habits / health | Growth | Garden | Time | Mode / viewport | UI state | Status |
|---|---|---|---|---|---|---|---|
| S01 | — | — | — | 11 h | 1440 | Onboarding: name + colour | ✅ baseline (review pending) |
| S02 | Healthy | Day 0 | 0 | 11 h | 1440 | Card | ✅ baseline (review pending) |
| S03 | Healthy | 2 w | 0 | 7 h | 1440 | Card | ✅ baseline (review pending) |
| S04 | Thirsty | 6 w | 0 | 18 h | 1440 | Card + pill expanded | ✅ baseline (review pending) |
| S05 | Wilted | 3 mo | 0 | 22 h | 1440 | Caught up | ✅ baseline (review pending) |
| S06 | One habit low | 3 mo | 0 | 11 h | 1440 | Pill collapsed (low dot) | ✅ baseline (review pending) |
| S07 | Healthy | ~5.5 mo ("almost") | 0 | 11 h | 1440 | Pill "Almost ready" | ✅ baseline (review pending) |
| S08 | Healthy | Moving day (flight) | 0 → 1 | 11 h | 1440 | Ceremony mid-flight | ✅ baseline (review pending) |
| S09 | Healthy | Pending seed | 1 | 11 h | 1440 | New-seed dialog | ✅ baseline (review pending) |
| S10 | Healthy | Day 1 (gen 2) | 1 | 3 h | 1440 | Card, night | ✅ baseline (review pending) |
| S11 | Thirsty | 6 w (gen 3) | 2 | 11 h | 1440 | Garden dull (soft health) | ✅ baseline (review pending) |
| S12 | Healthy | 3 mo (gen 5) | 4 | 18 h | 1440 | Card | ✅ baseline (review pending) |
| S13 | Healthy | 5 mo (gen 9) | 8 | 11 h | 1440 | Settings: garden list | ✅ baseline (review pending) |
| S14 | Healthy | 2 w (gen 10) | 9+ (slot reuse) | 11 h | 1440 | Card | ✅ baseline (review pending) |
| S15 | Wilted / dormant (away 2 weeks) | 3 mo | 2 | 11 h | 1440 | Card | ✅ baseline (review pending) |
| S16 | Healthy | 3 mo | 2 | 22 h | Off-hours | No card, "resting" | ✅ baseline (review pending) |
| S17 | Healthy | 3 mo | 2 | 11 h | Vacation | Greeting, no card | ✅ baseline (review pending) |
| S18 | Healthy | 3 mo | 8 | 11 h | Light mode | ≤ 3 garden plants | ✅ baseline (review pending) |
| S19 | Healthy | 3 mo | 2 | 11 h | No WebGL | CSS window | ✅ baseline (review pending) |
| S20 | Healthy | 3 mo | 2 | 11 h | 720×450 (200 %) | Card + pill | ✅ baseline (review pending) |
| S21 | Healthy | 6 w | 1 | 11 h | 480×820 | Card + pill | ✅ baseline (review pending) |
| S22 | Healthy | 3 mo | 2 | 11 h | 1440 | Help modal (video) | ✅ baseline (review pending) |
| S23 | Healthy | Moving day | 0 → 1 | 11 h | Reduce motion | Dialog directly | ✅ baseline (review pending) |
| S24 | Wilted | 5 mo (gen 2) | 1 | 18 h | 1440 | Garden + wilted pot side by side | ✅ baseline (review pending) |

## 4. Gaps to close before sharing (priority)

Planned in detail in [004 · release readiness](plans/004-release-readiness.md) (phases R1–R8).

1. **Visual regression for S01–S24**: Playwright `toHaveScreenshot` on the dev build with frozen time (`page.clock`) and seeded data (reuse `seed`, `seedSixMonths`, the simulator and the dev `__marumado` hooks). One baseline per scenario, reviewed by eye once, then guarded.
2. **UI assertions for engine-only cases**: off-hours / vacation / daily cap / overnight / almost ready / anti-farming toast / Later.
3. **Garden edge cases**: Escape on the new-seed dialog, light-mode cap, start over erases the garden, pre-move restore, 9th plant slot.
4. **Onboarding and Settings limits**: start = end, max 5 / min 1 habit, Enter to rename, colour reaches the state, mid-onboarding close, Download & erase.
5. **Time**: midnight rollover with the tab open; time-zone change.
6. **Keyboard / focus** in dialogs, long and kanji names, day / night contrast.
7. **Leaks and frame cost**: render many times, assert garden builds are disposed; time a frame with 8 garden plants.

## 5. Release checklist (sharing a build)

| Step | How |
|---|---|
| All suites green | `npm run compile && npm run test:tz && npm run test:e2e` |
| Visual baselines reviewed | Playwright report, S01–S24 |
| Production build, no dev controls | `npm run build`; E2E first-run asserts no `#mockControls` |
| Zip for sharing | `npm run zip` → install unpacked in Chrome and Edge, keep the new-tab override |
| Manual: hidden tabs free WebGL | Open ~20 tabs, wait 30 s, go back to an old one: 3D shows, no "too many contexts" in the extension's error page |
| Manual: real GPU cold open | First frame < 300 ms (`marumado:first-frame`) |
| Docs | Tracker, bug log, plan status, this file |
