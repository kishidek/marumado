import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Marumado',
    description: 'A desk plant for your new tab: an ajisai that grows with your healthy work habits.',
    // Only storage: no host permissions, no network, nothing collected.
    permissions: ['storage'],
  },
});
