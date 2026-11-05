import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import solid from 'vite-plugin-solid';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react({ exclude: /imageview\/solid/ }), solid({ include: /imageview\/solid\/.*\.jsx$/ }), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    // Disable HMR and file watching when requested by the host environment.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
}));
