import 'reflect-metadata';
import { AppError } from '../middleware/errorHandler';
import { PortfolioModel, PositionModel } from '../models';
import type { EntityManager } from 'typeorm';
import type { PortfolioResponse } from '../types';
import type { UsersServiceLike } from './users.service';

type OpenPositionRow = {
  instrumentid: number;
  quantity: string;
};

type PortfolioOrdersRepository = {
  getAvailableCash(userId: number, cashInstrumentId: number, manager?: EntityManager): Promise<number>;
  getOpenPositions(userId: number, manager?: EntityManager): Promise<OpenPositionRow[]>;
  getFilledOrdersForInstrument(
    userId: number,
    instrumentId: number,
    manager?: EntityManager
  ): Promise<Array<{ size: string; price: string }>>;
};

type PortfolioInstrumentsRepository = {
  getCashInstrumentId(manager?: EntityManager): Promise<number | null>;
  findById(
    instrumentId: number,
    manager?: EntityManager
  ): Promise<{ id: number; ticker: string; name: string } | null>;
};

type PortfolioMarketDataRepository = {
  getLastClosePrice(instrumentId: number, manager?: EntityManager): Promise<number>;
};

type PortfolioServiceDependencies = {
  getOrdersRepository(): Promise<PortfolioOrdersRepository>;
  getInstrumentsRepository(): Promise<PortfolioInstrumentsRepository>;
  getMarketDataRepository(): Promise<PortfolioMarketDataRepository>;
  getUsersService(): Promise<UsersServiceLike>;
};

export type PortfolioServiceLike = {
  getPortfolioSummaryByUser(userId: number): Promise<PortfolioResponse>;
  getAvailableCashByUser(userId: number, manager?: EntityManager): Promise<number>;
};

const defaultDependencies: PortfolioServiceDependencies = {
  async getOrdersRepository() {
    const { OrdersRepository } = await import('../repositories/orders.repository');
    return new OrdersRepository();
  },
  async getInstrumentsRepository() {
    const { InstrumentsRepository } = await import('../repositories/instruments.repository');
    return new InstrumentsRepository();
  },
  async getMarketDataRepository() {
    const { MarketDataRepository } = await import('../repositories/market-data.repository');
    return new MarketDataRepository();
  },
  async getUsersService(): Promise<UsersServiceLike> {
    const { usersService } = await import('./users.service');
    return usersService;
  },
};

export class PortfolioService {
  constructor(private readonly dependencies: PortfolioServiceDependencies = defaultDependencies) {}

  async getAvailableCashByUser(userId: number, manager?: EntityManager): Promise<number> {
    const ordersRepository = await this.dependencies.getOrdersRepository();
    const instrumentsRepository = await this.dependencies.getInstrumentsRepository();

    const cashInstrumentId = await instrumentsRepository.getCashInstrumentId(manager);
    if (!cashInstrumentId) {
      throw new AppError(500, 'Cash instrument (MONEDA) not found');
    }

    return ordersRepository.getAvailableCash(userId, cashInstrumentId, manager);
  }

  async getPortfolioSummaryByUser(userId: number): Promise<PortfolioResponse> {
    const ordersRepository = await this.dependencies.getOrdersRepository();
    const instrumentsRepository = await this.dependencies.getInstrumentsRepository();
    const marketDataRepository = await this.dependencies.getMarketDataRepository();
    const usersService = await this.dependencies.getUsersService();

    await usersService.ensureUserExists(userId);

    const availableCash = await this.getAvailableCashByUser(userId);
    const positionsResult = await ordersRepository.getOpenPositions(userId);

    const round = (value: number): number => Math.round(value * 100) / 100;

    const positions: PositionModel[] = [];
    let totalPositionsValue = 0;

    for (const row of positionsResult) {
      const quantity = parseFloat(row.quantity);
      const instrument = await instrumentsRepository.findById(row.instrumentid);
      if (!instrument) {
        continue;
      }

      const close = await marketDataRepository.getLastClosePrice(row.instrumentid);
      const marketValue = quantity * close;
      totalPositionsValue += marketValue;

      const filledOrders = await ordersRepository.getFilledOrdersForInstrument(userId, row.instrumentid);

      let totalCost = 0;
      let totalQty = 0;

      for (const order of filledOrders) {
        const size = parseFloat(order.size);
        const price = parseFloat(order.price);

        if (size > 0) {
          totalCost += size * price;
          totalQty += size;
        } else {
          const avgCost = totalQty > 0 ? totalCost / totalQty : 0;
          totalCost += size * avgCost;
          totalQty += size;
        }
      }

      const avgCost = totalQty > 0 ? totalCost / totalQty : close;
      const totalReturnPct = avgCost > 0 ? ((close - avgCost) / avgCost) * 100 : 0;

      positions.push(
        PositionModel.toModel({
          instrumentId: instrument.id,
          ticker: instrument.ticker,
          name: instrument.name,
          quantity,
          marketValue: round(marketValue),
          totalReturnPct: round(totalReturnPct),
        })
      );
    }

    return new PortfolioModel(round(availableCash + totalPositionsValue), round(availableCash), positions);
  }
}

const service = new PortfolioService();

export const portfolioService: PortfolioServiceLike = {
  getPortfolioSummaryByUser: (userId: number): Promise<PortfolioResponse> =>
    service.getPortfolioSummaryByUser(userId),
  getAvailableCashByUser: (userId: number, manager?: EntityManager): Promise<number> =>
    service.getAvailableCashByUser(userId, manager),
};
