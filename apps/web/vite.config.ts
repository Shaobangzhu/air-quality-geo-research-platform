import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  envDir: '../..',
  // envPrefix matches prefixes, not exact names. Expose only the reviewed token,
  // so a similarly named server variable cannot accidentally enter the bundle.
  envPrefix: [],
  define: {
    'import.meta.env.VITE_ARCGIS_API_KEY': JSON.stringify(
      loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '')
        .VITE_ARCGIS_API_KEY ?? '',
    ),
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': process.env.AQ_API_PROXY_TARGET ?? 'http://127.0.0.1:3001',
    },
  },
}));
