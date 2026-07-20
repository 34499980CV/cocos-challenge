import { AppError } from '../../middleware/errorHandler';
import { OrderStatus, OrderType } from '../../enums';

type ExecutionPriceInput = {
  type: OrderType;
  lastMarketPrice: number | null;
  limitPrice?: number;
};

export interface OrderProcessingFactory {
  resolveExecutionPrice(input: ExecutionPriceInput): number;
  resolveAcceptedStatus(type: OrderType): OrderStatus;
}

class DefaultOrderProcessingFactory implements OrderProcessingFactory {
  resolveExecutionPrice(input: ExecutionPriceInput): number {
    const resolverByType: Partial<Record<OrderType, () => number>> = {
      [OrderType.MARKET]: () => {
        if (input.lastMarketPrice == null) {
          throw new AppError(404, 'Market data not found for instrument');
        }
        return input.lastMarketPrice;
      },
      [OrderType.LIMIT]: () => input.limitPrice as number,
      [OrderType.CASH_IN]: () => 1,
      [OrderType.CASH_OUT]: () => 1,
    };

    const resolver = resolverByType[input.type];
    if (!resolver) {
      throw new AppError(400, `Unsupported order type: ${input.type}`);
    }

    return resolver();
  }

  resolveAcceptedStatus(type: OrderType): OrderStatus {
    const acceptedStatusByType: Partial<Record<OrderType, OrderStatus>> = {
      [OrderType.MARKET]: OrderStatus.FILLED,
      [OrderType.LIMIT]: OrderStatus.NEW,
      [OrderType.CASH_IN]: OrderStatus.FILLED,
      [OrderType.CASH_OUT]: OrderStatus.FILLED,
    };

    const status = acceptedStatusByType[type];
    if (!status) {
      throw new AppError(400, `Unsupported order type: ${type}`);
    }

    return status;
  }
}

export const orderProcessingFactory: OrderProcessingFactory =
  new DefaultOrderProcessingFactory();
