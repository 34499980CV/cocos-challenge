import { InstrumentType } from '../enums';

export class InstrumentModel {
  constructor(
    public readonly id: number,
    public readonly ticker: string,
    public readonly name: string,
    public readonly type: string,
    public readonly price: number,
    public readonly dailyReturnPct: number
  ) {}

  static toModel(row: {
    id: number;
    ticker: string;
    name: string;
    type: string;
    close: string | null;
    previousclose: string | null;
  }): InstrumentModel {
    const close = parseFloat(row.close ?? '0');
    const previousClose = parseFloat(row.previousclose ?? '0');
    const dailyReturnPct =
      previousClose > 0 ? ((close - previousClose) / previousClose) * 100 : 0;

    return new InstrumentModel(
      row.id,
      row.ticker,
      row.name,
      row.type,
      close,
      Math.round(dailyReturnPct * 100) / 100
    );
  }

  static fromRow(row: {
    id: number;
    ticker: string;
    name: string;
    type: string;
    close: string | null;
    previousclose: string | null;
  }): InstrumentModel {
    return InstrumentModel.toModel(row);
  }

  isCash(): boolean {
    return this.type === InstrumentType.MONEDA;
  }

  isTradable(): boolean {
    return !this.isCash();
  }
}