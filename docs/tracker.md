# Tracker

Status of [the plan](plan-wxt.md). Updated with every change that moves a phase or a risk.

Legend: ✅ done · 🟡 partial · ⬜ not started · ⏸️ postponed

## Phases

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Decisions | ✅ | All blocking decisions answered (plan §5) |
| 1 | Scaffold WXT | ✅ | Manifest, icons, build, zip; verified in Chromium and Edge |
| 2 | Engine | 🟡 | Engine + simulator (dev time travel) + 26 Vitest tests in 3 time zones. Open: re-enable `noUncheckedIndexedAccess` |
| 3 | Storage + multi-tab | ✅ | Web Locks + `storage.watch` + refresh on visibility. Deviation: one `local:events` key instead of per-day buckets (simpler; compact later) |
| 4 | Wire UI to engine | ✅ | Onboarding, questions, plant, settings, rename, growth-based camera |
| 5 | Resilience | ✅ | GL host (release when hidden, recover on return, no steal loop), CSS fallback window, early boot background, canvas fade-in. Release-when-hidden verified manually only (headless reports every tab visible) |
| 6 | Backup | ✅ | Export, validated restore, pre-restore snapshot, backup reminder; E2E round-trip + corrupt file |
| 7 | QA matrix | ✅ | Playwright suite in repo (`npm run test:e2e`): 10/10 |
| 8 | Store | ⏸️ | Postponed (private use, unpacked) |
| 9 | Deck videos | ⬜ | Simulator ready |

## Risks

### P0

| Risk | Status | Evidence |
|---|---|---|
| Two tabs write at once | ✅ | E2E: 5/5 answers kept |
| Stale tab | ✅ | E2E: rename propagates to the other tab |
| >16 tabs lose WebGL | ✅ | E2E: oldest tab loses context → CSS window → recovers on return. Manual: hidden tabs release after 20 s |
| WebGL unavailable | ✅ | E2E with `--disable-3d-apis` |
| Time bugs (DST, overnight, clock) | ✅ | Vitest × 3 time zones |
| Answer farming | ✅ | Vitest |
| Bad restore file | ✅ | Vitest, 6 cases |
| Context invalidated after update | 🟡 | Toast exists; untested |
| MV3 CSP | ✅ | E2E asserts no console errors on the production build |

### P1

| Risk | Status | Notes |
|---|---|---|
| Another new-tab extension wins | ✅ | README FAQ |
| "Change back to Google?" bubble | ✅ | Onboarding shows on first open |
| Session restore, many tabs | ✅ | Nothing counts "opens"; background tabs don't create WebGL until shown; refresh on visibility |
| Laptop asleep for days | ✅ | Absence cap → dormant (Vitest) |
| Tab open across midnight | ✅ | 30 s re-render + refresh on visibility |
| Data loss on uninstall | ✅ | Reminder toast (14 d first, then every 30 d, max once a day) |
| First paint flash | ✅ | boot.ts background by hour + canvas fade-in |
| Slow machines | 🟡 | DPR cap, no shadows, render on demand; no light mode |
| Touch devices | ✅ | E2E with `hasTouch` |
| Focus / modals | 🟡 | Background made `inert` while onboarding/settings are open |
| Settings edge input | ✅ | Start = end, no workdays, min 1 habit validated |

### P2

| Risk | Status | Notes |
|---|---|---|
| Plant name with kanji / emoji, long names | ⬜ | Latin-only font falls back to system; needs ellipsis truncation |
| Event log growth over years | ⬜ | Compact days older than 90 into daily summaries (not urgent: ~0.7 MB/year) |
| Vacation mode left on forever | ⬜ | Gentle reminder after 14 days |
| Very old plants | 🟡 | Leaves/florets capped; garden graduation is post-MVP |
| Browser zoom 50–200 %, narrow windows | ⬜ | Responsive pass + screenshots |
| `three` bundle parse time | ⬜ | Measure cold open (`performance.mark`); budget < 300 ms to first paint |

## Missing pieces (plan §6)

| Item | Status | Notes |
|---|---|---|
| "Yes" feedback animation on the plant | ✅ | Water: droplets fall into the pot; other habits: golden glints rise; plant sways; health eases instead of jumping (also on "Not yet"). Off with reduce motion |
| Local error log in the export | ⬜ | Lets testers send crashes voluntarily (no telemetry) |
| Rename + start over in Settings | ✅ | |
| Beta channel (unlisted store) | ⏸️ | Store postponed |
| Minimum Chrome version | ⬜ | Declare in manifest (WebGL2 + ES2022) |

## Post-MVP

| Item | Status |
|---|---|
| Garden graduation at 6–12 months, and what comes next | ⬜ |
| Holidays / days off beyond weekends | ⬜ |
| Mood check (scale) and caffeine (inverted) habits | ⬜ |

## Log

- 2026-10-03: >16 tabs: headless reports all tabs visible, so E2E now covers loss → CSS window → recovery (10/10 E2E).

- 2026-10-03: answer feedback animation; tracker now lists P2, missing pieces and post-MVP.

- 2026-10-03: "How Marumado works" modal (help button next to Settings) with a looping explainer video rendered from the lab (`npm run render:explainer`); fixed `npm run lab` dev server (script path outside Vite root); lab compare view keeps fixed slots while wilting. E2E: 9/10 pass, 1 fixme.

- 2026-10-03: phase 5 mostly done; simulator; backup reminder; E2E suite in repo (8/9). E2E caught 2 real bugs: stale settings in export, page left inert when another tab plants/restores.

- 2026-10-03: phases 1–4 done; engine wired; camera follows growth; empty-card flash fixed.
