import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 4200,
    proxy: {
      '/spotify': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    },
  },
  define: {
    'import.meta.env.VITE_SPOTIFY_CLIENT_ID': JSON.stringify(process.env.SPOTIFY_CLIENT_ID || ''),
  },
});
