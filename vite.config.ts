import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GatherReady web build.
 *
 * - `npm run dev:web` runs Vite on 5181 and proxies `/api` to the Fastify server (5180).
 * - `npm run build` emits `dist/web`; the Fastify server serves it when present.
 * - The UI never holds secrets. When PayPal sandbox keys are absent the server answers
 *   in `simulated` mode and every money response carries `simulated: true`, which the
 *   UI must render as "Simulated PayPal — no real money".
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5181,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5180', changeOrigin: true },
      '/return': { target: 'http://127.0.0.1:5180', changeOrigin: true },
      '/cancel': { target: 'http://127.0.0.1:5180', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    sourcemap: true,
  },
});
