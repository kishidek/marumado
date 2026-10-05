# Tracker

**Living document.** Status of every plan in [plans/](plans/) (phases and risks come from [001 · MVP](plans/001-mvp-wxt.md)); updated with every change. Bugs: [bugs.md](bugs.md). Index of all docs: [README.md](README.md).

## Summary (2026-10-05, late)

Legend: ✅ done · 🟡 partial · ⬜ not started · ⏸️ postponed

| Area | Status |
|---|---|
| Phases | 0–7 and 9 ✅ · 8 (Chrome Web Store) ⏸️ postponed |
| P0 risks | 9 / 9 ✅ |
| P1 risks | 11 / 11 ✅ |
| P2 risks | 6 / 6 ✅ |
| Missing pieces (plan §6) | 4 / 5 ✅ · beta channel ⏸️ (needs the store) |
| Bugs | 30 fixed · 0 open |
| Tests | Vitest 46 (× 3 time zones) · Playwright E2E 27 · visual regression 24 scenes (approved) · coverage and gaps: [qa.md](qa.md) |
| Left | **Release readiness (plan 004: R3–R8)** · public repo polish (gitignore, README, project page) · garden deck videos (G4). Post-MVP: holidays, mood / caffeine habits, seasons (parked plan 003) |

## Phases

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Decisions | ✅ | All blocking decisions answered (plan §5) |
| 1 | Scaffold WXT | ✅ | Manifest, icons, build, zip; verified in Chromium and Edge |
| 2 | Engine | ✅ | Engine + simulator + checkpoints; 37 Vitest tests in 3 time zones; `noUncheckedIndexedAccess` back on (48 sites fixed) |
| 3 | Storage + multi-tab | ✅ | Web Locks + `storage.watch` + refresh on visibility. Deviation: one `local:events` key instead of per-day buckets (simpler; compact later) |
| 4 | Wire UI to engine | ✅ | Onboarding, questions, plant, settings, rename, growth-based camera |
| 5 | Resilience | ✅ | GL host (release when hidden, recover on return, no steal loop), CSS fallback window, early boot background, canvas fade-in. Release-when-hidden verified manually only (headless reports every tab visible) |
| 6 | Backup | ✅ | Export, validated restore, pre-restore snapshot, backup reminder; E2E round-trip + corrupt file |
| 7 | QA matrix | ✅ | Playwright suite in repo (`npm run test:e2e`): 23/23 |
| 8 | Store | ⏸️ | Postponed (private use, unpacked) |
| 9 | Deck videos | ✅ | `npm run render:deck` → `deck-videos/` (1080p H.264, 8 s each: growth 30 d, neglect, recovery). Not committed (large) |

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
| Context invalidated after update | ✅ | Not possible for an extension page: on update Chrome swaps open Marumado tabs for its default new tab (E2E). Data survives (Chrome storage; confirmed by reloading the extension) |
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
| Slow machines | ✅ | Light mode in Settings: pixel ratio 1, no antialiasing, low-power GPU hint, no answer animations (E2E) |
| Touch devices | ✅ | E2E with `hasTouch` |
| Focus / modals | ✅ | Background `inert` while onboarding/settings/help are open; focus moves into each dialog |
| Settings edge input | ✅ | Start = end, no workdays, min 1 habit validated |

### P2

| Risk | Status | Notes |
|---|---|---|
| Plant name with kanji / emoji, long names | ✅ | System font fallback; ellipsis after 14ch |
| Event log growth over years | ✅ | Checkpoint compaction: events older than 90 days fold into an exact checkpoint (equivalence tests + E2E); carried in backups |
| Vacation mode left on forever | ✅ | Toast once a day after 14 days (E2E) |
| Very old plants | ✅ | Potted plant moves to the garden at 6 months and keeps growing there |
| Browser zoom 50–200 %, narrow windows | ✅ | Found + fixed: at 200 % / short windows the plant panel covered the Yes/No buttons. Left column now stacks (flex); panel starts collapsed on small screens. E2E checks no overlap at 720×450 and 480×820 |
| `three` bundle parse time | ✅ | `marumado:first-frame` mark. laptop GPU (Metal): 77–120 ms typical, ~1.3 s for the first tab of a browser session (process + shader warm-up). Software GL: 0.9–2.9 s |

