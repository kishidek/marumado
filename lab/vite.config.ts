import { defineConfig } from 'vite';

// The plant lab is a plain Vite page for tuning the ajisai. It is never part of the extension.
export default defineConfig({
  root: import.meta.dirname,
  server: { port: 5179 },
});
