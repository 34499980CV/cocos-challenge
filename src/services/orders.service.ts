import 'reflect-metadata';
import type { EntityManager } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import { Orders } from '../entities/orders.entity';
import { InstrumentType, OrderSide, OrderStatus, OrderType } from '../enums';
import { OrdersModel } from '../models';
import type {
  CreateOrdersInput,
  OrdersRecord,
  OrdersStatus,
} from '../types';
import {
  defaultInstrumentTypeStrategy,
  defaultOrderTypeStrategy,
  instrumentTypeStrategies,
  orderTypeStrategies,
} from './orders/validation-strategies';
import { orderProcessingFactory } from './orders/order-processing.factory';
import { resolveCashOperationStrategy } from './orders/cash-operation-strategies';
import type { PortfolioServiceLike } from './portfolio.service';
import type { UsersServiceLike } from './users.service';

type OrdersRepositoryLike = {
  getAvailableCash(userId: number, cashInstrumentId: number, manager?: EntityManager): Promise<number>;
  getAvailableShares(userId: number, instrumentId: number, manager?: EntityManager): Promise<number>;
  findById(orderId: number, userId: number, manager?: EntityManager): Promise<Orders | null>;
  insertOrder(manager: EntityManager, order: Orders): Promise<Orders>;
  cancelIfNew(order: Orders, manager?: EntityManager): Promise<Orders | null>;
  list(userId: number, manager?: EntityManager): Promise<Orders[]>;
};

type InstrumentsRepositoryLike = {
  findById(instrumentId: number, manager?: EntityManager): Promise<{ id: number; type: string } | null>;
  getCashInstrumentId(manager?: EntityManager): Promise<number | null>;
};

type MarketDataRepositoryLike = {
  getLastClosePrice(instrumentId: number, manager?: EntityManager): Promise<number>;
};

export interface OrdersServiceDependencies {
  getOrdersRepository(): Promise<OrdersRepositoryLike>;
  getInstrumentsRepository(): Promise<InstrumentsRepositoryLike>;
  getMarketDataRepository(): Promise<MarketDataRepositoryLike>;
  getPortfolioService(): Promise<PortfolioServiceLike>;
  getUsersService(): Promise<UsersServiceLike>;
  runTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T>;
}

const defaultDependencies: OrdersServiceDependencies = {
  async getOrdersRepository(): Promise<OrdersRepositoryLike> {
    const { OrdersRepository } = await import('../repositories/orders.repository');
    return new OrdersRepository();
  },
  async getInstrumentsRepository(): Promise<InstrumentsRepositoryLike> {
    const { InstrumentsRepository } = await import('../repositories/instruments.repository');
    return new InstrumentsRepository();
  },
  async getMarketDataRepository(): Promise<MarketDataRepositoryLike> {
    const { MarketDataRepository } = await import('../repositories/market-data.repository');
    return new MarketDataRepository();
  },
  async getPortfolioService(): Promise<PortfolioServiceLike> {
    const { portfolioService } = await import('./portfolio.service');
    return portfolioService;
  },
  async getUsersService(): Promise<UsersServiceLike> {
    const { usersService } = await import('./users.service');
    return usersService;
  },
  async runTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const { AppDataSource } = await import('../config/data-source');
    return AppDataSource.transaction(fn);
  },
};

export class OrdersService {
  constructor(private readonly dependencies: OrdersServiceDependencies = defaultDependencies) {}

  private parseCreateOrderInput(input: unknown): CreateOrdersInput {
    if (typeof input !== 'object' || input === null) {
      throw new AppError(400, 'Invalid create order payload');
    }

    const data = input as Record<string, unknown>;
    const userId = this.parsePositiveInt(data.userId, 'Invalid userId');
    const instrumentId = this.parsePositiveInt(data.instrumentId, 'Invalid instrumentId');
    const side = this.parseOrderSide(data.side);
    const type = this.parseOrderType(data.type);
    const quantity = this.parsePositiveNumberOptional(data.quantity, 'Invalid quantity');
    const amount = this.parsePositiveNumberOptional(data.amount, 'Invalid amount');
    const price = this.parsePositiveNumberOptional(data.price, 'Invalid price');

    if (quantity == null && amount == null) {
      throw new AppError(400, 'Must provide quantity or amount');
    }

    return {
      userId,
      instrumentId,
      side,
      type,
      quantity,
      amount,
      price,
    };
  }

