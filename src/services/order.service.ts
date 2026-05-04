import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import { TelegramService } from './telegram.service';
import { ConfigurationService } from './configuration.service';
import { order as OrderModel } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
    private telegram: TelegramService,
    private config: ConfigurationService,
  ) {}

  async createPendingOrder(
    signalId: string,
    symbol: string,
    orderType: 'BUY' | 'SELL',
    quantity: number,
    currentPrice: number,
  ): Promise<OrderModel> {
    const cfg = await this.config.ensureConfiguration(symbol);

    const slMul = orderType === 'BUY'
      ? new Decimal(1).minus(cfg.stop_loss_pct.div(100))
      : new Decimal(1).plus(cfg.stop_loss_pct.div(100));
    const tpMul = orderType === 'BUY'
      ? new Decimal(1).plus(cfg.take_profit_pct.div(100))
      : new Decimal(1).minus(cfg.take_profit_pct.div(100));

    const order = await this.prisma.order.create({
      data: {
        configuration_id: cfg.id,
        signal_id: signalId,
        symbol: symbol.toUpperCase(),
        order_type: orderType,
        quantity: new Decimal(quantity),
        price: new Decimal(currentPrice),
        stop_loss_price: new Decimal(currentPrice).mul(slMul),
        take_profit_price: new Decimal(currentPrice).mul(tpMul),
        max_risk_eur: cfg.max_risk_per_trade,
        risk_level: cfg.risk_profile === 'BAJO' ? 'LOW' : cfg.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
        status: 'PENDING',
        status_reason: 'Awaiting user authorization',
      },
    });

    this.logger.log(`Pending order created: ${order.id} ${symbol} ${orderType}`);
    return order;
  }

  async authorizeAndExecuteOrder(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'PENDING') return false;

    const alpacaOrder = await this.alpaca.executeOrder({
      symbol: order.symbol,
      qty: order.quantity.toNumber(),
      side: order.order_type.toLowerCase() as 'buy' | 'sell',
      type: 'market',
    });

    if (!alpacaOrder) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'FAILED' } });
      return false;
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'EXECUTED',
        alpaca_order_id: alpacaOrder.id,
        user_authorization_time: new Date(),
        execution_time: new Date(),
      },
    });

    await this.telegram.sendOrderConfirmation(
      order.symbol,
      order.order_type,
      order.quantity.toFixed(2),
      order.price.toFixed(2),
    );

    if (order.order_type === 'BUY') {
      await this.prisma.performance.create({
        data: {
          configuration_id: order.configuration_id,
          buy_order_id: order.id,
          signal_id: order.signal_id || undefined,
          symbol: order.symbol,
          entry_price: order.price,
          entry_time: updated.execution_time || new Date(),
          quantity: order.quantity,
          status: 'OPEN',
        },
      });
    }

    return true;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return false;

    if (order.alpaca_order_id) {
      await this.alpaca.cancelOrder(order.alpaca_order_id);
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    return true;
  }

  async getAllOrders(limit = 50): Promise<OrderModel[]> {
    return this.prisma.order.findMany({ orderBy: { timestamp: 'desc' }, take: limit });
  }

  async getOrdersBySymbol(symbol: string, limit = 20): Promise<OrderModel[]> {
    return this.prisma.order.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
