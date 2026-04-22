import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import { TelegramService } from './telegram.service';
import { ConfigurationService } from './configuration.service';
import { order as OrderModel, OrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

interface OrderExecutionRequest {
  signalId: string;
  symbol: string;
  orderType: 'BUY' | 'SELL';
  quantity: number;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
    private telegram: TelegramService,
    private configuration: ConfigurationService,
  ) {}

  /**
   * Create a pending order that awaits user authorization
   */
  async createPendingOrder(
    signalId: string,
    symbol: string,
    orderType: 'BUY' | 'SELL',
    quantity: number,
    currentPrice: number,
  ): Promise<OrderModel> {
    const config = await this.configuration.ensureConfiguration(symbol);

    // Calculate stop loss and take profit
    const stopLossPrice = new Decimal(currentPrice).mul(
      orderType === 'BUY' 
        ? new Decimal(1).minus(config.stop_loss_pct.div(100))
        : new Decimal(1).plus(config.stop_loss_pct.div(100))
    );
    
    const takeProfitPrice = new Decimal(currentPrice).mul(
      orderType === 'BUY'
        ? new Decimal(1).plus(config.take_profit_pct.div(100))
        : new Decimal(1).minus(config.take_profit_pct.div(100))
    );

    const order = await this.prisma.order.create({
      data: {
        configuration_id: config.id,
        signal_id: signalId,
        symbol: symbol.toUpperCase(),
        order_type: orderType,
        quantity: new Decimal(quantity),
        price: new Decimal(currentPrice),
        stop_loss_price: stopLossPrice,
        take_profit_price: takeProfitPrice,
        max_risk_eur: config.max_risk_per_trade,
        risk_level: config.risk_profile === 'BAJO' ? 'LOW' : config.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
        status: 'PENDING',
        status_reason: 'Awaiting user authorization',
      },
    });

    this.logger.log(`Pending order created: ${order.id} for ${symbol}`);
    return order;
  }

  /**
   * Authorize and execute an order on Alpaca
   */
  async authorizeAndExecuteOrder(orderId: string): Promise<boolean> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found: ${orderId}`);
        return false;
      }

      if (order.status !== 'PENDING') {
        this.logger.warn(`Order is not in PENDING status: ${order.id}`);
        return false;
      }

      // Execute order on Alpaca
      const alpacaOrder = await this.alpaca.executeOrder({
        symbol: order.symbol,
        qty: order.quantity.toNumber(),
        side: order.order_type.toLowerCase() as 'buy' | 'sell',
        type: 'market',
      });

      if (!alpacaOrder) {
        this.logger.error(`Failed to execute order on Alpaca: ${order.id}`);
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'FAILED' },
        });
        return false;
      }

      // Update order status
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'EXECUTED',
          alpaca_order_id: alpacaOrder.id,
          user_authorization_time: new Date(),
          execution_time: new Date(),
        },
      });

      this.logger.log(`Order executed: ${order.id} on Alpaca: ${alpacaOrder.id}`);

      // Send confirmation
      await this.telegram.sendOrderConfirmation(
        order.symbol,
        order.order_type,
        order.quantity.toFixed(2),
        order.price.toFixed(2),
      );

      // Create performance record for BUY orders
      if (order.order_type === 'BUY') {
        await this.prisma.performance.create({
          data: {
            configuration_id: order.configuration_id,
            buy_order_id: order.id,
            signal_id: order.signal_id || undefined,
            symbol: order.symbol,
            entry_price: order.price,
            entry_time: updatedOrder.execution_time || new Date(),
            quantity: order.quantity,
            status: 'OPEN',
          },
        });
      }

      return true;
    } catch (error) {
      this.logger.error(`Error authorizing and executing order: ${error.message}`);
      return false;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order not found: ${orderId}`);
        return false;
      }

      // Cancel on Alpaca if needed
      if (order.alpaca_order_id) {
        await this.alpaca.cancelOrder(order.alpaca_order_id);
      }

      // Update order status
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      this.logger.log(`Order cancelled: ${order.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error cancelling order: ${error.message}`);
      return false;
    }
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(): Promise<OrderModel[]> {
    return this.prisma.order.findMany({
      where: { status: 'PENDING' },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get orders by symbol
   */
  async getOrdersBySymbol(symbol: string, limit: number = 20): Promise<OrderModel[]> {
    return this.prisma.order.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all orders
   */
  async getAllOrders(limit: number = 50): Promise<OrderModel[]> {
    return this.prisma.order.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
