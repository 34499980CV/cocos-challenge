import assert from 'node:assert/strict';
import test from 'node:test';
import type { EntityManager } from 'typeorm';
import { AppError } from '../../middleware/errorHandler';
import { InstrumentType, OrderSide, OrderStatus, OrderType } from '../../enums';
import { Orders } from '../../entities/orders.entity';
import { OrdersService, OrdersServiceDependencies } from '../../services/orders.service';
import type { PortfolioServiceLike } from '../../services/portfolio.service';
import type { OrdersRecord } from '../../types';

type RepositoryLike = {
  findById(...args: any[]): Promise<any>;
  getCashInstrumentId(): Promise<number | null>;
  getAvailableCash(userId: number, cashInstrumentId: number): Promise<number>;
  getAvailableShares(userId: number, instrumentId: number): Promise<number>;
  getLastClosePrice(instrumentId: number): Promise<number>;
  insertOrder(_manager: EntityManager, order: Orders): Promise<Orders>;
  cancelIfNew(order: Orders): Promise<Orders | null>;
  list(userId: number): Promise<Orders[]>;
};

type UsersServiceLike = {
  ensureUserExists(userId: number, manager?: EntityManager): Promise<void>;
};

function createFakeRepository(options?: {
  instrumentType?: string | null;
  cashInstrumentId?: number | null;
  lastPrice?: number | null;
  availableCash?: number;
  availableShares?: number;
  failOnNthInsert?: number;
}): RepositoryLike & { insertCalls: Orders[] } {
  const insertCalls: Orders[] = [];
  let sequence = 1;

  return {
    insertCalls,
    async findById(...args: any[]): Promise<any> {
      const secondArg = args[1];

      if (typeof secondArg === 'object' && secondArg !== null) {
        if (options?.instrumentType == null) {
          return null;
        }

        return { id: 1, type: options.instrumentType };
      }

      if (typeof secondArg === 'number' || args.length >= 2) {
        const [orderId] = args;
        if (orderId !== 1) {
          return null;
        }

        return {
          id: 1,
          userid: 1,
          instrumentid: 10,
          side: OrderSide.BUY,
          type: OrderType.MARKET,
          status: OrderStatus.NEW,
          size: 1,
          price: 10,
          datetime: new Date('2024-01-01T00:00:00Z'),
        } as Orders;
      }

      return null;
    },
    async getCashInstrumentId(): Promise<number | null> {
      return options?.cashInstrumentId ?? 999;
    },
    async getAvailableCash(): Promise<number> {
      return options?.availableCash ?? 0;
    },
    async getAvailableShares(): Promise<number> {
      return options?.availableShares ?? 0;
    },
    async getLastClosePrice(): Promise<number> {
      return options?.lastPrice ?? 0;
    },
    async insertOrder(_manager: EntityManager, data: Orders): Promise<Orders> {
      insertCalls.push(data);
      if (options?.failOnNthInsert && insertCalls.length === options.failOnNthInsert) {
        throw new Error('insert failed');
      }

      return Object.assign(new Orders(), {
        id: sequence++,
        userid: data.userid,
        instrumentid: data.instrumentid,
        side: data.side,
        type: data.type,
        status: data.status,
        size: data.size,
        price: data.price,
        datetime: new Date('2024-01-01T00:00:00Z'),
      });
    },
    async cancelIfNew(order: Orders): Promise<Orders | null> {
      if (order.status !== OrderStatus.NEW) {
        return null;
      }

      return Object.assign(new Orders(), {
        id: order.id,
        userid: order.userid,
        instrumentid: order.instrumentid,
        side: order.side,
        type: order.type,
        status: OrderStatus.CANCELLED,
        size: order.size,
        price: order.price,
        datetime: order.datetime,
      });
    },
    async list(): Promise<Orders[]> {
      return [];
    },
  };
}

function createDependencies(
  repository: RepositoryLike,
  usersService: UsersServiceLike = {
    async ensureUserExists(): Promise<void> {},
  },
  portfolioService: PortfolioServiceLike = {
    async getPortfolioSummaryByUser() {
      return {
        totalAccountValue: 0,
        availableCash: 0,
        positions: [],
      };
    },
    async getAvailableCashByUser(): Promise<number> {
      return repository.getAvailableCash(1, 999);
    },
  }
): OrdersServiceDependencies {
  return {
    async getOrdersRepository(): Promise<RepositoryLike> {
      return repository;
    },
    async getInstrumentsRepository(): Promise<RepositoryLike> {
      return repository;
    },
    async getMarketDataRepository(): Promise<RepositoryLike> {
      return repository;
    },
    async getPortfolioService(): Promise<PortfolioServiceLike> {
      return portfolioService;
    },
    async getUsersService(): Promise<UsersServiceLike> {
      return usersService;
    },
    async runTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
      return fn({} as EntityManager);
    },
  };
}

test('createOrder throws 404 when user does not exist', async () => {
  const repository = createFakeRepository({ instrumentType: 'ACCION' });
  const service = new OrdersService(
    createDependencies(repository, {
      async ensureUserExists(): Promise<void> {
        throw new AppError(404, 'User not found');
      },
    })
  );

  await assert.rejects(
    () =>
      service.createOrder({
        userId: 1,
        instrumentId: 10,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'User not found');
      return true;
    }
  );
});

