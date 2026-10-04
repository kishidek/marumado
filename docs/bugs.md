# Bug log

Every bug found so far, oldest first: **open** ones first, then the fixed ones. Each fixed entry says how it showed up, why it happened, what fixed it and what now guards against it coming back.

## Open

Found in the Settings review (2026-10-04). Not fixed yet.

| # | Sev. | Area | Bug | Evidence |
|---|---|---|---|---|
| 14 | 🔴 | Engine / Settings | Changing work hours or workdays rewrites the past: switching Mon–Fri → 7 days drops health 1.00 → 0.76 instantly (past weekends become ignored workdays) | Vitest probe |
| 15 | 🔴 | Engine / Settings | Changing a habit's interval re-reads old answers: the same three "Not yet" give 0.29 at 30 min but 0.63 at 2 h | Vitest probe |
| 16 | 🔴 | Engine / Settings | Removing an unanswered habit makes the plant grow instantly: past care days 0 → 5 (the "more than half" bar is recomputed with fewer habits). Exploitable | Vitest probe |
| 17 | 🔴 | Engine / Vacation | Turning vacation off brings no questions back until tomorrow; greeting still says "Enjoy your time off" and today can't be a care day (`onVacation` compares whole days, not times) | E2E probe |
| 18 | 🟠 | Settings UI | The drawer lags one step: after "Remove" the habit stays listed; after adding one it shows the previous list (`render()` runs before the new settings reach the page) | E2E probe: 3 rows shown, 2 stored |
| 19 | 🟠 | Engine / Time | If the system clock goes backwards past a checkpoint, `shiftDatesBetween` walks ~20,000 fake days (start after end isn't handled) and the plant state becomes absurd | Code reading |
| 20 | 🟢 | Settings UI | Deselecting the last workday (or start = end) is rejected but the control shows the rejected value; UI and stored data disagree | Code reading |

**Design conflicts** (not crashes, but behaviour that contradicts itself):

| # | Sev. | Area | Conflict |
|---|---|---|---|
| 21 | 🟠 | Habits | Questions hard-code their interval ("…in the last 2 hours?") even after the user changes it |
| 22 | 🟢 | Habits | Daily habits offer sub-daily intervals (e.g. "Shutdown: did you close the laptop yesterday?" every 30 min) |
| 23 | 🟠 | Data | "Start over" uses two `confirm()`s; on the second one, *Cancel* means "don't download, erase anyway". Easy to lose data by mistake |

**Smaller improvements noted in the same review:** Enter doesn't submit Rename (and an unsaved name is dropped silently); the drawer doesn't refresh on changes from other tabs ("Last backup" stays "never" right after exporting); exported filename becomes `marumado---….json` for kanji names; an end time before the start silently creates an overnight shift; focus doesn't return to the gear button on close; removing a habit is instant, with no confirm or undo.

## Fixed

Severity: 🔴 broke a core flow or data · 🟠 visible / confusing · 🟢 minor or internal

| # | Date | Sev. | Area | Bug | Found by | Commit |
|---|---|---|---|---|---|---|
| 1 | 2026-10-03 | 🟢 | Repo | Extension icons not tracked by git | Staging the WXT port | `bb9bacc` |
| 2 | 2026-10-03 | 🔴 | Backup | Export used the plant's old name after a rename | E2E script | `f921c51` |
| 3 | 2026-10-03 | 🟠 | New tab | Empty question card and plant pill flashed on every new tab | Screenshot review | `afe99bf` |
| 4 | 2026-10-03 | 🔴 | Onboarding | Page stayed unclickable when another tab planted or restored the plant | E2E | `59519b5` |
| 5 | 2026-10-03 | 🟢 | Tooling | `npm run lab` dev server loaded the page without its script | Rendering the explainer video | `31b6675` |
| 6 | 2026-10-03 | 🟢 | Lab / video | Plants slid sideways while wilting in the compare view | Explainer video frames | `31b6675` |
| 7 | 2026-10-03 | 🟠 | Reminders | Backup / vacation reminder lost for the day if the tab closed too soon | E2E | `91483b7` |
| 8 | 2026-10-03 | 🔴 | Layout | At 200 % zoom or in short windows the plant panel covered the Yes/No buttons | Zoom / window-size review | `6f9817b` |
| 9 | 2026-10-04 | 🔴 | Engine | A habit added weeks later started at 0 health | Designing log compaction | `966faaf` |
| 10 | 2026-10-04 | 🟠 | Engine | A removed and re-added habit counted its old answers again | Fixing #9 | `966faaf` |
| 11 | 2026-10-04 | 🟠 | WebGL | Each tab used two WebGL contexts → "Too many active WebGL contexts" in Edge | User's Edge error page | `966faaf` |
| 12 | 2026-10-04 | 🟢 | WebGL | "WEBGL_lose_context extension not supported" warning | User's Edge error page | `966faaf` |
| 13 | 2026-10-04 | 🟠 | WebGL | A late "context lost" event from an old canvas marked the new one as lost | E2E (light mode) | `966faaf` |

## Details

### 1. Extension icons not tracked by git
- **Symptom:** `public/icon/*.png` didn't show up in `git status`; the public repo would have shipped without icons.
- **Cause:** the user's global gitignore has an `Icon` rule (for macOS `Icon\r` files); on a case-insensitive disk it also matched the `icon/` folder.
- **Fix:** project `.gitignore` re-includes `/public/icon/` (global config untouched).
- **Guard:** the folder is now tracked; a missing icon would show in the build output listing.

### 2. Export used the plant's old name after a rename
- **Symptom:** rename "Aoi" → "Hana", then export: the backup said "Aoi".
- **Cause:** Settings handlers used the settings object captured when the drawer was rendered, not the latest one.
- **Fix:** every handler reads the current settings at click time (`current()` in `ui/settings.ts`).
- **Guard:** E2E "rename propagates" + "export → restore round-trips".

### 3. Empty question card and plant pill flashed on every new tab
- **Symptom:** a blank glass card appeared for a moment on each new tab, then faded.
- **Cause:** the card, the plant pill and the settings button were visible in the HTML until stored data loaded.
- **Fix:** they start hidden and appear only once there is content.
- **Guard:** visual check in screenshots; E2E checks visibility after load.

### 4. Page stayed unclickable after another tab planted or restored the plant
- **Symptom:** with onboarding open in tab B, planting in tab A closed B's onboarding, but B ignored every click until reloaded.
- **Cause:** onboarding marks the background `inert`; closing it from a storage update didn't remove that.
- **Fix:** when settings appear while onboarding is open, the page closes it and releases `inert` (unless Settings is open).
- **Guard:** every E2E that seeds data while onboarding is open (most of the suite).

### 5. `npm run lab` dev server loaded the page without its script
- **Symptom:** the lab showed unstyled HTML and no 3D in dev mode (production build was fine).
- **Cause:** the page's script path pointed outside the Vite root, which the dev server can't serve.
- **Fix:** Vite root is the project; the lab lives at `/lab/index.html`.
- **Guard:** `npm run render:explainer` uses the dev server and fails visibly if it breaks.

### 6. Plants slid sideways while wilting in the compare view
- **Symptom:** in the explainer video the five pots moved left/right as they drooped.
- **Cause:** slot widths were computed from each plant's current spread, which grows as stems arch.
- **Fix:** slot widths come from the healthy plant of each age and stay fixed.
- **Guard:** re-rendering the explainer shows it immediately.

### 7. Reminders lost for the day if the tab closed too soon
- **Symptom:** a backup or vacation reminder could be skipped for a whole day.
- **Cause:** the "already shown today" flag was saved before the delayed toast actually appeared.
- **Fix:** the flag is saved only when the toast is shown.
- **Guard:** E2E "vacation left on for 15 days gets a gentle reminder".

### 8. Plant panel covered the Yes/No buttons at 200 % zoom or in short windows
- **Symptom:** at 200 % zoom (or a 720×450 / 480×820 window) the question card and the plant panel overlapped; the answer buttons were hidden.
- **Cause:** the clock, card and panel were positioned independently (absolute), so they collided when the viewport was short.
- **Fix:** the left column stacks them with flexbox; the panel expands upward over the column and starts collapsed on small screens.
- **Guard:** E2E "200 % zoom / short window: question and plant panel never overlap".

### 9. A habit added weeks later started at 0 health
- **Symptom:** adding a habit in Settings after a few weeks made it start empty and dragged the plant toward wilted.
- **Cause:** the replay treated every current habit as if it had existed since planting, so it was penalized for every past workday without answers, and it raised the "more than half" bar on days it didn't exist.
- **Fix:** each habit stores `addedAt`; days before it neither penalize it nor count it for care days, and the day it's added is a grace day.
- **Guard:** Vitest "a habit added after weeks starts fresh".

### 10. A removed and re-added habit counted its old answers again
- **Symptom:** removing a habit and adding it back later revived its old history.
- **Cause:** events were filtered only by habit id.
- **Fix:** events before the habit's `addedAt` are ignored; a re-added habit starts over.
- **Guard:** covered by the checkpoint equivalence tests (habit with `addedAt`).

### 11. Each tab used two WebGL contexts
- **Symptom:** Edge's extension error page listed "WARNING: Too many active WebGL contexts. Oldest context will be lost." after normal use.
- **Cause:** a "does this browser support WebGL?" probe created a context on every tab on top of the real one (lost contexts can still count until garbage-collected); hidden tabs also kept theirs for 20 s.
- **Fix:** no probe (the renderer itself reports failure); hidden tabs release after 5 s and on `pagehide`.
- **Guard:** E2E "20 open tabs … recovers on return" and "without WebGL". Watch Edge's error page during real use.

### 12. "WEBGL_lose_context extension not supported" warning
- **Symptom:** a three.js warning in Edge's error page.
- **Cause:** releasing a context that the browser had already taken away still asked it to "lose" itself.
- **Fix:** only force the loss on a live context.
- **Guard:** E2E runs with console errors collected; Edge error page.

### 13. A late "context lost" event marked the new context as lost
- **Symptom:** after turning on Light mode (or coming back quickly to a just-released tab), the 3D could be shown as lost, falling back to the CSS window.
- **Cause:** "context lost" events arrive asynchronously; the old canvas's event fired after the new context was created and overwrote its state.
- **Fix:** only the live canvas can change the state.
- **Guard:** E2E "light mode rebuilds the 3D context without antialiasing".
