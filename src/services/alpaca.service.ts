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

export type OrderExecutionStatus = 'filled' | 'pending_open' | 'market_closed' | 'failed';

export interface OrderExecutionResult {
  order: any | null;
  status: OrderExecutionStatus;
  errorMessage?: string;
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

    this.alpaca = new AlpacaAPI({ keyId: apiKey, secretKey, paper: true });
    this.logger.log('Alpaca client initialized (paper trading)');
  }

  async getHistoricalData(symbol: string, timeframe = '1Day', limit = 250): Promise<MarketBar[]> {
    if (!this.alpaca) return [];

    try {
      // Request extra days to account for weekends/holidays
      const lookbackDays = timeframe === '1Day' ? limit * 2 : timeframe.includes('Hour') ? Math.ceil(limit / 6) + 30 : 10;
      const start = new Date();
      start.setDate(start.getDate() - lookbackDays);

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
      this.logger.error(`getHistoricalData(${symbol} ${timeframe}): ${error.message}`);
      return [];
    }
  }

  // Returns detailed execution result — distinguishes market_closed from actual failures
  async executeOrderWithStatus(params: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    limit_price?: number;
  }): Promise<OrderExecutionResult> {
    if (!this.alpaca) return { order: null, status: 'failed', errorMessage: 'Alpaca not initialized' };

    try {
      const order = await this.alpaca.createOrder({
        symbol: params.symbol,
        qty: params.qty,
        side: params.side,
        type: params.type,
        time_in_force: 'day',
        ...(params.limit_price ? { limit_price: params.limit_price } : {}),
      });
      this.logger.log(`Order placed: ${order.id} ${params.side} ${params.symbol} status=${order.status}`);

      // Alpaca returns status: 'filled' (immediate) or 'accepted'/'pending_new' (market closed / queue)
      const filled = order.status === 'filled' || order.status === 'partially_filled';
      if (filled) return { order, status: 'filled' };

      // Distinguish market closed from other pending states
      const marketOpen = await this.isMarketOpen();
      return { order, status: marketOpen ? 'pending_open' : 'market_closed' };
    } catch (error) {
      const msg: string = error.message ?? '';
      this.logger.error(`executeOrder(${params.symbol}): ${msg}`);

      // Alpaca returns 422 with "market is closed" when extended_hours is not enabled
      const isMarketClosed = /market.*closed|outside.*hours|after.?hours/i.test(msg);
      return {
        order: null,
        status: isMarketClosed ? 'market_closed' : 'failed',
        errorMessage: msg,
      };
    }
  }

  // Legacy helper kept for internal SL/TP auto-close calls
  async executeOrder(params: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    limit_price?: number;
  }): Promise<any | null> {
    const result = await this.executeOrderWithStatus(params);
    return result.order;
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

  // Real open positions held at the broker (source of truth, with unrealized P&L)
  async getPositions(): Promise<any[]> {
    if (!this.alpaca) return [];
    try {
      return await this.alpaca.getPositions();
    } catch (error) {
      this.logger.error(`getPositions: ${error.message}`);
      return [];
    }
  }

  // A single real order by Alpaca id — used to read filled_avg_price / filled_qty after execution
  async getOrder(alpacaOrderId: string): Promise<any | null> {
    if (!this.alpaca) return null;
    try {
      return await this.alpaca.getOrder(alpacaOrderId);
    } catch (error) {
      this.logger.error(`getOrder(${alpacaOrderId}): ${error.message}`);
      return null;
    }
  }

  // Real portfolio equity curve from the broker (replaces the DB-derived fake curve)
  async getPortfolioHistory(period = '3M', timeframe = '1D'): Promise<any | null> {
    if (!this.alpaca) return null;
    try {
      return await this.alpaca.getPortfolioHistory({ period, timeframe, extended_hours: false });
    } catch (error) {
      this.logger.error(`getPortfolioHistory: ${error.message}`);
      return null;
    }
  }

  // All real FILL activities (actual executions), paginated ascending by time.
  // This is the ground truth for what the bot really traded.
  async getAllFillActivities(): Promise<any[]> {
    if (!this.alpaca) return [];
    const fills: any[] = [];
    let pageToken: string | undefined;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page: any[] = await this.alpaca.getAccountActivities({
          activityTypes: 'FILL',
          direction: 'asc',
          pageSize: 100,
          pageToken,
        });
        if (!page || page.length === 0) break;
        fills.push(...page);
        if (page.length < 100) break;
        pageToken = page[page.length - 1].id;
      }
    } catch (error) {
      this.logger.error(`getAllFillActivities: ${error.message}`);
    }
    return fills;
  }

  async isMarketOpen(): Promise<boolean> {
    if (!this.alpaca) return false;
    try {
      const clock = await this.alpaca.getClock();
      return clock.is_open === true;
    } catch (error) {
      this.logger.error(`getClock: ${error.message}`);
      // Fallback: NYSE hours Mon-Fri 13:30-21:00 UTC
      const now = new Date();
      const day = now.getUTCDay();
      if (day === 0 || day === 6) return false;
      const h = now.getUTCHours() * 60 + now.getUTCMinutes();
      return h >= 13 * 60 + 30 && h < 21 * 60;
    }
  }

  async getLatestPrice(symbol: string): Promise<number | null> {
    if (!this.alpaca) return null;
    try {
      const bars = await this.getHistoricalData(symbol, '1Min', 5);
      if (bars.length > 0) return bars[bars.length - 1].close;
      const daily = await this.getHistoricalData(symbol, '1Day', 1);
      return daily.length > 0 ? daily[daily.length - 1].close : null;
    } catch (error) {
      this.logger.error(`getLatestPrice(${symbol}): ${error.message}`);
      return null;
    }
  }
}
