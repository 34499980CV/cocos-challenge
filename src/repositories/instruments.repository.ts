import { In, type EntityManager } from 'typeorm';
import { Instruments } from '../entities/instruments.entity';
import { InstrumentType } from '../enums';
import { BaseRepository } from './base.repository';

export type InstrumentRow = {
  id: number;
  ticker: string;
  name: string;
  type: string;
  close: string | null;
  previousclose: string | null;
};

export class InstrumentsRepository extends BaseRepository<Instruments> {
  constructor() {
    super(Instruments);
  }

  private getRepository(manager?: EntityManager) {
    return manager ? manager.getRepository(Instruments) : this.repository;
  }

  async getCashInstrumentId(manager?: EntityManager): Promise<number | null> {
    const instrument = await this.getRepository(manager).findOneBy({
      type: InstrumentType.MONEDA,
    });

    return instrument?.id ?? null;
  }

  async findById(instrumentId: number, manager?: EntityManager): Promise<Instruments | null> {
    return this.getRepository(manager).findOneBy({ id: instrumentId });
  }

  async findManyByIds(instrumentIds: number[], manager?: EntityManager): Promise<Instruments[]> {
    if (instrumentIds.length === 0) {
      return [];
    }

    return this.getRepository(manager).findBy({
      id: In(instrumentIds),
    });
  }

  async search(searchTerm: string): Promise<InstrumentRow[]> {
    const latestMarketDataSubQuery = this.repository
      .createQueryBuilder('i2')
      .subQuery()
      .select('MAX(md2.date)', 'max_date')
      .from('marketdata', 'md2')
      .where('md2.instrumentid = i.id')
      .getQuery();

    return this.build('i')
      .leftJoin(
        'marketdata',
        'md',
        `md.instrumentid = i.id AND md.date = (${latestMarketDataSubQuery})`
      )
      .select('i.id', 'id')
      .addSelect('i.ticker', 'ticker')
      .addSelect('i.name', 'name')
      .addSelect('i.type', 'type')
      .addSelect('md.close', 'close')
      .addSelect('md.previousclose', 'previousclose')
      .where('i.type <> :currency', { currency: InstrumentType.MONEDA })
      .andWhere('(i.ticker ILIKE :searchTerm OR i.name ILIKE :searchTerm)', {
        searchTerm: `%${searchTerm}%`,
      })
      .orderBy('i.ticker', 'ASC')
      .limit(50)
      .getRawMany<InstrumentRow>();
  }
}