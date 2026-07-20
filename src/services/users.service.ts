import type { EntityManager } from 'typeorm';
import { AppError } from '../middleware/errorHandler';
import type { Users } from '../entities/users.entity';
import { UsersRepository } from '../repositories/users.repository';

type UsersRepositoryLike = {
  findUserById(userId: number, manager?: EntityManager): Promise<Users | null>;
};

export interface UsersServiceDependencies {
  getUsersRepository(): Promise<UsersRepositoryLike>;
}

export type UsersServiceLike = {
  ensureUserExists(userId: number, manager?: EntityManager): Promise<void>;
};

const defaultDependencies: UsersServiceDependencies = {
  async getUsersRepository(): Promise<UsersRepositoryLike> {
    return new UsersRepository();
  },
};

export class UsersService {
  constructor(private readonly dependencies: UsersServiceDependencies = defaultDependencies) {}

  async ensureUserExists(userId: number, manager?: EntityManager): Promise<void> {
    const usersRepository = await this.dependencies.getUsersRepository();
    const user = await usersRepository.findUserById(userId, manager);
    if (!user) {
      throw new AppError(404, 'User not found');
    }
  }
}

const service = new UsersService();

export const usersService: UsersServiceLike = {
  ensureUserExists: (userId: number, manager?: EntityManager): Promise<void> =>
    service.ensureUserExists(userId, manager),
};