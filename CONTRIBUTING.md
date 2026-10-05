# Contributing to Marumado

Thanks for wanting to improve it. Ideas, bug reports and pull requests are all welcome.

## Setup

```bash
nvm use            # Node version from .nvmrc
npm install
npm run dev        # opens Chrome with the extension, reloads on save
```

In dev mode the new tab shows **Dev controls** (bottom right): change the sky hour, preview any plant age and health, simulate weeks of answers, or erase all data.

## Before opening a pull request

```bash
npm run compile    # types
npm run test:tz    # engine tests in 3 time zones
npm run test:e2e   # end-to-end on the real extension
```

If your change touches anything visible, also run:

```bash
npm run test:visual
```

It compares 24 scenes against the baselines in `tests/e2e/visual/scenes.spec.ts-snapshots/`. Rendering is deterministic, so any diff is real. If the change is intended, update them with `npx playwright test --project=visual --update-snapshots`, look at the result (`npm run visual:sheet` builds a review page) and say in the PR which scenes changed and why. Baselines are recorded on macOS: on other systems, fonts differ and you'll get your own `-linux` / `-win32` files.

## Where things live

- `src/engine/` is pure TypeScript (no DOM, no `chrome.*`): the place for game rules. Add a Vitest test for any change there.
- `src/plant/` and `src/scene/` are procedural three.js; `npm run lab` is the fastest way to iterate on them.
- `docs/` explains how it was planned and built: [docs/README.md](docs/README.md) is the index. The [bug log](docs/bugs.md) lists every bug found so far with its cause and the test that guards it.

## Principles

- **Privacy first:** no network requests, no analytics, no new permissions without a very good reason.
- **The plant never dies:** health can drop, but the game must stay kind.
- **Fast new tab:** nothing heavy on startup; render only when something changes.

## Reporting a bug

Open an issue with steps to reproduce, the browser and version, and, if you can, the Diagnostics from Settings (or the exported backup, which includes them).
