import { InstrumentModel } from '../models/instrument.model';
import type { InstrumentRow } from '../repositories/instruments.repository';
import type { InstrumentSearchResult } from '../types';

type InstrumentsRepositoryLike = {
  search(searchTerm: string): Promise<InstrumentRow[]>;
};

export interface InstrumentsServiceDependencies {
  getInstrumentsRepository(): Promise<InstrumentsRepositoryLike>;
}

const defaultDependencies: InstrumentsServiceDependencies = {
  async getInstrumentsRepository(): Promise<InstrumentsRepositoryLike> {
    const { InstrumentsRepository } = await import('../repositories/instruments.repository');
    return new InstrumentsRepository();
  },
};

export class InstrumentsService {
  constructor(private readonly dependencies: InstrumentsServiceDependencies = defaultDependencies) {}

  async listInstruments(query: string): Promise<InstrumentSearchResult[]> {
    const instrumentsRepository = await this.dependencies.getInstrumentsRepository();

    const rows = await instrumentsRepository.search(query);
    const instruments = rows.map((row) => InstrumentModel.toModel(row));

    return instruments;
  }
}

const service = new InstrumentsService();

export const instrumentsService = {
  listInstruments: (query: string): Promise<InstrumentSearchResult[]> => service.listInstruments(query),
};