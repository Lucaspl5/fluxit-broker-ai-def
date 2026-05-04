import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { TelegramService } from '../services/telegram.service';
import { OrderService } from '../services/order.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhook')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private telegram: TelegramService,
    private orders: OrderService,
    private prisma: PrismaService,
  ) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram webhook — recibe updates del bot' })
  async handleWebhook(@Body() update: any) {
    try {
      await this.telegram.processUpdate(update);

      if (!update.callback_query) return { ok: true };

      const { id: callbackId, data } = update.callback_query;
      this.logger.log(`Callback query: ${data}`);

      if (data.startsWith('order_buy_') || data.startsWith('order_sell_')) {
        const parts = data.split('_');
        const orderType = parts[1].toUpperCase() as 'BUY' | 'SELL';
        const signalId = parts.slice(2).join('_');

        const signal = await this.prisma.signal.findUnique({ where: { id: signalId } });
        if (!signal) {
          await this.telegram.answerCallbackQuery(callbackId, 'Señal no encontrada', true);
          return { ok: false };
        }

        const order = await this.orders.createPendingOrder(
          signalId, signal.symbol, orderType, 1, signal.current_price.toNumber(),
        );

        const executed = await this.orders.authorizeAndExecuteOrder(order.id);
        await this.telegram.answerCallbackQuery(
          callbackId,
          executed ? `✅ Orden ${orderType} ejecutada` : '❌ Error al ejecutar la orden',
          true,
        );
      } else if (data.startsWith('cancel_')) {
        await this.telegram.answerCallbackQuery(callbackId, 'Orden cancelada', false);
      }

      return { ok: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }
}
