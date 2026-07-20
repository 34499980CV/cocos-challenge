import { OrderSide, OrderStatus, OrderType } from '../enums';

export type OrdersSide = OrderSide;
export type OrdersType = OrderType;
export type OrdersStatus = OrderStatus;

export interface Position {
  instrumentId: number;
  ticker: string;
  name: string;
  quantity: number;
  marketValue: number;
  totalReturnPct: number;
}

export interface PortfolioResponse {
  totalAccountValue: number;
  availableCash: number;
  positions: Position[];
}

export interface InstrumentSearchResult {
  id: number;
  ticker: string;
  name: string;
  type: string;
  price: number;
  dailyReturnPct: number;
}

export interface OrdersRecord {
  id: number;
  userid: number;
  instrumentid: number;
  side: OrdersSide;
  type: OrdersType;
  status: OrdersStatus;
  size: number;
  price: number | null;
  datetime: Date;
}

export interface CreateOrdersInput {
  userId: number;
  instrumentId: number;
  side: OrdersSide;
  type: OrdersType;
  quantity?: number;
  amount?: number;
  price?: number;
}
