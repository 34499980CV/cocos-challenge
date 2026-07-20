import { Request, Response, NextFunction } from 'express';
import { instrumentsService } from '../services/instruments.service';
import { AppError } from '../middleware/errorHandler';
import { isNullOrEmpty } from '../helpers';

export async function listInstrumentsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = (req.query.q as string)?.trim();
    if (isNullOrEmpty(query)) {
      throw new AppError(400, 'Query parameter q is required');
    }

    const instruments = await instrumentsService.listInstruments(query);
    res.json(instruments);
  } catch (error) {
    next(error);
  }
}