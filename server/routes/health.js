import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { check } from '../controllers/health.js';

const router = Router();

// Each request pings the database, so cap it. Uptime monitors poll every few
// minutes and Railway only probes during deploys, so this is far above real use.
const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'rate_limited' },
});

router.get('/health', healthLimiter, check);

export default router;
