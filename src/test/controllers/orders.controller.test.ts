import assert from 'node:assert/strict';
import test from 'node:test';
import { NextFunction, Request, Response } from 'express';
import {
  cancelOrderHandler,
  createOrderHandler,
  listOrdersHandler,
} from '../../controllers/orders.controller';
import { AppError } from '../../middleware/errorHandler';
import { OrderSide, OrderStatus, OrderType } from '../../enums';

const ordersModule = require('../../services/orders.service') as typeof import('../../services/orders.service');

function createMockResponse(): Response & { statusCode?: number; body?: unknown } {
  return {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as Response & { statusCode?: number; body?: unknown };
}

test('createOrderHandler forwards AppError for invalid payload', async () => {
  const req = {
    body: {
      userId: 1,
      instrumentId: 1,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
    },
  } as unknown as Request;
  const res = createMockResponse();
  let nextError: unknown;
  const next: NextFunction = (error?: unknown) => {
    nextError = error;
  };

  await createOrderHandler(req, res, next);

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 400);
  assert.match((nextError as AppError).message, /Must provide quantity or amount/);
});

test('createOrderHandler returns 201 and created order', async () => {
  const originalCreateOrder = ordersModule.ordersService.createOrder;
  const createdOrder = {
    id: 10,
    userid: 1,
    instrumentid: 2,
    side: OrderSide.BUY,
    type: OrderType.MARKET,
    status: OrderStatus.FILLED,
    size: 3,
    price: 15,
    datetime: new Date('2024-01-01T00:00:00Z'),
  };
  let receivedInput: unknown;

  ordersModule.ordersService.createOrder = async (input) => {
    receivedInput = input;
    return createdOrder;
  };

  try {
    const req = {
      body: {
        userId: 1,
        instrumentId: 2,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: 3,
      },
    } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = (error?: unknown) => {
      nextCalled = Boolean(error);
    };

    await createOrderHandler(req, res, next);

    assert.deepEqual(receivedInput, req.body);
    assert.equal(res.statusCode, 201);
    assert.equal(nextCalled, false);
    assert.deepEqual(res.body, createdOrder);
  } finally {
    ordersModule.ordersService.createOrder = originalCreateOrder;
  }
});

test('cancelOrderHandler forwards AppError for invalid params', async () => {
  const req = { params: { id: 'abc' }, body: { userId: '1' } } as unknown as Request;
  const res = createMockResponse();
  let nextError: unknown;
  const next: NextFunction = (error?: unknown) => {
    nextError = error;
  };

  await cancelOrderHandler(req, res, next);

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 400);
  assert.equal((nextError as AppError).message, 'Invalid orderId or userId');
});

test('cancelOrderHandler returns cancelled order', async () => {
  const originalCancelOrder = ordersModule.ordersService.cancelOrder;
  const cancelledOrder = {
    id: 10,
    userid: 1,
    instrumentid: 2,
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    status: OrderStatus.CANCELLED,
    size: 3,
    price: 15,
    datetime: new Date('2024-01-01T00:00:00Z'),
  };
  let receivedUserId: unknown;
  let receivedOrderId: unknown;

  ordersModule.ordersService.cancelOrder = async (userId: unknown, orderId: unknown) => {
    receivedUserId = userId;
    receivedOrderId = orderId;
    return cancelledOrder;
  };

  try {
    const req = { params: { id: '10' }, body: { userId: '1' } } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = (error?: unknown) => {
      nextCalled = Boolean(error);
    };

    await cancelOrderHandler(req, res, next);

    assert.equal(receivedUserId, '1');
    assert.equal(receivedOrderId, '10');
    assert.equal(nextCalled, false);
    assert.deepEqual(res.body, cancelledOrder);
  } finally {
    ordersModule.ordersService.cancelOrder = originalCancelOrder;
  }
});

test('listOrdersHandler forwards AppError for invalid userId', async () => {
  const req = { params: { userId: 'abc' } } as unknown as Request;
  const res = createMockResponse();
  let nextError: unknown;
  const next: NextFunction = (error?: unknown) => {
    nextError = error;
  };

  await listOrdersHandler(req, res, next);

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 400);
  assert.equal((nextError as AppError).message, 'Invalid userId');
});

test('listOrdersHandler returns orders from service', async () => {
  const originalListOrdersByUser = ordersModule.ordersService.listOrdersByUser;
  const orders = [
    {
      id: 10,
      userid: 1,
      instrumentid: 2,
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      status: OrderStatus.FILLED,
      size: 3,
      price: 15,
      datetime: new Date('2024-01-01T00:00:00Z'),
    },
  ];
  let receivedUserId: unknown;

  ordersModule.ordersService.listOrdersByUser = async (userId: unknown) => {
    receivedUserId = userId;
    return orders;
  };

  try {
    const req = { params: { userId: '1' } } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = (error?: unknown) => {
      nextCalled = Boolean(error);
    };

    await listOrdersHandler(req, res, next);

    assert.equal(receivedUserId, '1');
    assert.equal(nextCalled, false);
    assert.deepEqual(res.body, orders);
  } finally {
    ordersModule.ordersService.listOrdersByUser = originalListOrdersByUser;
  }
});