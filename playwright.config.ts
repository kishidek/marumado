import { defineConfig } from '@playwright/test';

// E2E runs against the production build loaded as an unpacked extension (`npm run test:e2e`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  workers: 1,
  reporter: 'list',
});
