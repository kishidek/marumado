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
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  projects: [
    { name: 'functional', testIgnore: /visual\/.*/ },
    { name: 'visual', testMatch: /visual\/.*\.spec\.ts/ },
  ],
});
