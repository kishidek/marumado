# 003 · Seasons outside the window

| | |
|---|---|
| **Status** | **Draft** (parked for later, 2026-10-05) · no decisions taken yet |
| **Created** | 2026-10-05 |
| **Updated** | 2026-10-05 |
| **Supersedes** | — |
| **Superseded by** | — |
| **Live status** | [tracker.md](../tracker.md) → Post-MVP |

## 1. Idea

Show the season of the user's place in the scene, without asking for anything and without sending data anywhere.

## 2. Knowing the season (no permissions, nothing sent)

| Method | Gives | Accuracy | Privacy |
|---|---|---|---|
| **1. System time zone** (`Intl…timeZone`, e.g. `America/Santiago`) → bundled table zone → latitude | Hemisphere, and tropics | High | Local, no permission (same source as the clock) |
| 2. DST direction (offset in January vs July) | Hemisphere, only where DST exists | High where it applies | Local |
| 3. Browser locale region (`es-CL`) | Region of the UI language | Medium-low | Local |
| 4. Geolocation API | Exact position | Exact | Permission prompt: conflicts with "we ask for nothing" |
| 5. IP geolocation | Country | High | Sends data to a third party: **excluded** |

**Proposal:** 1, falling back to 2 then 3. Latitude between −15° and 15° → "no seasons" (or wet/dry). Season from latitude sign + month. Settings override: Automatic / Northern / Southern / No seasons.

## 3. What would change (proposal)

Seasons change the **scenery, never the user's plants**: a real ajisai drops its leaves in winter, which would read as wilting and break the health signal.

| Season | Scenery |
|---|---|
| Spring | Sakura on the hills |
| Summer | Rainy season (tsuyu), greener garden |
| Autumn | Red momiji on the hills and hedge (fine here: not on the user's plants) |
| Winter | Snow on the lantern, walls and mountains |

## 4. Decisions needed (when picked up)

1. Do it at all, and which seasonal changes.
2. Detection: time zone only, or with the fallbacks; Settings override yes/no.
3. Tropics: no seasons, or wet/dry season.
4. Transition: switch on the date, or blend over a couple of weeks.
