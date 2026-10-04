# Marumado 丸窓

A Chrome new-tab extension: an ajisai (紫陽花, hydrangea) on a Kyoto windowsill that grows with your healthy desk-work habits.

Each new tab may ask one quick question ("Did you drink water in the last 2 hours?"). Keep your habits and the plant grows, gets repotted and blooms; skip them and it droops, but it never dies. The sky outside the round window follows your local time.

> **Status:** MVP complete and in private use (installed unpacked). Not on the Chrome Web Store. Docs: [index](docs/README.md) · [tracker](docs/tracker.md) · [bug log](docs/bugs.md) · plans: [001 MVP](docs/plans/001-mvp-wxt.md), [002 garden](docs/plans/002-garden.md).

## Privacy

Everything stays in your browser (`chrome.storage.local`). No account, no analytics, no network requests. The only permission is `storage`.

## Install (unpacked)

```bash
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `.output/chrome-mv3`. Open a new tab.

## FAQ

- **My new tab still shows another extension.** Only one extension can replace the new tab. Disable the other one (Momentum, etc.) in `chrome://extensions`.
- **Chrome asks "Change back to Google?"** That's Chrome checking you meant to install a new-tab extension. Choose *Keep it*.
- **No plant in Incognito.** Chrome doesn't let extensions replace the Incognito new tab.
- **No questions right now.** Questions only appear during your work hours and workdays (Settings → Work hours), and never on vacation.
- **I see a flat round window instead of the 3D room.** WebGL is off in this browser (hardware acceleration disabled or blocked by policy). Everything else still works.

## Develop

| Command | What it does |
|---|---|
| `npm run dev` | WXT dev mode: opens Chrome with the extension and reloads on save |
| `npm run build` | Production build in `.output/chrome-mv3` |
| `npm run zip` | Zip for distribution |
| `npm run compile` | Type-check |
| `npm test` | Engine tests (`npm run test:tz` runs them in 3 time zones) |
| `npm run test:e2e` | Builds, then runs Playwright against the real unpacked extension |
| `npm run lab` | Plant lab (plain Vite page, not shipped): tune the ajisai's growth × health |
| `npm run render:deck` | Renders the 3 deck videos (growth, neglect, recovery) to `deck-videos/`; needs `ffmpeg` |
| `npm run render:explainer` | Re-renders `public/media/explainer.webm` (help modal video) from the lab; needs `ffmpeg` |

In dev mode (`npm run dev`) the new tab shows **Dev controls** (sky hour, plant age/health preview, erase data) and accepts `?hour=22&day=180&health=0.4`. Production builds strip them.

## Structure

```
src/
  entrypoints/newtab/   the new-tab page (WXT wires the manifest override)
  engine/               pure TS: event log → health & growth, question scheduler, backup validation
  storage/              chrome.storage via WXT, Web Locks for multi-tab writes
  ui/                   onboarding, settings, DOM helpers
  plant/                procedural ajisai: every visual is a function of days of care × health
  scene/                window scene: room, round window, sky by local time, textures
  lab/                  plant lab code
lab/                    plant lab page + its Vite config
public/icon/            extension icons (source: assets/icon.svg)
docs/                   index (README), tracker, bug log, numbered plans
```

## License

[MIT](LICENSE). Bundled: three.js (MIT), Shippori Mincho font (OFL-1.1), Lucide icons (ISC).
