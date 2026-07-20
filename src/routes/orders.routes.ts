import { Router } from 'express';
import {
  cancelOrderHandler,
  createOrderHandler,
  listOrdersHandler,
} from '../controllers/orders.controller';

const router = Router();

router.get('/user/:userId', listOrdersHandler);
router.post('/', createOrderHandler);
router.patch('/:id/cancel', cancelOrderHandler);

export default router;
