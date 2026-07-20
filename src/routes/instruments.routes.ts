import { Router } from 'express';
import { listInstrumentsHandler } from '../controllers/instruments.controller';

const router = Router();

router.get('/search', listInstrumentsHandler);

export default router;