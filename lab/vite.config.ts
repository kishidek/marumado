import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The plant lab is a plain Vite page for tuning the ajisai. It is never part of the extension.
// Root is the project so the page can import from src/; open /lab/index.html.
export default defineConfig({
  root: resolve(import.meta.dirname, '..'),
  server: { port: 5179, open: '/lab/index.html' },
  build: { rolldownOptions: { input: resolve(import.meta.dirname, 'index.html') } },
});
