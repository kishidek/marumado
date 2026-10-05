# Bug log

**Living document.** Index of all docs: [README.md](README.md).

Every bug found so far: **open** ones first, then the fixed ones (oldest first). Each fixed entry says how it showed up, why it happened, what fixed it and what now guards against it coming back.

## Open

None. The Settings review (#14–23) is fixed; see below.

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
| 14 | 2026-10-04 | 🔴 | Engine / Settings | Changing work hours or workdays rewrote the plant's past | Settings review | `e81f7e9` |
| 15 | 2026-10-04 | 🔴 | Engine / Settings | Changing a habit's interval re-read old answers | Settings review | `e81f7e9` |
| 16 | 2026-10-04 | 🔴 | Engine / Settings | Removing an unanswered habit granted past care days | Settings review | `e81f7e9` |
| 17 | 2026-10-04 | 🔴 | Vacation | Turning vacation off didn't bring questions back until tomorrow | Settings review | `e81f7e9` |
| 18 | 2026-10-04 | 🟠 | Settings UI | Drawer lagged one step behind after Remove / Add | Settings review | `e81f7e9` |
| 19 | 2026-10-04 | 🟠 | Engine / Time | Clock going backwards past a checkpoint walked ~20,000 fake days | Settings review | `e81f7e9` |
| 20 | 2026-10-04 | 🟢 | Settings UI | Rejected workday / hours change still shown in the control | Settings review | `e81f7e9` |
| 21 | 2026-10-04 | 🟠 | Habits | Questions hard-coded their interval ("…in the last 2 hours") | Settings review | `e81f7e9` |
| 22 | 2026-10-04 | 🟢 | Habits | Daily habits offered sub-daily intervals | Settings review | `e81f7e9` |
| 23 | 2026-10-04 | 🟠 | Data | "Start over": Cancel on the 2nd confirm meant "erase anyway" | Settings review | `e81f7e9` |
| 24 | 2026-10-04 | 🟠 | New tab | Question card kept old wording after an interval change | E2E for #21 | `e81f7e9` |
| 25 | 2026-10-05 | 🟠 | Garden | New-seed dialog opened over the move ceremony | Screenshots of the ceremony | `7a01c5d` |
| 26 | 2026-10-05 | 🟢 | Garden | The moving plant flashed in its garden slot before taking off | Same review | `7a01c5d` |
| 27 | 2026-10-05 | 🟠 | Garden | While the new seed waited for its name, greeting, toasts and help still used the moved plant's name | Garden UI audit | `c1fb6a3` |
| 28 | 2026-10-05 | 🟠 | Garden | The lantern stood on a plant slot and was swallowed as that plant kept growing | Visual baseline S14 | (this commit) |
| 29 | 2026-10-05 | 🟠 | Tests | A 1 % screenshot tolerance let a moved lantern pass as "no change" | Comparing lantern options | (this commit) |

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

### 14–16. Settings changes rewrote the plant's past
- **Symptom:** switching workdays Mon–Fri → 7 days dropped health 1.00 → 0.76 instantly; changing Eye break from 30 min to 2 h turned 0.29 into 0.63 for the same answers; removing an unanswered habit raised past care days 0 → 5 (exploitable).
- **Cause:** the replay used the *current* settings for every past day.
- **Fix:** history-changing saves (work hours, workdays, habit list, intervals) first fold every day before today into a checkpoint computed with the *old* settings (`freezePast`); new settings apply from today. Reuses the exact checkpoint from log compaction. Compaction never moves a checkpoint backwards. Settings now says "Changes apply from today on".
- **Guard:** Vitest "settings apply from today on" (#14, #15, #16); E2E "#14 changing workdays in Settings does not rewrite the plant's past".

### 17. Turning vacation off didn't bring questions back until tomorrow
- **Symptom:** after unchecking Vacation mode the greeting still said "Enjoy your time off" and no question appeared for the rest of the day; that day couldn't be a care day.
- **Cause:** vacation was compared by whole calendar days, so the day it ended still counted as vacation.
- **Fix:** availability uses the exact time (`vacationAt`); a day is a vacation day only if vacation was on when that day's work ended (`vacationDay`). Care earned on a vacation day still counts; only penalties are skipped.
- **Guard:** Vitest "vacation is measured in time"; E2E "#17 turning vacation off brings questions back immediately".

### 18. Settings drawer lagged one step behind
- **Symptom:** after "Remove" the habit stayed listed; after adding one, the previous list showed.
- **Cause:** the drawer re-rendered right after saving, before the new settings reached the page.
- **Fix:** the drawer re-renders whenever stored data changes (this tab or another), except while the user is typing in it (then on blur). Manual `render()` calls removed. Also fixes "Last backup: never" right after exporting and stale drawers in other tabs.
- **Guard:** E2E "#18 the Settings drawer shows the saved habit list right away".

### 19. Clock going backwards walked thousands of fake days
- **Symptom (by code reading):** with a checkpoint in the "future" (system clock set back), the day loop never reached its end and ran ~20,000 days.
- **Cause:** `shiftDatesBetween` assumed start ≤ end.
- **Fix:** start after end returns no days; `freezePast` keeps a checkpoint that's ahead.
- **Guard:** Vitest "clock going backwards".

### 20. Rejected workday / hours change still shown
- **Symptom:** deselecting the last workday (or start = end) showed the rejected state while the old value stayed saved.
- **Fix:** pickers take a validator; rejected input snaps back to the last accepted value (Settings and onboarding). An end before the start now shows "Overnight shift: ends at … the next morning."
- **Guard:** E2E "#20 a rejected workday toggle snaps back".

### 21–22. Questions vs intervals
- **Symptom:** "Did you drink water in the last 2 hours?" even at 30 min; "Shutdown" (about yesterday) could be set to every 30 min.
- **Fix:** question templates with `{since}` ("in the last 30 minutes", "in the last hour", "today"); daily-only habits (Daylight, Real lunch, Shutdown) only offer "Once a day".
- **Guard:** Vitest "question wording"; E2E "#21–22".

### 23. "Start over" could erase by mistake
- **Symptom:** two `confirm()`s; on the second ("Download a backup first?") *Cancel* meant "don't download, erase anyway".
- **Fix:** one dialog (`ui/ask.ts`, native `<dialog>`) with explicit buttons: Cancel / Erase without backup / Download backup & erase. Cancel is focused; Escape cancels. Restore and Remove habit use the same dialog.
- **Guard:** E2E "#23 Start over: Cancel keeps the plant".

### 24. Question card kept old wording after an interval change
- **Symptom:** changing Water to 30 min still showed "…in the last 2 hours?" on the open card.
- **Cause:** the card only re-rendered when the *habit* changed.
- **Fix:** the card re-renders when anything it shows changes (habit, interval, low hint).
- **Guard:** E2E "#21–22" (found by it).

### Smaller improvements from the same review
Enter saves Rename; exported filenames fall back to `plant` for non-Latin names; focus returns to the gear when Settings closes; removing a habit asks first; adding a habit can't exceed 5 even from two tabs; turning vacation on twice (two tabs) doesn't stack.

### 25. New-seed dialog opened over the move ceremony
- **Symptom:** the plant's flight through the window was hidden: the dialog appeared ~0.5 s after it started.
- **Cause:** saving the move triggers a storage-watch re-render; at that moment the page didn't know a ceremony was starting, so it opened the dialog.
- **Fix:** a `moving` flag is set *before* saving and cleared when the flight lands; the dialog waits for it.
- **Guard:** visual check of the ceremony (`.output/TEMP - garden-move/`); E2E "garden: at 6 months…" waits for the dialog after the flight.

### 26. The moving plant flashed in the garden before taking off
- **Symptom:** for a frame the plant was already standing on the hill and also about to fly.
- **Cause:** same re-render, before the ceremony hid the newest garden plant.
- **Fix:** while `moving`, the newest garden plant is hidden until it lands.
- **Guard:** visual check.

### 27. The new seed was called by the moved plant's name
- **Symptom:** after Hana moved, the pill said "New seed" but the greeting ("Off the clock. Hana is resting."), toasts and the help modal still said "Hana".
- **Cause:** the stored plant name only changes when the new seed is named; those texts read it directly.
- **Fix:** one label for the current plant (`plantLabel()`): "your new seed" while pending, the name otherwise.
- **Guard:** E2E "garden: Settings lists the garden; texts never use the moved plant's name for the new seed".

### 28. The lantern was swallowed by a garden plant
- **Symptom:** in S14 (garden full, oldest plants large) the lantern stood inside the pink plant on the middle terrace.
- **Cause:** the lantern sat 0.32 m from slot 2; garden plants keep growing, so the oldest one engulfed it.
- **Fix:** lantern moved to the back-left (−1.85, −6.3), ≥ 1.18 m from every slot. Three positions were compared; the others fell outside the round window.
- **Guard:** visual baselines S02 (empty garden) and S14 (full garden).

### 29. Screenshot tolerance too loose
- **Symptom:** while comparing lantern positions, Playwright kept the old images: a moved lantern changed < 1 % of the pixels.
- **Cause:** `maxDiffPixelRatio: 0.01` (≈ 10,000 px at 1280×800).
- **Fix:** rendering proved pixel-deterministic (0 px drift over two full runs), so the tolerance is now `maxDiffPixels: 50`.
- **Guard:** two zero-tolerance runs recorded in plan 004.
