import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import app from '../../app';
import { AppError } from '../../middleware/errorHandler';
import { OrderSide, OrderStatus, OrderType } from '../../enums';

const ordersModule = require('../../services/orders.service') as typeof import('../../services/orders.service');

type CreatedOrderResponse = {
  id: number;
  userid: number;
  instrumentid: number;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  size: number;
  price: number | null;
};

type ErrorResponse = {
  error: string;
};

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test('POST /api/orders returns 201 with created order', async () => {
  const originalCreateOrder = ordersModule.ordersService.createOrder;

  ordersModule.ordersService.createOrder = async () => ({
    id: 101,
    userid: 5,
    instrumentid: 2,
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    status: OrderStatus.NEW,
    size: 5,
    price: 11800,
    datetime: new Date('2024-01-01T00:00:00Z'),
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: 5,
          instrumentId: 2,
          side: OrderSide.BUY,
          type: OrderType.LIMIT,
          quantity: 5,
          price: 11800,
        }),
      });

      assert.equal(response.status, 201);
      const payload = (await response.json()) as CreatedOrderResponse;
      assert.equal(payload.id, 101);
      assert.equal(payload.userid, 5);
      assert.equal(payload.instrumentid, 2);
      assert.equal(payload.side, OrderSide.BUY);
      assert.equal(payload.type, OrderType.LIMIT);
      assert.equal(payload.status, OrderStatus.NEW);
      assert.equal(payload.size, 5);
      assert.equal(payload.price, 11800);
    });
  } finally {
    ordersModule.ordersService.createOrder = originalCreateOrder;
  }
});

test('POST /api/orders returns 400 when service throws AppError', async () => {
  const originalCreateOrder = ordersModule.ordersService.createOrder;

  ordersModule.ordersService.createOrder = async () => {
    throw new AppError(400, 'Invalid order payload');
  };

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 400);
      const payload = (await response.json()) as ErrorResponse;
      assert.equal(payload.error, 'Invalid order payload');
    });
  } finally {
    ordersModule.ordersService.createOrder = originalCreateOrder;
  }
});
