import { Request, Response, NextFunction } from 'express';
import { portfolioService } from '../services/portfolio.service';
import { AppError } from '../middleware/errorHandler';

export async function getPortfolioSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      throw new AppError(400, 'Invalid userId');
    }

    const portfolio = await portfolioService.getPortfolioSummaryByUser(userId);
    res.json(portfolio);
  } catch (error) {
    next(error);
  }
}
