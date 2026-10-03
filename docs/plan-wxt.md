# Plan: port to WXT and ship the MVP

Status: draft · 2026-10-03 · stack: **WXT 0.21 + TypeScript (vanilla UI) + three.js**

## 1. Target

A Chrome new-tab extension with one page (`newtab`) and one permission (`storage`).
No background service worker, no content scripts, no network. Everything else in this
plan exists to keep that page fast, correct across many tabs, and safe with the user's data.

## 2. Target structure

```
wxt.config.ts            # srcDir: 'src', manifest: { name, permissions: ['storage'] }
src/
  entrypoints/
    newtab/
      index.html         # ← today's newtab.html (WXT wires chrome_url_overrides.newtab)
      main.ts            # ← today's src/newtab/main.ts, minus the mock
      style.css
  plant/                 # unchanged (ajisai.ts, geometry.ts, math.ts)
  scene/                 # unchanged (window-scene.ts, room.ts, sky.ts, textures.ts)
  engine/                # NEW, pure TypeScript, no DOM, no chrome.*
    events.ts            # event types + ids
    model.ts             # events → health per habit, growth (days of care), pot, stage
    scheduler.ts         # which question now (intervals, work hours, cooldown, caps)
    time.ts              # local-day math, DST, work-hours ranges (incl. overnight)
    backup.ts            # export/import + schema validation + migrations
  storage/
    items.ts             # WXT storage.defineItem(...) with version + migrations
    sync.ts              # cross-tab: Web Locks for writes, storage.watch for reads
  ui/                    # today's DOM code split by component (clock, card, needs, settings, onboarding)
lab/                     # the plant lab stays a plain Vite page (`npm run lab`), never shipped
public/icon/             # 16/32/48/128 px
tests/
  engine/*.test.ts       # Vitest, fake clock, TZ matrix
  e2e/*.spec.ts          # Playwright with the built extension loaded
```

## 3. Phases

Each phase ends with something that runs. The lab and mockup keep working throughout.

| # | Phase | Main output | Done when |
|---|---|---|---|
| 0 | **Decisions** | Answers to §5 | Nothing in §5 marked "blocking" is open |
| 1 | **Scaffold WXT** | `npx wxt init`-style layout, mockup moved to `entrypoints/newtab`, lab moved to `lab/` | `wxt` opens Chrome with the extension; a new tab shows the mockup; `wxt zip` produces a store zip; production build has no CSP errors |
| 2 | **Engine (pure TS)** | Re-enable `noUncheckedIndexedAccess` (off since phase 1); `engine/*` + Vitest suite + dev simulator ("advance N days") | Model and scheduler tests pass in 3 time zones incl. DST days; simulator reproduces 30 d healthy / neglect / recovery |
| 3 | **Storage + multi-tab** | `storage/items.ts`, append-only event log, Web Locks, `storage.watch` | Two tabs answering at once lose nothing; a stale tab refreshes when focused |
| 4 | **Wire UI to engine** | Mock removed; onboarding writes real settings; card/needs/plant read the model | Full first-run → answer → plant changes, with real persistence |
| 5 | **Resilience** | WebGL lifecycle, fallback, context-invalidated banner, first-paint gradient | 20 open new tabs: every visible tab renders; WebGL disabled: static fallback shows |
| 6 | **Backup** | Export / restore with validation, schema version, confirmation | Corrupt, old, future and foreign files are all rejected or migrated without touching data |
| 7 | **QA matrix** | Playwright e2e on the built extension + manual checklist (§4) | All P0 and P1 cases in §4 have a test or a checked manual step |
| 8 | **Store** (postponed) | Icons, listing copy, screenshots, privacy policy page, unlisted beta | Approved as unlisted; testers install from the store |
| 9 | **Deck videos** | 3 evolutions (healthy 30 d, neglect, recovery) via the simulator | Recorded from the real engine |

## 4. Bugs, errors and conflicts by priority, with the WXT-based mitigation

**P0 = must be solved before any tester sees it. P1 = before public release. P2 = track, fix when cheap.**

### P0

