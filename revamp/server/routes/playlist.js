import { Router } from 'express';
import { list } from '../controllers/playlist.js';

const router = Router();

router.get('/spotify', list);

export default router;
