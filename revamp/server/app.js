import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import playlistRoutes from './routes/playlist.js';
import spotifyRoutes from './routes/spotify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(compression());
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(playlistRoutes);
app.use(spotifyRoutes);

if (config.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
