import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.js'],
    env: {
      DB_URI: 'mongodb://localhost:27017/test',
      SPOTIFY_CLIENT_ID: 'test-client-id',
      SPOTIFY_CLIENT_SECRET: 'test-client-secret',
    },
  },
});
