import { Router } from 'express';
import { exchangeToken, refreshToken } from '../controllers/spotify.js';

const router = Router();

router.post('/api/spotify/token', exchangeToken);
router.post('/api/spotify/refresh', refreshToken);

export default router;
