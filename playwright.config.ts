import { defineConfig } from '@playwright/test';

/**
 * Two suites on the real unpacked extension (plans/004-release-readiness.md):
 * - functional: production build (`npm run test:e2e`)
 * - visual: dev build with a frozen clock, screenshot baselines (`npm run test:visual`)
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  workers: 1,
  reporter: 'list',
  // Rendering is pixel-deterministic (0 px drift over 2 runs, 2026-10-05). A 1 % ratio let a moved
  // lantern pass unnoticed (bug #29), so the margin is a fixed, tiny pixel count.
  expect: { toHaveScreenshot: { maxDiffPixels: 50, animations: 'disabled' } },
  projects: [
    { name: 'functional', testIgnore: /(visual|clips)\/.*/ },
    { name: 'visual', testMatch: /visual\/.*\.spec\.ts/ },
    // Not tests: renders the help modal's clips (`npm run render:help`).
    { name: 'clips', testMatch: /clips\/.*\.spec\.ts/, timeout: 600_000 },
  ],
});