| Risk | Mitigation (stack-specific) | Test |
|---|---|---|
| **Two tabs write at once → an answer is lost** | Events are append-only, each with a unique id. Every write goes through `navigator.locks.request('ajisai-write', …)` (Web Locks are shared by all pages of the extension origin), re-reads the bucket inside the lock, appends, writes. Never write derived state. Events bucketed per local day: `local:events:YYYY-MM-DD` | e2e: two pages answer in the same tick → both events present |
| **Stale tab shows an old question** | `storage.watch` on events/settings + `visibilitychange` → recompute model and scheduler | e2e: answer in tab A, focus tab B → B shows next question |
| **More than 16 new tabs → oldest lose WebGL** | On `visibilitychange: hidden` dispose renderer and call `forceContextLoss()`; recreate on `visible`. Handle `webglcontextlost` / `restored`. Render on demand only (already true) | e2e: open 20 tabs, cycle through them, each renders |
| **WebGL unavailable** (GPU off, enterprise policy, anti-fingerprint extensions) | Feature-detect before creating the renderer; show a CSS sky gradient for the hour + a static plant illustration; UI still fully works | e2e with `--disable-gpu --disable-software-rasterizer` |
| **Time bugs: DST, overnight shifts, time-zone change, clock going backwards** | All logic in `engine/time.ts` with an injected clock; store UTC timestamps + IANA zone per event; work hours as a range that may cross midnight; negative deltas ignored | Vitest matrix run with `TZ=America/Santiago`, `Europe/Madrid`, `Asia/Tokyo`, covering DST days and 22:00–06:00 shifts |
| **Answer farming** (tap "Yes" repeatedly from the needs list) | Scheduler enforces one counted "Yes" per habit per interval; extra answers are stored but don't add growth | Vitest |
| **Restoring a bad file corrupts data** | `backup.ts` validates the whole file (schema + version) before writing; writes in a single locked operation; keeps a pre-restore snapshot under `local:backup:previous` | Vitest with corrupt / old / future / foreign JSON |
| **"Extension context invalidated" after an update** | Wrap `browser.*` calls; on that error show "Ajisai was updated, reload this tab" banner | Manual: update the unpacked build with a tab open |
| **MV3 CSP** (inline scripts / eval break the page silently) | WXT bundles everything into files; CI step loads the production build in Playwright and fails on console errors | e2e |

### P1

| Risk | Mitigation | Test |
|---|---|---|
| **Another new-tab extension wins the override** | Can't be detected from our page. Explain in onboarding copy, store listing and FAQ | Manual |
| **"Change back to Google?" bubble right after install** | Show onboarding immediately on the first open so value is visible before the user decides | Manual |
| **Session restore opens many tabs → same question everywhere** | Count an "open" only when a tab becomes visible; only the focused tab shows the highlighted question | e2e |
| **Laptop asleep for days** | Model caps decay for absence (plant goes "dormant") | Vitest |
| **Tab open across midnight** | Recompute on visibility and on a 1-min tick (Chrome throttles hidden timers anyway) | Vitest + manual |
| **Data loss on uninstall / profile reset** | Export reminder after N days without a backup (stored as last-export date only) | Manual |
| **First paint flash** | `<style>` in `<head>` paints a time-of-day gradient before JS; scene fades in | Visual check |
| **Slow machines** | Cap DPR (done), no shadows (done), "Light mode" setting that renders once and stops | Manual on a low-end laptop |
| **Touch devices (no hover)** | Needs pill opens on tap too | e2e with `hasTouch` |
| **Focus**: Chrome keeps focus in the omnibox on new tabs; modals lack focus trap | Never depend on autofocus at load; use native `<dialog>` for onboarding/settings | Manual + axe check |
| **Settings edge input**: start = end, no workdays, 0 habits | Validate in onboarding and settings; min 1 habit | Vitest + e2e |

### P2

| Risk | Mitigation |
|---|---|
| Plant name with kanji / emoji (font is Latin-only) | Fine with system fallback; truncate with ellipsis |
| Event log growth over years | Compact days older than 90 into daily summaries (well under the 10 MB `storage.local` quota) |
| Vacation mode left on forever | Gentle reminder after 14 days |
| Very old plants | Leaves/florets already capped; garden graduation (see §5) |
| Browser zoom 50–200 %, very narrow windows | Responsive pass + screenshots in CI |
| `three` bundle parse time (~147 KB gz) | Measure cold-open locally (`performance.mark`), named imports, budget < 300 ms to first paint |

## 5. Decisions

**Decided (2026-10-03):**

1. **Day of care** = a workday on which **more than half of the active habits** got at least one counted "Yes" (3 habits → 2, 4 → 3, 5 → 3). Non-workdays neither count nor penalize.
2. **Decay / recovery**: 3 consecutive "Not yet" on a habit → visibly thirsty; 2 "Yes" → recovered. Tunable constants in `engine/model.ts`.
3. **Yes/no habits only** in the MVP. "Mood check" (scale) and "Caffeine cut-off" (inverted) are removed from the catalog (10 habits left).
4. **Rename** lives in Settings ("Your plant").
5. **Start over** lives in Settings, always offering an export first.
6. **Product name**: pending (shortlist proposed).
7. **Chrome only** for now.
8. **No search box**: the page doesn't add or change search; the omnibox keeps the user's default engine.
9. **No Chrome Web Store for now**: private use, installed unpacked. Phase 8 is postponed.
10. **Public GitHub repo** under `kishidek`; license pending.

**Can wait (post-MVP):**

- Garden graduation at 6–12 months, and what happens next (new seed? collection outside the window?).
- Holidays / days off beyond weekends.

## 6. Things not yet covered anywhere

- **No way to learn about crashes** (by design, no telemetry). Proposal: keep a small local error log and include it in the export, so testers can send it voluntarily.
- **Beta channel**: publish as *unlisted* first and share the link with testers.
- **Feedback moments**: the "Yes" micro-animation (drops / shine on the plant) is not designed yet; it matters for the habit loop.
- **Rename + reset** are missing from Settings (see §5.4–5).
- **Minimum Chrome version** to declare (ES2022 + WebGL2: any Chrome from the last few years).
