import type { EntityManager } from 'typeorm';
import { Users } from '../entities/users.entity';
import { BaseRepository } from './base.repository';

export class UsersRepository extends BaseRepository<Users> {
  constructor() {
    super(Users);
  }

  private getRepository(manager?: EntityManager) {
    return manager ? manager.getRepository(Users) : this.repository;
  }

  async findUserById(userId: number, manager?: EntityManager): Promise<Users | null> {
    return this.getRepository(manager).findOneBy({ id: userId });
  }
}