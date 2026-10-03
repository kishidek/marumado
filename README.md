# Marumado 丸窓

A Chrome new-tab extension: an ajisai (紫陽花, hydrangea) on a Kyoto windowsill that grows with your healthy desk-work habits.

Each new tab may ask one quick question ("Did you drink water in the last 2 hours?"). Keep your habits and the plant grows, gets repotted and blooms; skip them and it droops, but it never dies. The sky outside the round window follows your local time.

> **Status:** early. The new tab is a UI mockup with static data; the habit engine is not wired yet. See [docs/plan-wxt.md](docs/plan-wxt.md).

## Privacy

Everything stays in your browser (`chrome.storage.local`). No account, no analytics, no network requests. The only permission is `storage`.

## Install (unpacked)

```bash
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and select `.output/chrome-mv3`. Open a new tab.

## Develop

| Command | What it does |
|---|---|
| `npm run dev` | WXT dev mode: opens Chrome with the extension and reloads on save |
| `npm run build` | Production build in `.output/chrome-mv3` |
| `npm run zip` | Zip for distribution |
| `npm run compile` | Type-check |
| `npm run lab` | Plant lab (plain Vite page, not shipped): tune the ajisai's growth × health |

The new tab accepts review params: `?hour=22&day=180&health=0.4&onboarding=1&settings=1`.

## Structure

```
src/
  entrypoints/newtab/   the new-tab page (WXT wires the manifest override)
  plant/                procedural ajisai: every visual is a function of days of care × health
  scene/                window scene: room, round window, sky by local time, textures
  lab/                  plant lab code
lab/                    plant lab page + its Vite config
public/icon/            extension icons (source: assets/icon.svg)
docs/                   plan, decisions and risk register
```

## License

[MIT](LICENSE). Bundled: three.js (MIT), Shippori Mincho font (OFL-1.1), Lucide icons (ISC).
