import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 6677,
    strictPort: true,
  },
  preview: {
    port: 6677,
  },
});
