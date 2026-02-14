import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exchangeToken, refreshToken } from '../controllers/spotify.js';

const router = Router();

// Stricter rate limit for token endpoints
const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many token requests, please try again later.' },
});

router.post('/api/spotify/token', tokenLimiter, exchangeToken);
router.post('/api/spotify/refresh', tokenLimiter, refreshToken);

export default router;
