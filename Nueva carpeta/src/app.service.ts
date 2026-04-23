import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'Broker AI Backend - Hybrid Trading System',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        analysis: 'POST /analysis/run - Execute technical analysis',
        signals: 'GET /signals - Get recent signals',
        orders: 'GET /orders - Get all orders',
        performance: 'GET /performance - Get P&L data',
        config: 'GET /config - Get configurations',
        telegram: 'POST /webhook/telegram - Telegram webhook',
        docs: 'GET /api-docs - API documentation',
      },
    };
  }
}
