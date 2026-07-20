import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderSide, OrderType } from '../../../enums';
import { cashMovementOrderTypeFactory } from '../../../services/order-type.factory';

test('cashMovementOrderTypeFactory maps CASH_IN side to CASH_IN order type', () => {
  const type = cashMovementOrderTypeFactory.create(OrderSide.CASH_IN);
  assert.equal(type, OrderType.CASH_IN);
});

test('cashMovementOrderTypeFactory maps CASH_OUT side to CASH_OUT order type', () => {
  const type = cashMovementOrderTypeFactory.create(OrderSide.CASH_OUT);
  assert.equal(type, OrderType.CASH_OUT);
});
