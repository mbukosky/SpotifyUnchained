import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { list } from '../controllers/playlist.js';
import { index as editionIndex, show as editionShow } from '../controllers/editions.js';
import { feed } from '../controllers/rss.js';

const router = Router();

const playlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Each opened tile is one edition request, so these get their own budget and
// can't exhaust the limit shared by /spotify and /rss.
const editionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

router.get('/spotify/editions', editionLimiter, editionIndex);
router.get('/spotify/editions/:id', editionLimiter, editionShow);
router.get('/spotify', playlistLimiter, list);
router.get('/rss', playlistLimiter, feed);

export default router;
