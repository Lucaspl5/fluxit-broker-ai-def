import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import { TelegramService } from './telegram.service';
import { ConfigurationService } from './configuration.service';
import { order as OrderModel } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class OrderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
    private telegram: TelegramService,
    private config: ConfigurationService,
  ) {}

  async onApplicationBootstrap() {
    await this.reconcileOpenPositions();
  }

  private async reconcileOpenPositions(): Promise<void> {
    const openPositions = await this.prisma.performance.findMany({
      where: { status: 'OPEN' },
    });
    if (openPositions.length === 0) return;

    let closed = 0;
    for (const pos of openPositions) {
      const sellOrder = await this.prisma.order.findFirst({
        where: { symbol: pos.symbol, order_type: 'SELL', status: 'EXECUTED', timestamp: { gte: pos.entry_time } },
        orderBy: { timestamp: 'asc' },
      });
      if (!sellOrder) continue;

      const exitPrice = Number(sellOrder.price);
      const entry     = Number(pos.entry_price);
      const qty       = Number(pos.quantity);
      const pl        = (exitPrice - entry) * qty;
      const plPct     = ((exitPrice - entry) / entry) * 100;
      const exitTime  = sellOrder.execution_time || sellOrder.timestamp;
      const duration  = Math.floor((exitTime.getTime() - new Date(pos.entry_time).getTime()) / 1000);

      await this.prisma.performance.update({
        where: { id: pos.id },
        data: {
          exit_price: new Decimal(exitPrice),
          exit_time: exitTime,
          profit_loss: new Decimal(pl),
          profit_loss_pct: new Decimal(plPct),
          duration_seconds: duration,
          status: 'CLOSED',
        },
      });
      closed++;
    }

    if (closed > 0) {
      this.logger.log(`Reconciled ${closed} open position(s) with executed SELL orders`);
    }
  }

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

    const result = await this.alpaca.executeOrderWithStatus({
      symbol: order.symbol,
      qty: order.quantity.toNumber(),
      side: order.order_type.toLowerCase() as 'buy' | 'sell',
      type: 'market',
    });

    // Only an actual FILL counts. market_closed / pending_open / failed must NOT
    // book a position or P&L — doing so was the root cause of phantom profits.
    if (result.status !== 'filled' || !result.order) {
      const newStatus =
        result.status === 'market_closed' || result.status === 'pending_open' ? 'PENDING' : 'FAILED';
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          alpaca_order_id: result.order?.id,
          status_reason: result.status + (result.errorMessage ? `: ${result.errorMessage}` : ''),
        },
      });
      this.logger.warn(`Order ${orderId} not filled (status=${result.status}) — no position booked`);
      return false;
    }

    // Read the REAL fill price and quantity from Alpaca (fall back to a re-fetch)
    const fill = await this.resolveFill(result.order, order.price.toNumber(), order.quantity.toNumber());

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'EXECUTED',
        price: new Decimal(fill.price),
        quantity: new Decimal(fill.qty),
        alpaca_order_id: result.order.id,
        user_authorization_time: new Date(),
        execution_time: fill.time,
      },
    });

    await this.telegram.sendOrderConfirmation(
      order.symbol,
      order.order_type,
      fill.qty.toFixed(2),
      fill.price.toFixed(2),
    );

    if (order.order_type === 'BUY') {
      await this.prisma.performance.create({
        data: {
          configuration_id: order.configuration_id,
          buy_order_id: order.id,
          signal_id: order.signal_id || undefined,
          symbol: order.symbol,
          entry_price: new Decimal(fill.price),
          entry_time: updated.execution_time || fill.time,
          quantity: new Decimal(fill.qty),
          status: 'OPEN',
        },
      });
    } else if (order.order_type === 'SELL') {
      await this.closeOpenPosition(order.symbol, fill.price, fill.time);
    }

    return true;
  }

  // Extracts the real filled price/qty from an Alpaca order, re-fetching if needed
  private async resolveFill(
    alpacaOrder: any,
    fallbackPrice: number,
    fallbackQty: number,
  ): Promise<{ price: number; qty: number; time: Date }> {
    let avg = Number(alpacaOrder.filled_avg_price ?? 0);
    let qty = Number(alpacaOrder.filled_qty ?? 0);
    let filledAt = alpacaOrder.filled_at;

    if (!avg || !qty) {
      const fresh = await this.alpaca.getOrder(alpacaOrder.id);
      if (fresh) {
        avg = Number(fresh.filled_avg_price ?? avg);
        qty = Number(fresh.filled_qty ?? qty);
        filledAt = fresh.filled_at ?? filledAt;
      }
    }

    return {
      price: avg > 0 ? avg : fallbackPrice,
      qty: qty > 0 ? qty : fallbackQty,
      time: filledAt ? new Date(filledAt) : new Date(),
    };
  }

  async closeOpenPosition(symbol: string, exitPrice: number, exitTime: Date): Promise<void> {
    const openPerf = await this.prisma.performance.findFirst({
      where: { symbol, status: 'OPEN' },
      orderBy: { entry_time: 'asc' },
    });
    if (!openPerf) return;

    const entry    = Number(openPerf.entry_price);
    const qty      = Number(openPerf.quantity);
    const pl       = (exitPrice - entry) * qty;
    const plPct    = ((exitPrice - entry) / entry) * 100;
    const duration = Math.floor((exitTime.getTime() - new Date(openPerf.entry_time).getTime()) / 1000);

    await this.prisma.performance.update({
      where: { id: openPerf.id },
      data: {
        exit_price: new Decimal(exitPrice),
        exit_time: exitTime,
        profit_loss: new Decimal(pl),
        profit_loss_pct: new Decimal(plPct),
        duration_seconds: duration,
        status: 'CLOSED',
      },
    });

    this.logger.log(`Position closed: ${symbol} entry=$${entry} exit=$${exitPrice} P&L=${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}`);
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
