# Tracker

Status of [the plan](plan-wxt.md). Updated with every change that moves a phase or a risk. Every bug found and fixed is in the [bug log](bugs.md) (13 so far).

Legend: ✅ done · 🟡 partial · ⬜ not started · ⏸️ postponed

## Phases

| # | Phase | Status | Notes |
|---|---|---|---|
| 0 | Decisions | ✅ | All blocking decisions answered (plan §5) |
| 1 | Scaffold WXT | ✅ | Manifest, icons, build, zip; verified in Chromium and Edge |
| 2 | Engine | ✅ | Engine + simulator + checkpoints; 29 Vitest tests in 3 time zones; `noUncheckedIndexedAccess` back on (48 sites fixed) |
| 3 | Storage + multi-tab | ✅ | Web Locks + `storage.watch` + refresh on visibility. Deviation: one `local:events` key instead of per-day buckets (simpler; compact later) |
| 4 | Wire UI to engine | ✅ | Onboarding, questions, plant, settings, rename, growth-based camera |
| 5 | Resilience | ✅ | GL host (release when hidden, recover on return, no steal loop), CSS fallback window, early boot background, canvas fade-in. Release-when-hidden verified manually only (headless reports every tab visible) |
| 6 | Backup | ✅ | Export, validated restore, pre-restore snapshot, backup reminder; E2E round-trip + corrupt file |
| 7 | QA matrix | ✅ | Playwright suite in repo (`npm run test:e2e`): 17/17 |
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
| Context invalidated after update | ✅ | Not possible for an extension page: on update Chrome swaps open Marumado tabs for its default new tab (E2E). Data survives (Chrome storage; confirmed by reloading in Edge) |
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
| Very old plants | 🟡 | Leaves/florets capped; garden graduation is post-MVP |
| Browser zoom 50–200 %, narrow windows | ✅ | Found + fixed: at 200 % / short windows the plant panel covered the Yes/No buttons. Left column now stacks (flex); panel starts collapsed on small screens. E2E checks no overlap at 720×450 and 480×820 |
| `three` bundle parse time | ✅ | `marumado:first-frame` mark. Apple M1 (Metal): 77–120 ms typical, ~1.3 s for the first tab of a browser session (process + shader warm-up). Software GL: 0.9–2.9 s |

### Found while closing the tracker

Full list with causes and guards: [bugs.md](bugs.md).

| Bug | Status | Notes |
|---|---|---|
| A habit added weeks later started at 0 health (penalized for days before it existed) | ✅ | `addedAt` per habit; Vitest |
| Each tab spent 2 WebGL contexts (support probe + renderer) → "Too many active WebGL contexts" in Edge | ✅ | Probe removed; hidden tabs release after 5 s (was 20 s); release on `pagehide` |
| "WEBGL_lose_context not supported" warning | ✅ | Don't force-lose an already lost context |
| A late "context lost" event from an old canvas marked the new one as lost | ✅ | Only the live canvas can change state (E2E via light mode) |

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
| Garden graduation at 6–12 months, and what comes next | ⬜ |
| Holidays / days off beyond weekends | ⬜ |
| Mood check (scale) and caffeine (inverted) habits | ⬜ |

## Log

- 2026-10-04: bug log created (`docs/bugs.md`, 13 bugs with cause, fix, guard and commit).

- 2026-10-04: tracker items closed (strict TS, light mode, log compaction); 4 bugs found and fixed (see above). Vitest 29 × 3 TZ, E2E 17/17.

- 2026-10-03: quick batch: minimum Chrome 111, local error log in backups, update behaviour verified (no stale context possible), zoom/narrow layout bug fixed. E2E 15/15.

- 2026-10-03: deck videos rendered; name ellipsis; vacation nudge; reminders now marked only once shown (bug); first-frame timing measured.

- 2026-10-03: >16 tabs: headless reports all tabs visible, so E2E now covers loss → CSS window → recovery (10/10 E2E).

- 2026-10-03: answer feedback animation; tracker now lists P2, missing pieces and post-MVP.

- 2026-10-03: "How Marumado works" modal (help button next to Settings) with a looping explainer video rendered from the lab (`npm run render:explainer`); fixed `npm run lab` dev server (script path outside Vite root); lab compare view keeps fixed slots while wilting. E2E: 9/10 pass, 1 fixme.

- 2026-10-03: phase 5 mostly done; simulator; backup reminder; E2E suite in repo (8/9). E2E caught 2 real bugs: stale settings in export, page left inert when another tab plants/restores.

- 2026-10-03: phases 1–4 done; engine wired; camera follows growth; empty-card flash fixed.
