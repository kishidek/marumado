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
    // Public key: pins the extension ID (libfkdleonljckjnpocjmkoccmafebmb) so an unpacked install
    // keeps its data when a new version is unzipped somewhere else (the ID would otherwise follow
    // the folder path). Safe to publish; the private key is never committed.
    // The Chrome Web Store rejects this field: strip it when building a store upload.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqv3gjlZ8dWR3WpnYzT/2SpEZYAd7lkLGgjLKN9xDJUknWNSIr/ZiLV5gctCOBMaN5qh9ic2hiizXN+YxemxCTvJ4eoIhjk00OH6KCkY90NlaRVT0Cc4xVtLsRryRGatS/FK3Dx1kJB5lKGIhcKwkaNpLBofNxwZqV5LcjQFBtYNK4sb0jXwSnzvCGcXUoHDEKfLCjRGDWRSbzxUjOi2Kq39OMPaqdxaVkCOPy3sZ6ev3upItxrk/dcdG8g6dkKuC5G3U5zbLn66O7XAnc0lwGwj8S2QoGzbvoCzQP4/UoUPRTOsVNHp3jv+IvNu/rLD3ED1+rb3XWqX+Iyt+ec74HwIDAQAB',
  },
});
