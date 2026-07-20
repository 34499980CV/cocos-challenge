import { OrdersSide, OrdersStatus, OrdersType } from '../types';
import { OrderSide, OrderStatus } from '../enums';

export class OrdersModel {
  constructor(
    public readonly id: number,
    public readonly userid: number,
    public readonly instrumentid: number,
    public readonly side: OrdersSide,
    public readonly type: OrdersType,
    public readonly status: OrdersStatus,
    public readonly size: number,
    public readonly price: number | null,
    public readonly datetime: Date
  ) {}

  isBuy(): boolean {
    return this.side === OrderSide.BUY;
  }

  isSell(): boolean {
    return this.side === OrderSide.SELL;
  }

  isCancelable(): boolean {
    return this.status === OrderStatus.NEW;
  }

  isFilled(): boolean {
    return this.status === OrderStatus.FILLED;
  }

  absoluteSize(): number {
    return Math.abs(this.size);
  }
}
