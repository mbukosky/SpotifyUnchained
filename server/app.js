import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import playlistRoutes from './routes/playlist.js';
import spotifyRoutes from './routes/spotify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(compression());

// Helmet with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://js-agent.newrelic.com",
        "https://bam.nr-data.net",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://www.google-analytics.com", "https://i.scdn.co", "https://cdn.ko-fi.com"],
      frameSrc: ["https://open.spotify.com"],
      connectSrc: [
        "'self'",
        "https://accounts.spotify.com",
        "https://api.spotify.com",
        "https://www.google-analytics.com",
        "https://bam.nr-data.net",
      ],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Serve static files before CORS (same-origin requests don't need CORS)
if (config.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
}

// CORS — restrict to allowed origins (API routes only)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

app.use(express.json({ limit: '10kb' }));

// Global rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

app.use(playlistRoutes);
app.use(spotifyRoutes);

// SPA fallback — serve index.html for unmatched routes
if (config.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
