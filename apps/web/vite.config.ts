import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  envPrefix: ['VITE_ARCGIS_API_KEY'],
  // Only VITE_* is eligible for the browser; server env stays in the root .env.
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.AQ_API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
    },
  },
});