test('createOrder throws 404 when instrument does not exist', async () => {
  const repository = createFakeRepository({ instrumentType: null });
  const service = new OrdersService(createDependencies(repository));

  await assert.rejects(
    () =>
      service.createOrder({
        userId: 1,
        instrumentId: 10,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Instrument not found');
      return true;
    }
  );
});

test('createOrder fills BUY market order without creating CASH_OUT transfer', async () => {
  const repository = createFakeRepository({
    instrumentType: 'ACCION',
    cashInstrumentId: 999,
    lastPrice: 10,
    availableCash: 100,
  });
  const service = new OrdersService(createDependencies(repository));

  const order = await service.createOrder({
    userId: 1,
    instrumentId: 10,
    side: OrderSide.BUY,
    type: OrderType.MARKET,
    quantity: 2,
  });

  assert.equal(order.status, OrderStatus.FILLED);
  assert.equal(order.size, 2);
  assert.equal(repository.insertCalls.length, 1);
  assert.equal(repository.insertCalls[0].userid, 1);
  assert.equal(repository.insertCalls[0].instrumentid, 10);
  assert.equal(repository.insertCalls[0].side, OrderSide.BUY);
});

test('createOrder processes CASH_IN with MARKET type', async () => {
  const repository = createFakeRepository({
    instrumentType: InstrumentType.MONEDA,
    cashInstrumentId: 999,
  });
  const service = new OrdersService(createDependencies(repository));

  const order = await service.createOrder({
    userId: 1,
    instrumentId: 10,
    side: OrderSide.CASH_IN,
    type: OrderType.MARKET,
    amount: 50,
  });

  assert.equal(order.instrumentid, 999);
  assert.equal(order.side, OrderSide.CASH_IN);
  assert.equal(order.type, OrderType.MARKET);
  assert.equal(order.size, 50);
  assert.equal(order.status, OrderStatus.FILLED);
});

test('createOrder rejects CASH_OUT when amount is greater than available cash', async () => {
  const repository = createFakeRepository({
    instrumentType: InstrumentType.MONEDA,
    cashInstrumentId: 999,
    availableCash: 10,
  });
  const service = new OrdersService(createDependencies(repository));

  await assert.rejects(
    () =>
      service.createOrder({
        userId: 1,
        instrumentId: 10,
        side: OrderSide.CASH_OUT,
        type: OrderType.MARKET,
        amount: 20,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Insufficient cash for CASH_OUT');
      return true;
    }
  );
});

test('createOrder processes CASH_OUT with positive size', async () => {
  const repository = createFakeRepository({
    instrumentType: InstrumentType.MONEDA,
    cashInstrumentId: 999,
    availableCash: 100,
  });
  const service = new OrdersService(createDependencies(repository));

  const order = await service.createOrder({
    userId: 1,
    instrumentId: 10,
    side: OrderSide.CASH_OUT,
    type: OrderType.MARKET,
    amount: 20,
  });

  assert.equal(order.instrumentid, 999);
  assert.equal(order.side, OrderSide.CASH_OUT);
  assert.equal(order.type, OrderType.MARKET);
  assert.equal(order.size, 20);
  assert.equal(order.status, OrderStatus.FILLED);
});

test('createOrder rejects CASH_OUT when available cash is zero', async () => {
  const repository = createFakeRepository({
    instrumentType: InstrumentType.MONEDA,
    cashInstrumentId: 999,
    availableCash: 0,
  });
  const service = new OrdersService(createDependencies(repository));

  await assert.rejects(
    () =>
      service.createOrder({
        userId: 1,
        instrumentId: 10,
        side: OrderSide.CASH_OUT,
        type: OrderType.MARKET,
        amount: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Insufficient cash for CASH_OUT');
      return true;
    }
  );
});

test('createOrder rejects CASH_IN when instrument type is not MONEDA', async () => {
  const repository = createFakeRepository({
    instrumentType: 'ACCION',
    cashInstrumentId: 999,
  });
  const service = new OrdersService(createDependencies(repository));

  await assert.rejects(
    () =>
      service.createOrder({
        userId: 1,
        instrumentId: 10,
        side: OrderSide.CASH_IN,
        type: OrderType.MARKET,
        amount: 50,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, 'Cash operations require MONEDA instrument');
      return true;
    }
  );
});

test('createOrder accepts LIMIT SELL using amount', async () => {
  const repository = createFakeRepository({
    instrumentType: 'ACCION',
    lastPrice: 12000,
    availableShares: 10,
  });
  const service = new OrdersService(createDependencies(repository));

  const order = await service.createOrder({
    userId: 5,
    instrumentId: 2,
    side: OrderSide.SELL,
    type: OrderType.LIMIT,
    amount: 59000,
    price: 11800,
  });

  assert.equal(order.status, OrderStatus.NEW);
  assert.equal(order.size, -5);
  assert.equal(order.side, OrderSide.SELL);
  assert.equal(order.type, OrderType.LIMIT);
  assert.equal(order.price, 11800);
});

test('cancelOrder validates user existence before cancelling', async () => {
  const repository = createFakeRepository({ instrumentType: 'ACCION' });
  const service = new OrdersService(
    createDependencies(repository, {
      async ensureUserExists(): Promise<void> {
        throw new AppError(404, 'User not found');
      },
    })
  );

  await assert.rejects(() => service.cancelOrder(1, 1), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'User not found');
    return true;
  });
});

test('listOrdersByUser validates user existence before listing', async () => {
  const repository = createFakeRepository({ instrumentType: 'ACCION' });
  const service = new OrdersService(
    createDependencies(repository, {
      async ensureUserExists(): Promise<void> {
        throw new AppError(404, 'User not found');
      },
    })
  );

  await assert.rejects(() => service.listOrdersByUser(1), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'User not found');
    return true;
  });
});