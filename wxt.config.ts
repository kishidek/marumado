import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Marumado',
    description: 'A desk plant for your new tab: an ajisai that grows with your healthy work habits.',
    // Only storage: no host permissions, no network, nothing collected.
    permissions: ['storage'],
    // Newest platform features used: CSS color-mix() (111), inert (102), structuredClone (98).
    minimum_chrome_version: '111',
  },
});
