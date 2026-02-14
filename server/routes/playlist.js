import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { list } from '../controllers/playlist.js';

const router = Router();

const playlistLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

router.get('/spotify', playlistLimiter, list);

export default router;
