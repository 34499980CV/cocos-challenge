import { Request, Response, NextFunction } from 'express';
import { ordersService } from '../services/orders.service';

export async function createOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await ordersService.createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

export async function cancelOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await ordersService.cancelOrder(req.body?.userId, req.params.id);
    res.json(order);
  } catch (error) {
    next(error);
  }
}

export async function listOrdersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await ordersService.listOrdersByUser(req.params.userId);
    res.json(orders);
  } catch (error) {
    next(error);
  }
}
