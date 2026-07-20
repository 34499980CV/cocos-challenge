import { AppError } from '../../middleware/errorHandler';
import { InstrumentType, OrderType } from '../../enums';
import type { CreateOrdersInput, OrdersType } from '../../types';

export interface InstrumentTypeTradeValidationStrategy {
  validate(): void;
}

export interface OrderTypeValidationStrategy {
  validate(input: CreateOrdersInput): void;
}

export class RejectCashInstrumentTradeStrategy implements InstrumentTypeTradeValidationStrategy {
  validate(): void {
    throw new AppError(400, 'Cannot trade cash instrument directly');
  }
}

export class RejectUnknownInstrumentTradeStrategy implements InstrumentTypeTradeValidationStrategy {
  validate(): void {
    throw new AppError(400, 'Unsupported instrument type');
  }
}

export class AllowInstrumentTradeStrategy implements InstrumentTypeTradeValidationStrategy {
  validate(): void {
    // No restrictions for this instrument type.
  }
}

export class RequirePriceForLimitOrderValidationStrategy implements OrderTypeValidationStrategy {
  validate(input: CreateOrdersInput): void {
    if (input.price == null) {
      throw new AppError(400, 'LIMIT orders require a price');
    }
  }
}

export class AllowOrderTypeValidationStrategy implements OrderTypeValidationStrategy {
  validate(): void {
    // No restrictions for this order type.
  }
}

export class RejectUnknownOrderTypeValidationStrategy implements OrderTypeValidationStrategy {
  validate(): void {
    throw new AppError(400, 'Unsupported order type');
  }
}

export const defaultInstrumentTypeStrategy = new AllowInstrumentTradeStrategy();
export const defaultOrderTypeStrategy = new RejectUnknownOrderTypeValidationStrategy();

export const instrumentTypeStrategies: Record<string, InstrumentTypeTradeValidationStrategy> = {
  [InstrumentType.MONEDA]: new RejectCashInstrumentTradeStrategy(),
};

export const orderTypeStrategies: Partial<Record<OrdersType, OrderTypeValidationStrategy>> = {
  [OrderType.MARKET]: new AllowOrderTypeValidationStrategy(),
  [OrderType.LIMIT]: new RequirePriceForLimitOrderValidationStrategy(),
};
