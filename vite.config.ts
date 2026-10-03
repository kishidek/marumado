import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the plant lab (index.html) and the new-tab UI mockup (newtab.html).
export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        lab: resolve(import.meta.dirname, 'index.html'),
        newtab: resolve(import.meta.dirname, 'newtab.html'),
      },
    },
  },
});