  private parsePositiveInt(value: unknown, errorMessage: string): number {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new AppError(400, errorMessage);
    }
    return parsed;
  }

  private parsePositiveNumberOptional(value: unknown, errorMessage: string): number | undefined {
    if (value == null) {
      return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError(400, errorMessage);
    }

    return parsed;
  }

  private parseOrderSide(value: unknown): OrderSide {
    if (typeof value !== 'string') {
      throw new AppError(400, 'Invalid side');
    }

    if (!Object.values(OrderSide).includes(value as OrderSide)) {
      throw new AppError(400, 'Invalid side');
    }

    return value as OrderSide;
  }

  private parseOrderType(value: unknown): OrderType {
    if (typeof value !== 'string') {
      throw new AppError(400, 'Invalid type');
    }

    if (!Object.values(OrderType).includes(value as OrderType)) {
      throw new AppError(400, 'Invalid type');
    }

    return value as OrderType;
  }

  private isCashOperation(side: OrderSide): side is OrderSide.CASH_IN | OrderSide.CASH_OUT {
    return side === OrderSide.CASH_IN || side === OrderSide.CASH_OUT;
  }

  private ensureTradableInstrumentType(type: string): void {
    const strategy = instrumentTypeStrategies[type] ?? defaultInstrumentTypeStrategy;
    strategy.validate();
  }

  private ensureValidOrderType(input: CreateOrdersInput): void {
    const strategy = orderTypeStrategies[input.type] ?? defaultOrderTypeStrategy;
    strategy.validate(input);
  }

  private toEntity(input: {
    userId: number;
    instrumentId: number;
    side: OrderSide;
    type: OrderType;
    size: number;
    price: number | null;
    status: OrdersStatus;
  }): Orders {
    return Object.assign(new Orders(), {
      userid: input.userId,
      instrumentid: input.instrumentId,
      side: input.side,
      type: input.type,
      status: input.status,
      size: input.size,
      price: input.price,
      datetime: new Date(),
    });
  }

  private toModel(order: Orders): OrdersRecord {
    return new OrdersModel(
      order.id,
      order.userid,
      order.instrumentid,
      order.side,
      order.type,
      order.status,
      order.size,
      order.price,
      order.datetime
    );
  }

  private async insertCashOrder(input: {
    manager: EntityManager;
    ordersRepository: OrdersRepositoryLike;
    userId: number;
    cashInstrumentId: number;
    side: OrderSide.CASH_IN | OrderSide.CASH_OUT;
    amount: number;
  }): Promise<OrdersRecord> {
    const { manager, ordersRepository, userId, cashInstrumentId, side, amount } = input;

    const size = amount;
    const order = await ordersRepository.insertOrder(
      manager,
      this.toEntity({
        userId,
        instrumentId: cashInstrumentId,
        side,
        type: OrderType.MARKET,
        size,
        price: 1,
        status: OrderStatus.FILLED,
      })
    );

    return this.toModel(order);
  }

  private async createCashOperation(
    manager: EntityManager,
    ordersRepository: OrdersRepositoryLike,
    instrumentsRepository: InstrumentsRepositoryLike,
    input: CreateOrdersInput
  ): Promise<OrdersRecord> {
    const { userId, instrumentId, type, side } = input;

    if (!this.isCashOperation(side)) {
      throw new AppError(400, 'Invalid cash operation side');
    }

    if (type !== OrderType.MARKET) {
      throw new AppError(400, 'Cash operations must use MARKET type');
    }

    const instrument = await instrumentsRepository.findById(instrumentId, manager);
    if (!instrument) {
      throw new AppError(404, 'Instrument not found');
    }

    if (instrument.type !== InstrumentType.MONEDA) {
      throw new AppError(400, 'Cash operations require MONEDA instrument');
    }

    const amount = input.amount ?? input.quantity;
    if (amount == null || amount <= 0) {
      throw new AppError(400, 'Must provide quantity or amount');
    }

    const strategy = resolveCashOperationStrategy(side);
    return strategy.execute(
      {
        manager,
        userId,
        amount,
      },
      {
        getCashInstrumentId: (txManager: EntityManager) => instrumentsRepository.getCashInstrumentId(txManager),
        getAvailableCash: (txUserId: number, cashInstrumentId: number, txManager: EntityManager) =>
          ordersRepository.getAvailableCash(txUserId, cashInstrumentId, txManager),
        createCashOrder: ({
          manager: txManager,
          userId: txUserId,
          cashInstrumentId,
          side: txSide,
          amount: txAmount,
        }) =>
          this.insertCashOrder({
            manager: txManager,
            ordersRepository,
            userId: txUserId,
            cashInstrumentId,
            side: txSide,
            amount: txAmount,
          }),
      }
    );
  }

  private async ensureInstrumentCanBeTraded(
    instrumentsRepository: InstrumentsRepositoryLike,
    instrumentId: number,
    manager: EntityManager
  ): Promise<void> {
    const instrument = await instrumentsRepository.findById(instrumentId, manager);
    if (!instrument) {
      throw new AppError(404, 'Instrument not found');
    }

    this.ensureTradableInstrumentType(instrument.type);
  }

  private resolveOrderQuantity(input: CreateOrdersInput, executionPrice: number): number {
    const { quantity, amount } = input;

    if (quantity != null) {
      return Math.floor(quantity);
    }

    if (amount != null) {
      return Math.floor(amount / executionPrice);
    }

    throw new AppError(400, 'Must provide quantity or amount');
  }

  private async resolveStatusAndApplyCashEffects(params: {
    manager: EntityManager;
    portfolioService: PortfolioServiceLike;
    ordersRepository: OrdersRepositoryLike;
    userId: number;
    instrumentId: number;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    requiredAmount: number;
  }): Promise<OrdersStatus> {
    const {
      manager,
      portfolioService,
      ordersRepository,
      userId,
      instrumentId,
      side,
      type,
      quantity,
      requiredAmount,
    } = params;

    const acceptedStatus = orderProcessingFactory.resolveAcceptedStatus(type);

    if (side === OrderSide.BUY) {
      const availableCash = await portfolioService.getAvailableCashByUser(userId, manager);
      return requiredAmount > availableCash ? OrderStatus.REJECTED : acceptedStatus;
    }

    const availableShares = await ordersRepository.getAvailableShares(userId, instrumentId, manager);
    return quantity > availableShares ? OrderStatus.REJECTED : acceptedStatus;
  }

  private async persistTradeOrder(params: {
    manager: EntityManager;
    ordersRepository: OrdersRepositoryLike;
    userId: number;
    instrumentId: number;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    executionPrice: number;
    status: OrdersStatus;
  }): Promise<OrdersRecord> {
    const {
      manager,
      ordersRepository,
      userId,
      instrumentId,
      side,
      type,
      quantity,
      executionPrice,
      status,
    } = params;

    const size = side === OrderSide.BUY ? quantity : -quantity;
    const order = await ordersRepository.insertOrder(
      manager,
      this.toEntity({
        userId,
        instrumentId,
        side,
        type,
        size: status === OrderStatus.REJECTED ? 0 : size,
        price: executionPrice,
        status,
      })
    );

    return this.toModel(order);
  }

  private async createInstrumentOrder(params: {
    manager: EntityManager;
    portfolioService: PortfolioServiceLike;
    ordersRepository: OrdersRepositoryLike;
    instrumentsRepository: InstrumentsRepositoryLike;
    marketDataRepository: MarketDataRepositoryLike;
    input: CreateOrdersInput;
  }): Promise<OrdersRecord> {
    const {
      manager,
      portfolioService,
      ordersRepository,
      instrumentsRepository,
      marketDataRepository,
      input,
    } = params;
    const { userId, instrumentId, side, type } = input;

    await this.ensureInstrumentCanBeTraded(instrumentsRepository, instrumentId, manager);
    this.ensureValidOrderType(input);

    const lastPrice = await marketDataRepository.getLastClosePrice(instrumentId, manager);
    const executionPrice = orderProcessingFactory.resolveExecutionPrice({
      type,
      lastMarketPrice: lastPrice,
      limitPrice: input.price,
    });

    const quantity = this.resolveOrderQuantity(input, executionPrice);
    if (quantity <= 0) {
      const order = await ordersRepository.insertOrder(
        manager,
        this.toEntity({
          userId,
          instrumentId,
          side,
          type,
          size: 0,
          price: executionPrice,
          status: OrderStatus.REJECTED,
        })
      );

      return this.toModel(order);
    }

    const requiredAmount = quantity * executionPrice;
    const status = await this.resolveStatusAndApplyCashEffects({
      manager,
      portfolioService,
      ordersRepository,
      userId,
      instrumentId,
      side,
      type,
      quantity,
      requiredAmount,
    });

    return this.persistTradeOrder({
      manager,
      ordersRepository,
      userId,
      instrumentId,
      side,
      type,
      quantity,
      executionPrice,
      status,
    });
  }

  async createOrder(input: unknown): Promise<OrdersRecord> {
    const parsedInput = this.parseCreateOrderInput(input);
    const ordersRepository = await this.dependencies.getOrdersRepository();
    const instrumentsRepository = await this.dependencies.getInstrumentsRepository();
    const marketDataRepository = await this.dependencies.getMarketDataRepository();
    const portfolioService = await this.dependencies.getPortfolioService();
    const usersService = await this.dependencies.getUsersService();
    const { userId, instrumentId, side, type } = parsedInput;

    return this.dependencies.runTransaction(async (manager) => {
      await usersService.ensureUserExists(userId, manager);

      if (this.isCashOperation(side)) {
        return this.createCashOperation(manager, ordersRepository, instrumentsRepository, parsedInput);
      }

      return this.createInstrumentOrder({
        manager,
        portfolioService,
        ordersRepository,
        instrumentsRepository,
        marketDataRepository,
        input: parsedInput,
      });
    });
  }

  async cancelOrder(userIdInput: unknown, orderIdInput: unknown): Promise<OrdersRecord> {
    const userId = this.parsePositiveInt(userIdInput, 'Invalid orderId or userId');
    const orderId = this.parsePositiveInt(orderIdInput, 'Invalid orderId or userId');
    const repository = await this.dependencies.getOrdersRepository();
    const usersService = await this.dependencies.getUsersService();

    await usersService.ensureUserExists(userId);

    const order = await repository.findById(orderId, userId);
    if (!order) {
      throw new AppError(404, 'Order not found or cannot be cancelled');
    }

    const cancelledOrder = await repository.cancelIfNew(order);
    if (!cancelledOrder) {
      throw new AppError(404, 'Order not found or cannot be cancelled');
    }

    return this.toModel(cancelledOrder);
  }

  async listOrdersByUser(userIdInput: unknown): Promise<OrdersRecord[]> {
    const userId = this.parsePositiveInt(userIdInput, 'Invalid userId');
    const repository = await this.dependencies.getOrdersRepository();
    const usersService = await this.dependencies.getUsersService();

    await usersService.ensureUserExists(userId);

    const orders = await repository.list(userId);
    return orders.map((order) => this.toModel(order));
  }
}

const service = new OrdersService();

export const ordersService = {
  createOrder: (input: unknown): Promise<OrdersRecord> => service.createOrder(input),
  cancelOrder: (userId: unknown, orderId: unknown): Promise<OrdersRecord> => service.cancelOrder(userId, orderId),
  listOrdersByUser: (userId: unknown): Promise<OrdersRecord[]> => service.listOrdersByUser(userId),
};
