import { Injectable, Logger } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AlpacaAPI = require('@alpacahq/alpaca-trade-api');

export interface MarketBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class AlpacaService {
  private readonly logger = new Logger(AlpacaService.name);
  private alpaca: any;

  constructor() {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      this.logger.error('ALPACA_API_KEY or ALPACA_SECRET_KEY not set — market data will not be available');
      return;
    }

    this.alpaca = new AlpacaAPI({
      keyId: apiKey,
      secretKey,
      paper: true,
    });

    this.logger.log('Alpaca client initialized (paper trading)');
  }

  async getHistoricalData(symbol: string, timeframe = '1Day', limit = 250): Promise<MarketBar[]> {
    if (!this.alpaca) return [];

    try {
      const start = new Date();
      start.setDate(start.getDate() - limit * 2);

      const iterator = await this.alpaca.getBarsV2(symbol, {
        timeframe,
        limit,
        start: start.toISOString().split('T')[0],
      });

      const bars: MarketBar[] = [];
      for await (const bar of iterator) {
        const close = bar.ClosePrice ?? bar.c ?? bar.close;
        const open  = bar.OpenPrice  ?? bar.o ?? bar.open;
        const high  = bar.HighPrice  ?? bar.h ?? bar.high;
        const low   = bar.LowPrice   ?? bar.l ?? bar.low;
        const vol   = bar.Volume     ?? bar.v ?? bar.volume ?? 0;
        const ts    = bar.Timestamp  ?? bar.t ?? bar.timestamp;

        if (close == null) continue;

        bars.push({
          timestamp: new Date(ts).getTime(),
          open: open ?? close,
          high: high ?? close,
          low:  low  ?? close,
          close,
          volume: vol,
        });
        if (bars.length >= limit) break;
      }

      return bars.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      this.logger.error(`getHistoricalData(${symbol}): ${error.message}`);
      return [];
    }
  }

  async executeOrder(params: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    limit_price?: number;
  }): Promise<any | null> {
    if (!this.alpaca) return null;

    try {
      const order = await this.alpaca.createOrder({
        symbol: params.symbol,
        qty: params.qty,
        side: params.side,
        type: params.type,
        time_in_force: 'day',
        ...(params.limit_price ? { limit_price: params.limit_price } : {}),
      });
      this.logger.log(`Order placed: ${order.id} ${params.side} ${params.symbol}`);
      return order;
    } catch (error) {
      this.logger.error(`executeOrder(${params.symbol}): ${error.message}`);
      return null;
    }
  }

  async cancelOrder(alpacaOrderId: string): Promise<boolean> {
    if (!this.alpaca) return false;
    try {
      await this.alpaca.cancelOrder(alpacaOrderId);
      return true;
    } catch (error) {
      this.logger.error(`cancelOrder(${alpacaOrderId}): ${error.message}`);
      return false;
    }
  }

  async getAccount(): Promise<any | null> {
    if (!this.alpaca) return null;
    try {
      return await this.alpaca.getAccount();
    } catch (error) {
      this.logger.error(`getAccount: ${error.message}`);
      return null;
    }
  }
}
