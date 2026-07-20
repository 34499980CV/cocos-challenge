import 'reflect-metadata';
import type { EntityManager } from 'typeorm';
import { Orders } from '../entities/orders.entity';
import { BaseRepository } from './base.repository';
import { OrderSide, OrderStatus } from '../enums';

export class OrdersRepository extends BaseRepository<Orders> {

  constructor() {
    super(Orders);
  }

  private getRepository(manager?: EntityManager) {
    return manager ? manager.getRepository(Orders) : this.repository;
  }

  async findById(orderId: number, userId: number, manager?: EntityManager): Promise<Orders | null> {
    return this.getRepository(manager).findOneBy({ id: orderId, userid: userId });
  }

  async getAvailableCash(userId: number, cashInstrumentId: number, manager?: EntityManager): Promise<number> {
    const result = await this.getRepository(manager)
      .createQueryBuilder('o')
      .select(
        `COALESCE(SUM(
          CASE
            WHEN o.instrumentid = :cashInstrumentId AND o.side = :cashInSide THEN ABS(o.size)
            WHEN o.instrumentid = :cashInstrumentId AND o.side = :cashOutSide THEN -ABS(o.size)
            WHEN o.side = :buySide THEN -(o.size * COALESCE(o.price, 0))
            WHEN o.side = :sellSide THEN ((-o.size) * COALESCE(o.price, 0))
            ELSE 0
          END
        ), 0)`,
        'available'
      )
      .where('o.userid = :userId', { userId })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .andWhere('o.side IN (:...sides)', {
        sides: [OrderSide.BUY, OrderSide.SELL, OrderSide.CASH_IN, OrderSide.CASH_OUT],
      })
      .setParameters({
        cashInstrumentId,
        cashInSide: OrderSide.CASH_IN,
        cashOutSide: OrderSide.CASH_OUT,
        buySide: OrderSide.BUY,
        sellSide: OrderSide.SELL,
      })
      .getRawOne<{ available: string }>();

    const available = parseFloat(result?.available ?? '0');
    return Number.isFinite(available) ? available : 0;
  }

  async getAvailableShares(
    userId: number,
    instrumentId: number,
    manager?: EntityManager
  ): Promise<number> {
    const result = await this.getRepository(manager)
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.size), 0)', 'quantity')
      .where('o.userid = :userId', { userId })
      .andWhere('o.instrumentid = :instrumentId', { instrumentId })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .andWhere('o.side IN (:...sides)', { sides: [OrderSide.BUY, OrderSide.SELL] })
      .getRawOne<{ quantity: string }>();

    return parseFloat(result?.quantity ?? '0');
  }

  async insertOrder(
    manager: EntityManager,
    order: Orders
  ): Promise<Orders> {
    const repository = this.getRepository(manager);
    return repository.save(order);
  }

  async cancelIfNew(order: Orders, manager?: EntityManager): Promise<Orders | null> {
    if (order.status !== OrderStatus.NEW) {
      return null;
    }

    const repository = this.getRepository(manager);
    const currentOrder = await repository.findOneBy({ id: order.id, userid: order.userid, status: OrderStatus.NEW });
    if (!currentOrder) {
      return null;
    }

    currentOrder.status = OrderStatus.CANCELLED;
    return repository.save(currentOrder);
  }

  async list(userId: number, manager?: EntityManager): Promise<Orders[]> {
    return this.getRepository(manager).find({
      where: { userid: userId },
      order: { datetime: 'DESC' },
    });
  }

  async getOpenPositions(
    userId: number,
    manager?: EntityManager
  ): Promise<Array<{ instrumentid: number; quantity: string }>> {
    return this.getRepository(manager)
      .createQueryBuilder('o')
      .select('o.instrumentid', 'instrumentid')
      .addSelect('COALESCE(SUM(o.size), 0)', 'quantity')
      .where('o.userid = :userId', { userId })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .andWhere('o.side IN (:...sides)', { sides: [OrderSide.BUY, OrderSide.SELL] })
      .groupBy('o.instrumentid')
      .having('COALESCE(SUM(o.size), 0) > 0')
      .getRawMany<{ instrumentid: number; quantity: string }>();
  }

  async getFilledOrdersForInstrument(
    userId: number,
    instrumentId: number,
    manager?: EntityManager
  ): Promise<Array<{ size: string; price: string }>> {
    return this.getRepository(manager)
      .createQueryBuilder('o')
      .select('o.size', 'size')
      .addSelect('o.price', 'price')
      .where('o.userid = :userId', { userId })
      .andWhere('o.instrumentid = :instrumentId', { instrumentId })
      .andWhere('o.status = :status', { status: OrderStatus.FILLED })
      .andWhere('o.side IN (:...sides)', { sides: [OrderSide.BUY, OrderSide.SELL] })
      .orderBy('o.datetime', 'ASC')
      .getRawMany<{ size: string; price: string }>();
  }
}
