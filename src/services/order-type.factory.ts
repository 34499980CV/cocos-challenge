import { OrderSide, OrderType } from '../enums';

export interface CashMovementOrderTypeFactory {
  create(side: OrderSide.CASH_IN | OrderSide.CASH_OUT): OrderType.CASH_IN | OrderType.CASH_OUT;
}

class DefaultCashMovementOrderTypeFactory implements CashMovementOrderTypeFactory {
  private readonly mapping: Record<
    OrderSide.CASH_IN | OrderSide.CASH_OUT,
    OrderType.CASH_IN | OrderType.CASH_OUT
  > = {
    [OrderSide.CASH_IN]: OrderType.CASH_IN,
    [OrderSide.CASH_OUT]: OrderType.CASH_OUT,
  };

  create(side: OrderSide.CASH_IN | OrderSide.CASH_OUT): OrderType.CASH_IN | OrderType.CASH_OUT {
    return this.mapping[side];
  }
}

export const cashMovementOrderTypeFactory: CashMovementOrderTypeFactory =
  new DefaultCashMovementOrderTypeFactory();
