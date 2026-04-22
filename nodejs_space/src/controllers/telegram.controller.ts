import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TelegramService } from '../services/telegram.service';
import { OrderService } from '../services/order.service';
import { SignalService } from '../services/signal.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhook')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private telegramService: TelegramService,
    private orderService: OrderService,
    private signalService: SignalService,
    private prisma: PrismaService,
  ) {}

  @Post('telegram')
  @ApiOperation({
    summary: 'Telegram webhook handler',
    description: 'Receives updates from Telegram bot including callback queries from buy/sell buttons',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        update_id: { type: 'number' },
        callback_query: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            from: { type: 'object' },
            data: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleWebhook(@Body() update: any): Promise<any> {
    try {
      // Process Telegram update
      await this.telegramService.processUpdate(update);

      // Handle callback queries (button clicks)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const data = callbackQuery.data;
        const callbackQueryId = callbackQuery.id;

        this.logger.log(`Callback query received: ${data}`);

        if (data.startsWith('order_buy_') || data.startsWith('order_sell_')) {
          // Extract signal ID from callback data
          const parts = data.split('_');
          const orderType = parts[1].toUpperCase();
          const signalId = parts.slice(2).join('_');

          // Get signal
          const signal = await this.prisma.signal.findUnique({
            where: { id: signalId },
          });

          if (!signal) {
            await this.telegramService.answerCallbackQuery(
              callbackQueryId,
              'Signal not found',
              true,
            );
            return { success: false };
          }

          // Create pending order
          const order = await this.orderService.createPendingOrder(
            signalId,
            signal.symbol,
            orderType as 'BUY' | 'SELL',
            1, // Default quantity
            signal.current_price.toNumber(),
          );

          // Authorize and execute
          const executed = await this.orderService.authorizeAndExecuteOrder(order.id);

          if (executed) {
            await this.telegramService.answerCallbackQuery(
              callbackQueryId,
              `✅ ${orderType} order executed!`,
              true,
            );
          } else {
            await this.telegramService.answerCallbackQuery(
              callbackQueryId,
              '❌ Order execution failed',
              true,
            );
          }
        } else if (data.startsWith('cancel_')) {
          const signalId = data.split('_').slice(1).join('_');
          await this.telegramService.answerCallbackQuery(
            callbackQueryId,
            'Order cancelled',
            false,
          );
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
