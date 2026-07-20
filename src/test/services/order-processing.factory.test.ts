import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../middleware/errorHandler';
import { OrderStatus, OrderType } from '../../enums';
import { orderProcessingFactory } from '../../services/orders/order-processing.factory';

test('resolveExecutionPrice returns last market price for MARKET', () => {
  const price = orderProcessingFactory.resolveExecutionPrice({
    type: OrderType.MARKET,
    lastMarketPrice: 123.45,
  });

  assert.equal(price, 123.45);
});

test('resolveExecutionPrice returns limit price for LIMIT', () => {
  const price = orderProcessingFactory.resolveExecutionPrice({
    type: OrderType.LIMIT,
    lastMarketPrice: null,
    limitPrice: 77,
  });

  assert.equal(price, 77);
});

test('resolveExecutionPrice returns 1 for CASH_IN and CASH_OUT', () => {
  const cashInPrice = orderProcessingFactory.resolveExecutionPrice({
    type: OrderType.CASH_IN,
    lastMarketPrice: null,
  });
  const cashOutPrice = orderProcessingFactory.resolveExecutionPrice({
    type: OrderType.CASH_OUT,
    lastMarketPrice: null,
  });

  assert.equal(cashInPrice, 1);
  assert.equal(cashOutPrice, 1);
});

test('resolveExecutionPrice throws when MARKET has no market price', () => {
  assert.throws(
    () =>
      orderProcessingFactory.resolveExecutionPrice({
        type: OrderType.MARKET,
        lastMarketPrice: null,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Market data not found for instrument');
      return true;
    }
  );
});

test('resolveAcceptedStatus maps MARKET to FILLED and LIMIT to NEW', () => {
  assert.equal(orderProcessingFactory.resolveAcceptedStatus(OrderType.MARKET), OrderStatus.FILLED);
  assert.equal(orderProcessingFactory.resolveAcceptedStatus(OrderType.LIMIT), OrderStatus.NEW);
});

test('resolveAcceptedStatus maps CASH_IN and CASH_OUT to FILLED', () => {
  assert.equal(orderProcessingFactory.resolveAcceptedStatus(OrderType.CASH_IN), OrderStatus.FILLED);
  assert.equal(orderProcessingFactory.resolveAcceptedStatus(OrderType.CASH_OUT), OrderStatus.FILLED);
});
