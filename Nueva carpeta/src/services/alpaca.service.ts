import { Injectable, Logger } from '@nestjs/common';
import Alpaca from '@alpacahq/alpaca-trade-api';

interface MarketDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OrderRequest {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  limit_price?: number;
}

@Injectable()
export class AlpacaService {
  private readonly logger = new Logger(AlpacaService.name);
  private alpaca: any;

  constructor() {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !secretKey) {
      this.logger.warn('Alpaca API credentials not configured');
      return;
    }

    this.alpaca = new Alpaca({
      credentials: {
        key: apiKey,
        secret: secretKey,
      },
      rate_limit: true,
    });
  }

  /**
   * Fetch historical market data (bars)
   */
  async getHistoricalData(
    symbol: string,
    timeframe: string = '1min',
    limit: number = 200,
  ): Promise<MarketDataPoint[]> {
    try {
      if (!this.alpaca) {
        this.logger.warn('Alpaca not initialized');
        return [];
      }

      // Calculate start date based on limit and timeframe
      const startDate = new Date();
      if (timeframe === '1Day') {
        startDate.setDate(startDate.getDate() - (limit * 2)); // Extra buffer for weekends/holidays
      } else {
        startDate.setDate(startDate.getDate() - 30); // 30 days for intraday
      }

      // Fetch bars from Alpaca using getBarsV2
      const barsIterator = await this.alpaca.getBarsV2(symbol, {
        timeframe,
        limit,
        start: startDate.toISOString().split('T')[0],
      });

      // Convert to standard format - barsIterator is an async generator
      const data: MarketDataPoint[] = [];
      let count = 0;

      for await (const bar of barsIterator) {
        data.push({
          timestamp: new Date(bar.Timestamp).getTime(),
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: bar.v,
        });
        count++;
        if (count >= limit) break;
      }

      return data.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      this.logger.error(`Error fetching historical data for ${symbol}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      if (!this.alpaca) {
        return null;
      }

      const quote = await this.alpaca.getLatestQuote(symbol);
      if (quote) {
        // AlpacaQuote has ap (ask price) or bp (bid price)
        return quote.ap || quote.bp || null;
      }
      return null;
    } catch (error) {
      this.logger.error(`Error fetching current price for ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Execute a market order
   */
  async executeOrder(orderRequest: OrderRequest): Promise<any | null> {
    try {
      if (!this.alpaca) {
        this.logger.warn('Alpaca not initialized');
        return null;
      }

      const order = await this.alpaca.createOrder({
        symbol: orderRequest.symbol,
        qty: orderRequest.qty,
        side: orderRequest.side,
        type: orderRequest.type,
        time_in_force: 'day',
        limit_price: orderRequest.limit_price,
      });

      this.logger.log(`Order created: ${order.id} for ${orderRequest.symbol} ${orderRequest.side}`);
      return order;
    } catch (error) {
      this.logger.error(`Error executing order: ${error.message}`);
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      if (!this.alpaca) {
        return false;
      }

      await this.alpaca.cancelOrder(orderId);
      this.logger.log(`Order cancelled: ${orderId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error cancelling order: ${error.message}`);
      return false;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<any | null> {
    try {
      if (!this.alpaca) {
        return null;
      }

      const order = await this.alpaca.getOrder(orderId);
      return order;
    } catch (error) {
      this.logger.error(`Error getting order status: ${error.message}`);
      return null;
    }
  }

  /**
   * Get account info
   */
  async getAccount(): Promise<any | null> {
    try {
      if (!this.alpaca) {
        return null;
      }

      const account = await this.alpaca.getAccount();
      return account;
    } catch (error) {
      this.logger.error(`Error getting account info: ${error.message}`);
      return null;
    }
  }
}
