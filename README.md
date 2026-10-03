# Ajisai new tab

A Chrome new-tab extension (in progress): a 3D ajisai (紫陽花) on a Kyoto windowsill that grows with your desk-work habits.

Two pages for now:

- `newtab.html`: **UI mockup** of what the user sees. Window scene with a continuous local-time sky, the question card, the plant's needs, settings and onboarding. All data is static (`src/newtab/mock.ts`); no engine is wired yet. A "Mockup controls" panel (review-only) changes time of day, plant age and health. URL params: `?hour=22&day=180&health=0.4&onboarding=1&settings=1`.
- `index.html`: **plant lab**, described below.

## Plant lab

```bash
npm install
npm run dev      # lab at /, mockup at /newtab.html
npm run build    # type-check + production build
```

- **Growth** (days of care): presets for start, 30 days, 3 months, 6 months and 1 year, or any day on the slider. "Play" runs day 0 → 365.
- **Health** (0–100%): presets for healthy, thirsty and wilted. "Neglect → recovery" animates a wilt and a recovery.
- **Compare all stages** shows the five stages side by side at the current health.
- URL params make any state linkable: `?days=90&health=0.5` or `?grid=1&health=0.1`.

The plant is fully procedural (`src/plant/ajisai.ts`): every visual is a function of `days` and `health`, with deterministic randomness so growth is continuous from one day to the next.
