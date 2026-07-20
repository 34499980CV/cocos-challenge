import {
  DeepPartial,
  DeleteResult,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm';
import { AppDataSource } from '../config/data-source';

export abstract class BaseRepository<T extends ObjectLiteral> {
  protected readonly repository: Repository<T>;

  protected constructor(entity: EntityTarget<T>) {
    this.repository = AppDataSource.getRepository(entity);
  }

  protected async getAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  protected async getOne(options?: FindOneOptions<T>): Promise<T | null> {
    const resolvedOptions: FindOneOptions<T> = options ?? ({} as FindOneOptions<T>);
    return this.repository.findOne(resolvedOptions);
  }

  protected async getBy(where: Record<string, unknown>): Promise<T | null> {
    return this.repository.findOneBy(where as any);
  }

  protected async getById(id: number): Promise<T | null> {
    return this.repository.findOneBy({ id } as any);
  }

  protected createEntity(partial: DeepPartial<T>): T {
    return this.repository.create(partial);
  }

  protected async saveEntity(entity: DeepPartial<T>): Promise<T> {
    return this.repository.save(entity as any);
  }

  protected async updateEntity(id: number, partial: QueryDeepPartialEntity<T>): Promise<UpdateResult> {
    return this.repository.update(id, partial);
  }

  protected async deleteEntity(id: number): Promise<DeleteResult> {
    return this.repository.delete(id);
  }

  protected build(alias: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }
}
