import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../middleware/errorHandler';
import { PortfolioService } from '../../services/portfolio.service';

type PositionRow = {
  instrumentid: number;
  ticker: string;
  name: string;
  quantity: string;
};

type FilledOrderRow = {
  size: string;
  price: string;
};

type RepositoryLike = {
  getCashInstrumentId(): Promise<number | null>;
  getAvailableCash(userId: number, cashInstrumentId: number): Promise<number>;
  getOpenPositions(userId: number): Promise<Array<{ instrumentid: number; quantity: string }>>;
  findById(instrumentId: number): Promise<{ id: number; ticker: string; name: string } | null>;
  getLastClosePrice(instrumentId: number): Promise<number>;
  getFilledOrdersForInstrument(userId: number, instrumentId: number): Promise<FilledOrderRow[]>;
};

type UsersServiceLike = {
  ensureUserExists(userId: number): Promise<void>;
};

type PortfolioDependenciesLike = {
  getOrdersRepository(): Promise<RepositoryLike>;
  getInstrumentsRepository(): Promise<RepositoryLike>;
  getMarketDataRepository(): Promise<RepositoryLike>;
  getUsersService(): Promise<UsersServiceLike>;
};

function createFakeRepository(options: {
  cashInstrumentId: number | null;
  availableCash: number;
  positions: PositionRow[];
  closesByInstrumentId: Record<number, number>;
  filledOrdersByInstrumentId: Record<number, FilledOrderRow[]>;
}): RepositoryLike {
  const instrumentsById = Object.fromEntries(
    options.positions.map((position) => [position.instrumentid, { id: position.instrumentid, ticker: position.ticker, name: position.name }])
  );

  return {
    async getCashInstrumentId(): Promise<number | null> {
      return options.cashInstrumentId;
    },
    async getAvailableCash(): Promise<number> {
      return options.availableCash;
    },
    async getOpenPositions(): Promise<Array<{ instrumentid: number; quantity: string }>> {
      return options.positions.map((position) => ({
        instrumentid: position.instrumentid,
        quantity: position.quantity,
      }));
    },
    async findById(instrumentId: number): Promise<{ id: number; ticker: string; name: string } | null> {
      return instrumentsById[instrumentId] ?? null;
    },
    async getLastClosePrice(instrumentId: number): Promise<number> {
      return options.closesByInstrumentId[instrumentId] ?? 0;
    },
    async getFilledOrdersForInstrument(_userId: number, instrumentId: number): Promise<FilledOrderRow[]> {
      return options.filledOrdersByInstrumentId[instrumentId] ?? [];
    },
  };
}

function createDependencies(repository: RepositoryLike, usersService: UsersServiceLike = {
  async ensureUserExists(): Promise<void> {}
}): PortfolioDependenciesLike {
  return {
    async getOrdersRepository() {
      return repository;
    },
    async getInstrumentsRepository() {
      return repository;
    },
    async getMarketDataRepository() {
      return repository;
    },
    async getUsersService() {
      return usersService;
    },
  };
}

test('getPortfolioSummaryByUser throws when user does not exist', async () => {
  const repository = createFakeRepository({
    cashInstrumentId: 999,
    availableCash: 0,
    positions: [],
    closesByInstrumentId: {},
    filledOrdersByInstrumentId: {},
  });
  const service = new PortfolioService(
    createDependencies(repository, {
      async ensureUserExists(): Promise<void> {
        throw new AppError(404, 'User not found');
      },
    })
  );

  await assert.rejects(() => service.getPortfolioSummaryByUser(1), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'User not found');
    return true;
  });
});

test('getPortfolioSummaryByUser throws when cash instrument is missing', async () => {
  const repository = createFakeRepository({
    cashInstrumentId: null,
    availableCash: 0,
    positions: [],
    closesByInstrumentId: {},
    filledOrdersByInstrumentId: {},
  });
  const service = new PortfolioService(createDependencies(repository));

  await assert.rejects(() => service.getPortfolioSummaryByUser(1), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 500);
    assert.equal(error.message, 'Cash instrument (MONEDA) not found');
    return true;
  });
});

test('getPortfolioSummaryByUser calculates account totals', async () => {
  const repository = createFakeRepository({
    cashInstrumentId: 999,
    availableCash: 500,
    positions: [
      {
        instrumentid: 1,
        ticker: 'AAPL',
        name: 'Apple',
        quantity: '10',
      },
    ],
    closesByInstrumentId: {
      1: 120,
    },
    filledOrdersByInstrumentId: {
      1: [{ size: '10', price: '100' }],
    },
  });
  const service = new PortfolioService(createDependencies(repository));

  const summary = await service.getPortfolioSummaryByUser(42);

  assert.equal(summary.availableCash, 500);
  assert.equal(summary.totalAccountValue, 1700);
  assert.equal(summary.positions.length, 1);
  assert.equal(summary.positions[0].marketValue, 1200);
  assert.equal(summary.positions[0].totalReturnPct, 20);
});

test('getPortfolioSummaryByUser handles mixed buy/sell history', async () => {
  const repository = createFakeRepository({
    cashInstrumentId: 999,
    availableCash: 100,
    positions: [
      {
        instrumentid: 2,
        ticker: 'MSFT',
        name: 'Microsoft',
        quantity: '5',
      },
    ],
    closesByInstrumentId: {
      2: 90,
    },
    filledOrdersByInstrumentId: {
      2: [
        { size: '10', price: '100' },
        { size: '-5', price: '110' },
      ],
    },
  });
  const service = new PortfolioService(createDependencies(repository));

  const summary = await service.getPortfolioSummaryByUser(7);

  assert.equal(summary.availableCash, 100);
  assert.equal(summary.totalAccountValue, 550);
  assert.equal(summary.positions.length, 1);
  assert.equal(summary.positions[0].marketValue, 450);
  assert.equal(summary.positions[0].totalReturnPct, -10);
});