### Found while closing the tracker

| Bug | Status | Notes |
|---|---|---|
| A habit added weeks later started at 0 health (penalized for days before it existed) | ✅ | `addedAt` per habit; Vitest |
| Each tab spent 2 WebGL contexts (support probe + renderer) → "Too many active WebGL contexts" in the browser | ✅ | Probe removed; hidden tabs release after 5 s (was 20 s); release on `pagehide` |
| "WEBGL_lose_context not supported" warning | ✅ | Don't force-lose an already lost context |
| A late "context lost" event from an old canvas marked the new one as lost | ✅ | Only the live canvas can change state (E2E via light mode) |

### Settings review (2026-10-04)

| Item | Status | Notes |
|---|---|---|
| Settings changes rewrite the past (#14 hours/days, #15 intervals, #16 removing a habit) | ✅ | Checkpoint with the old settings on every history-changing save (`freezePast`) |
| Vacation off doesn't resume questions until tomorrow (#17) | ✅ | Time-based (`vacationAt` / `vacationDay`) |
| Settings drawer one step behind (#18) | ✅ | Drawer re-renders on every data change, also from other tabs |
| Clock going backwards past a checkpoint (#19) | ✅ | Guard in `shiftDatesBetween` |
| Rejected workday/hours still shown (#20) | ✅ | Pickers snap back; overnight hint |
| Questions vs interval, daily-habit intervals, "Start over" dialog (#21–23) | ✅ | `{since}` wording, daily-only options, `ask()` dialog |
| Card kept old wording after interval change (#24, found by E2E) | ✅ | Card keyed by its content |

### Garden UI audit (2026-10-05)

| Item | Status | Notes |
|---|---|---|
| Flower colour in onboarding | ✅ | Name step; now says the first flowers open after ~6 weeks of care |
| Messages when a plant moves | ✅ | Ceremony → "<name> moved to the garden" dialog → toast after naming |
| Texts while the new seed has no name (#27) | ✅ | Greeting, toasts, help and Settings say "your new seed", never the moved plant's name |
| Who is in the garden | ✅ | Settings → "Your garden · N": name, colour, time in the garden (newest first). Pill: "N in the garden" |
| Current plant's colour / generation | ✅ | Settings → Your plant: swatch, "Generation N", when it will move |
| Start over / Restore mention the garden | ✅ | Dialogs say the garden is erased / replaced, with counts |
| Help modal | ✅ | 6 tiles in one row ("Skip it · it droops, but never dies"; "After 6 months · it moves to the garden") |
| Help video shows the garden | ✅ | Help modal redesigned: 4 steps with looping clips (plan 004 §10) |

## Missing pieces (plan §6)

| Item | Status | Notes |
|---|---|---|
| "Yes" feedback animation on the plant | ✅ | Water: droplets fall into the pot; other habits: golden glints rise; plant sways; health eases instead of jumping (also on "Not yet"). Off with reduce motion |
| Local error log in the export | ✅ | Last 50 uncaught errors in `local:diagnostics:errors`; count + Clear in Settings; included in backups (E2E) |
| Rename + start over in Settings | ✅ | |
| Beta channel (unlisted store) | ⏸️ | Store postponed |
| Minimum Chrome version | ✅ | `minimum_chrome_version: 111` (CSS color-mix; also covers inert, structuredClone, WebGL2) |

## Post-MVP

| Item | Status |
|---|---|
| Garden graduation at 6 months, and what comes next | 🟡 | [002 · garden](plans/002-garden.md): G0–G3 ✅ (engine, terraced garden, ceremony, new seed, backup v2); G4 deck videos pending |
| Holidays / days off beyond weekends | ⬜ |
| Mood check (scale) and caffeine (inverted) habits | ⬜ |
| Seasons outside the window | ⬜ | Parked: [003 · seasons](plans/003-seasons.md) (options only) |
| Release readiness (tests + visuals) | 🟡 | [004](plans/004-release-readiness.md): R0–R2 ✅ (24 baselines approved); next R3 |
| Public repo polish | 🟡 | ✅ .gitignore (zips, keys, scratch), machine-specific references removed from docs, README rewritten for visitors, CONTRIBUTING + issue/PR templates, `.nvmrc` + `engines`. ⬜ First GitHub Release with the zip (plan 004 R8) |
| Project page | 🟡 | [005](plans/005-project-page.md): built locally (own identity, product page + how it was built, landing card 03); review + deploy pending |

## Log

- 2026-10-05: plan 005 project page: built on a playground branch, not deployed yet.

- 2026-10-05: public repo polish: gitignore, docs scrubbed of machine details, new README, CONTRIBUTING and templates.

- 2026-10-05: user approved the 24 visual baselines and the 4 help clips; R2 done.

- 2026-10-05: help modal redesigned: intro on healthy habits, 4 steps with looping clips of the real scene (incl. move + garden), credit link with UTMs; old explainer removed.

- 2026-10-05: user review of baselines: S08 flight fixed (#30); S22 help content to be redesigned.

- 2026-10-05: plan 004 R1–R2: visual harness + 24 scene baselines (pixel-deterministic, 50 px tolerance). Bugs #28 (lantern swallowed by a plant) and #29 (1 % tolerance too loose) fixed.

- 2026-10-05: plan 004 (release readiness) written: visual harness, 24 scenario baselines, missing UI / edge cases, release run.

- 2026-10-05: QA audit: `docs/qa.md` with cases, scenario matrix S01–S24 and gaps; main gap: no automated visual tests.

- 2026-10-05: seasons idea parked as plan 003 (draft).

- 2026-10-05: garden UI audit: Settings shows the garden and the current plant's colour/generation; pending-seed texts fixed (#27); garden-aware Start over / Restore; help tiles; onboarding colour note. E2E 27/27. Videos on hold (user).

- 2026-10-05: garden built (002 G1–G3): compressed growth (full look at 6 months), terraced garden + bigger window, automatic move with ceremony, new-seed dialog, flower colour in onboarding, backup v2. Bugs #25–26 found on the ceremony screenshots. Explainer video re-rendered. Vitest 46 × 3 TZ, E2E 26/26.

- 2026-10-04: docs reorganised: `docs/README.md` index; plans numbered in `docs/plans/` (001 MVP = done/frozen with known deviations, 002 garden = active).

- 2026-10-04: garden decisions: automatic at 6 months; new pot + new seed with a different leaf green; user picks flower colour; garden reacts softly to current health.

- 2026-10-04: garden graduation plan drafted (`docs/plans/002-garden.md`); scene geometry checked: the garden fits in the lower half of the round window, ~2–9 m out.

- 2026-10-04: docs pass: tracker summary added; plan status, decisions and §6 brought up to date.

- 2026-10-04: Settings review fixed: #14–23 plus #24 found by the new E2E. Vitest 37 × 3 TZ, E2E 23/23.

- 2026-10-04: Settings review: 7 bugs + 3 design conflicts logged as open in `bugs.md` (#14–23), not fixed yet.

- 2026-10-04: bug log created (`docs/bugs.md`, 13 bugs with cause, fix, guard and commit).

- 2026-10-04: tracker items closed (strict TS, light mode, log compaction); 4 bugs found and fixed (see above). Vitest 29 × 3 TZ, E2E 17/17.

- 2026-10-03: quick batch: minimum Chrome 111, local error log in backups, update behaviour verified (no stale context possible), zoom/narrow layout bug fixed. E2E 15/15.

- 2026-10-03: deck videos rendered; name ellipsis; vacation nudge; reminders now marked only once shown (bug); first-frame timing measured.

- 2026-10-03: >16 tabs: headless reports all tabs visible, so E2E now covers loss → CSS window → recovery (10/10 E2E).

- 2026-10-03: answer feedback animation; tracker now lists P2, missing pieces and post-MVP.

- 2026-10-03: "How Marumado works" modal (help button next to Settings) with a looping explainer video rendered from the lab (`npm run render:explainer`); fixed `npm run lab` dev server (script path outside Vite root); lab compare view keeps fixed slots while wilting. E2E: 9/10 pass, 1 fixme.

- 2026-10-03: phase 5 mostly done; simulator; backup reminder; E2E suite in repo (8/9). E2E caught 2 real bugs: stale settings in export, page left inert when another tab plants/restores.

- 2026-10-03: phases 1–4 done; engine wired; camera follows growth; empty-card flash fixed.
