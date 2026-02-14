import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  return {
    plugins: [react()],
    root: '.',
    build: {
      outDir: 'dist',
    },
    server: {
      host: '127.0.0.1',
      port: 4200,
      proxy: {
        '/spotify': 'http://localhost:3000',
        '/api': 'http://localhost:3000',
      },
    },
    define: {
      'import.meta.env.VITE_SPOTIFY_CLIENT_ID': JSON.stringify(env.SPOTIFY_CLIENT_ID || ''),
    },
  };
});
