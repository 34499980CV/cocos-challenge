import type { EntityManager } from 'typeorm';
import { MarketData } from '../entities/market-data.entity';
import { BaseRepository } from './base.repository';

export type MarketDataRow = {
  close: string | null;
  previousclose: string | null;
};

export class MarketDataRepository extends BaseRepository<MarketData> {
  constructor() {
    super(MarketData);
  }

  private getRepository(manager?: EntityManager) {
    return manager ? manager.getRepository(MarketData) : this.repository;
  }

  async getLastClosePrice(instrumentId: number, manager?: EntityManager): Promise<number> {
    const priceResult = await this.getRepository(manager)
      .createQueryBuilder('md')
      .select('md.close', 'close')
      .where('md.instrumentid = :instrumentId', { instrumentId })
      .orderBy('md.date', 'DESC')
      .limit(1)
      .getRawOne<{ close: string }>();

    return parseFloat(priceResult?.close ?? '0');
  }

  async getLastQuote(instrumentId: number, manager?: EntityManager): Promise<MarketDataRow | null> {
    const quoteResult = await this.getRepository(manager)
      .createQueryBuilder('md')
      .select('md.close', 'close')
      .addSelect('md.previousclose', 'previousclose')
      .where('md.instrumentid = :instrumentId', { instrumentId })
      .orderBy('md.date', 'DESC')
      .limit(1)
      .getRawOne<MarketDataRow>();

    return quoteResult ?? null;
  }
}