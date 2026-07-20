import { Router } from 'express';
import { getPortfolioSummaryHandler } from '../controllers/portfolio.controller';

const router = Router();

router.get('/:userId', getPortfolioSummaryHandler);

export default router;
