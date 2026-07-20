export class PositionModel {
  constructor(
    public readonly instrumentId: number,
    public readonly ticker: string,
    public readonly name: string,
    public readonly quantity: number,
    public readonly marketValue: number,
    public readonly totalReturnPct: number
  ) {}

  static toModel(position: {
    instrumentId: number;
    ticker: string;
    name: string;
    quantity: number;
    marketValue: number;
    totalReturnPct: number;
  }): PositionModel {
    return new PositionModel(
      position.instrumentId,
      position.ticker,
      position.name,
      position.quantity,
      position.marketValue,
      position.totalReturnPct
    );
  }

  hasPositiveQuantity(): boolean {
    return this.quantity > 0;
  }
}

export class PortfolioModel {
  constructor(
    public readonly totalAccountValue: number,
    public readonly availableCash: number,
    public readonly positions: PositionModel[]
  ) {}

  addPosition(position: PositionModel): PortfolioModel {
    return new PortfolioModel(
      this.totalAccountValue,
      this.availableCash,
      [...this.positions, position]
    );
  }

  hasPositions(): boolean {
    return this.positions.length > 0;
  }
}
