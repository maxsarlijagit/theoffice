import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      // Proxy HTTP endpoints to Express
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/stats': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy WebSocket connection to Express
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
