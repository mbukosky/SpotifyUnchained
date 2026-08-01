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
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://www.google-analytics.com", "https://i.scdn.co", "https://cdn.ko-fi.com", "https://storage.ko-fi.com"],
      frameSrc: ["https://open.spotify.com"],
      connectSrc: [
        "'self'",
        "https://accounts.spotify.com",
        "https://api.spotify.com",
        "https://www.google-analytics.com",
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

// CORS — restrict to allowed origins
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Remember which unknown origins we've already logged so a scanner hammering the
// host produces one line, not one per request. Capped so it can't grow unbounded.
const loggedOrigins = new Set();
const LOGGED_ORIGINS_MAX = 100;

const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // Deny by withholding the CORS headers instead of throwing. An unknown Origin
    // is routine (bots, hotlinkers, extensions); throwing turned every one of them
    // into a 500 plus a stack trace, which buried real errors in the logs.
    if (loggedOrigins.size < LOGGED_ORIGINS_MAX && !loggedOrigins.has(origin)) {
      loggedOrigins.add(origin);
      console.warn(`CORS: rejected origin ${origin}`);
    }
    callback(null, false);
  },
});

// Scope CORS to the JSON API. Static assets and the SPA shell are same-origin and
// never need it, so a 404 on a static path no longer reaches this middleware.
app.use(['/api', '/spotify', '/rss'], corsMiddleware);

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
  app.get('*', (req, res, next) => {
    // Anything that looks like a file (/foo.js, /wp-admin/setup.php) missed the
    // static handler, so it genuinely does not exist — don't answer it with the
    // SPA shell and a 200.
    if (path.extname(req.path)) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, err.message);
  if (config.nodeEnv !== 'production') console.error(err.stack);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

export default app;
