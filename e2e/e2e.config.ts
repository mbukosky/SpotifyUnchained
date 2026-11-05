import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { claudeCode } from '@e2e-dev/acp';

export default {
  // Runs agent steps on the local Claude Code login. No API key needed.
  agents: { default: { executor: claudeCode({ model: 'haiku' }) } },
  targets: [
    {
      engine: web(),
      app: {
        // Not 3000, so a run can never attach to a dev server on another database.
        url: 'http://127.0.0.1:3100',
        readyUrl: 'http://127.0.0.1:3100/health',
        command: {
          executable: 'node',
          args: ['server/index.js'],
          cwd: '..',
          log: '.e2e/logs/app.log',
          env: {
            // Keeps dotenv away from the repo's .env, so nothing real can leak in.
            DOTENV_CONFIG_PATH: '/dev/null',
            NODE_ENV: 'production',
            PORT: '3100',
            DB_URI: 'mongodb://127.0.0.1:27018/spotifyunchained_e2e',
            SKIP_SPOTIFY_SYNC: 'true',
            SPOTIFY_CLIENT_ID: 'e2e-client-id',
            SPOTIFY_CLIENT_SECRET: 'e2e-client-secret',
            ALLOWED_ORIGINS: 'http://127.0.0.1:3100',
          },
        },
      },
    },
  ],
} satisfies E2EConfig;
