# Ajisai new tab — plant prototype

Standalone three.js prototype of the ajisai (紫陽花) plant, used to validate the growth × health concept before building the extension engines.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

- **Growth** (days of care): presets for start, 30 days, 3 months, 6 months and 1 year, or any day on the slider. "Play" runs day 0 → 365.
- **Health** (0–100%): presets for healthy, thirsty and wilted. "Neglect → recovery" animates a wilt and a recovery.
- **Compare all stages** shows the five stages side by side at the current health.
- URL params make any state linkable: `?days=90&health=0.5` or `?grid=1&health=0.1`.

The plant is fully procedural (`src/plant/ajisai.ts`): every visual is a function of `days` and `health`, with deterministic randomness so growth is continuous from one day to the next.
