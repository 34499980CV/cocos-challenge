import type { EntityManager } from 'typeorm';
import { AppError } from '../../middleware/errorHandler';
import { OrderSide } from '../../enums';
import type { OrdersRecord } from '../../types';

export type CashSide = OrderSide.CASH_IN | OrderSide.CASH_OUT;

type ExecuteInput = {
  manager: EntityManager;
  userId: number;
  amount: number;
};

type ExecuteDependencies = {
  getCashInstrumentId(manager: EntityManager): Promise<number | null>;
  getAvailableCash(userId: number, cashInstrumentId: number, manager: EntityManager): Promise<number>;
  createCashOrder(input: {
    manager: EntityManager;
    userId: number;
    cashInstrumentId: number;
    side: CashSide;
    amount: number;
  }): Promise<OrdersRecord>;
};

export interface CashOperationStrategy {
  execute(input: ExecuteInput, dependencies: ExecuteDependencies): Promise<OrdersRecord>;
}

class CashInStrategy implements CashOperationStrategy {
  async execute(input: ExecuteInput, dependencies: ExecuteDependencies): Promise<OrdersRecord> {
    const cashInstrumentId = await dependencies.getCashInstrumentId(input.manager);
    if (!cashInstrumentId) {
      throw new AppError(500, 'Cash instrument (MONEDA) not found');
    }

    return dependencies.createCashOrder({
      manager: input.manager,
      userId: input.userId,
      cashInstrumentId,
      side: OrderSide.CASH_IN,
      amount: input.amount,
    });
  }
}

class CashOutStrategy implements CashOperationStrategy {
  async execute(input: ExecuteInput, dependencies: ExecuteDependencies): Promise<OrdersRecord> {
    const cashInstrumentId = await dependencies.getCashInstrumentId(input.manager);
    if (!cashInstrumentId) {
      throw new AppError(500, 'Cash instrument (MONEDA) not found');
    }

    const availableCash = await dependencies.getAvailableCash(input.userId, cashInstrumentId, input.manager);
    if (input.amount > availableCash) {
      throw new AppError(400, 'Insufficient cash for CASH_OUT');
    }

    return dependencies.createCashOrder({
      manager: input.manager,
      userId: input.userId,
      cashInstrumentId,
      side: OrderSide.CASH_OUT,
      amount: input.amount,
    });
  }
}

const strategyBySide: Record<CashSide, CashOperationStrategy> = {
  [OrderSide.CASH_IN]: new CashInStrategy(),
  [OrderSide.CASH_OUT]: new CashOutStrategy(),
};

export function resolveCashOperationStrategy(side: CashSide): CashOperationStrategy {
  return strategyBySide[side];
}
