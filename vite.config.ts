import { defineConfig } from 'vite';
import { resolve } from 'path';
import { devSavePlugin } from './scripts/vite-plugin-dev-save';

export default defineConfig({
  base: './',
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [devSavePlugin()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  resolve: {
    alias: {
      '@data': resolve(__dirname, 'data'),
    },
  },
});
