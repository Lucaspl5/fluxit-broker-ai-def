import { Injectable, Logger } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from '../prisma/prisma.service';

interface TelegramSignalMessage {
  symbol: string;
  signalType: 'BUY' | 'SELL';
  price: string;
  rsi: string;
  macd: string;
  ma50: string;
  ma200: string;
  reasoning: string;
  signalId: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;

  constructor(private prisma: PrismaService) {
    this.initializeBot();
  }

  private initializeBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token) {
      this.logger.warn('Telegram bot token not configured');
      return;
    }

    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId || null;

    // Register message handlers
    this.bot.on('message', async (msg) => {
      const text = msg.text?.toLowerCase() || '';
      const chat = msg.chat.id.toString();

      if (text === '/start') {
        await this.bot?.sendMessage(chat,
          '🤖 <b>Broker AI - Fluxit</b>\n\n' +
          '✅ Bot activo y funcionando\n' +
          '📊 Monitoreando 13 acciones\n' +
          '⏱️ Análisis cada 15 minutos\n' +
          '🔒 Paper Trading activo\n\n' +
          '<b>Comandos:</b>\n' +
          '/start - Estado del bot\n' +
          '/status - Ver estado actual\n' +
          '/signals - Últimas señales\n' +
          '/help - Ayuda',
          { parse_mode: 'HTML' }
        );
      } else if (text === '/status') {
        await this.bot?.sendMessage(chat,
          '📊 <b>Estado del Sistema</b>\n\n' +
          '🟢 Backend: Activo\n' +
          '🟢 Alpaca: Conectado (Paper)\n' +
          '🟢 Análisis: Cada 15 min\n' +
          '🔒 Convergencia: 4/4 indicadores\n' +
          '📉 Stop Loss: -2%\n' +
          '📈 Take Profit: +3-5%\n' +
          '💰 Max riesgo/trade: €2',
          { parse_mode: 'HTML' }
        );
      } else if (text === '/signals') {
        try {
          const signals = await this.prisma.signal.findMany({
            orderBy: { timestamp: 'desc' },
            take: 5,
          });
          if (signals.length === 0) {
            await this.bot?.sendMessage(chat, '📭 No hay señales generadas aún. El sistema analiza cada 15 minutos.');
          } else {
            let msg = '📊 <b>Últimas Señales:</b>\n\n';
            for (const s of signals) {
              const emoji = s.signal_type === 'BUY' ? '🟢' : '🔴';
              msg += `${emoji} ${s.symbol} - ${s.signal_type} - $${Number(s.current_price).toFixed(2)}\n`;
              msg += `   RSI: ${Number(s.rsi).toFixed(1)} | Convergencia: ${s.convergence_score}/4\n\n`;
            }
            await this.bot?.sendMessage(chat, msg, { parse_mode: 'HTML' });
          }
        } catch (e) {
          await this.bot?.sendMessage(chat, '❌ Error obteniendo señales');
        }
      } else if (text === '/help') {
        await this.bot?.sendMessage(chat,
          '❓ <b>Ayuda - Broker AI</b>\n\n' +
          'Este bot analiza 13 acciones cada 15 minutos usando 4 indicadores técnicos:\n' +
          '• RSI (Relative Strength Index)\n' +
          '• MACD (Moving Average Convergence)\n' +
          '• Moving Averages (MA50/MA200)\n' +
          '• Volumen\n\n' +
          'Cuando los 4 indicadores convergen, recibirás una señal con botones [COMPRAR] / [CANCELAR].\n\n' +
          '<b>Comandos:</b>\n' +
          '/start - Estado del bot\n' +
          '/status - Estado del sistema\n' +
          '/signals - Últimas señales\n' +
          '/help - Esta ayuda',
          { parse_mode: 'HTML' }
        );
      }
    });

    this.logger.log('Telegram bot initialized');
  }

  /**
   * Send signal notification with buy/sell buttons
   */
  async sendSignalNotification(message: TelegramSignalMessage): Promise<number | null> {
    try {
      if (!this.bot || !this.chatId) {
        this.logger.warn('Telegram bot or chat ID not configured');
        return null;
      }

      const emoji = message.signalType === 'BUY' ? '🟢' : '🔴';
      const text =
        `${emoji} <b>${message.signalType} Signal Generated!</b>\n\n` +
        `📊 Symbol: <b>${message.symbol}</b>\n` +
        `💹 Current Price: <b>$${message.price}</b>\n\n` +
        `📈 Technical Analysis:\n` +
        `  • RSI: ${message.rsi}\n` +
        `  • MACD: ${message.macd}\n` +
        `  • MA50: $${message.ma50}\n` +
        `  • MA200: $${message.ma200}\n\n` +
        `📝 Analysis:\n` +
        `${message.reasoning}\n\n` +
        `Do you want to execute this order?`;

      const inline_keyboard = [
        [
          {
            text: `✅ ${message.signalType}`,
            callback_data: `order_${message.signalType.toLowerCase()}_${message.signalId}`,
          },
          {
            text: '❌ Cancel',
            callback_data: `cancel_${message.signalId}`,
          },
        ],
      ];

      const sentMessage = await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard,
        },
      });

      this.logger.log(`Signal notification sent: ${sentMessage.message_id}`);
      return sentMessage.message_id;
    } catch (error) {
      this.logger.error(`Error sending signal notification: ${error.message}`);
      return null;
    }
  }

  /**
   * Send order execution confirmation
   */
  async sendOrderConfirmation(
    symbol: string,
    type: string,
    quantity: string,
    price: string,
  ): Promise<void> {
    try {
      if (!this.bot || !this.chatId) {
        return;
      }

      const emoji = type === 'BUY' ? '🟢' : '🔴';
      const text =
        `${emoji} <b>Order Executed!</b>\n\n` +
        `📊 Symbol: <b>${symbol}</b>\n` +
        `📈 Type: <b>${type}</b>\n` +
        `📦 Quantity: <b>${quantity}</b>\n` +
        `💰 Price: <b>$${price}</b>`;

      await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Order confirmation sent for ${symbol}`);
    } catch (error) {
      this.logger.error(`Error sending order confirmation: ${error.message}`);
    }
  }

  /**
   * Send performance update
   */
  async sendPerformanceUpdate(
    symbol: string,
    entryPrice: string,
    currentPrice: string,
    plPercent: string,
  ): Promise<void> {
    try {
      if (!this.bot || !this.chatId) {
        return;
      }

      const isProfit = parseFloat(plPercent) >= 0;
      const emoji = isProfit ? '📈' : '📉';
      const text =
        `${emoji} <b>Position Update</b>\n\n` +
        `📊 Symbol: <b>${symbol}</b>\n` +
        `🔢 Entry Price: <b>$${entryPrice}</b>\n` +
        `💹 Current Price: <b>$${currentPrice}</b>\n` +
        `${emoji} P&L: <b>${plPercent}%</b>`;

      await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
      });

      this.logger.log(`Performance update sent for ${symbol}`);
    } catch (error) {
      this.logger.error(`Error sending performance update: ${error.message}`);
    }
  }

  /**
   * Handle callback queries from Telegram buttons
   */
  onCallbackQuery(
    callback: (query: TelegramBot.CallbackQuery) => Promise<void>,
  ): void {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized');
      return;
    }

    this.bot.on('callback_query', callback);
    this.logger.log('Callback query listener registered');
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text: string,
    showAlert: boolean = false,
  ): Promise<void> {
    try {
      if (!this.bot) {
        return;
      }

      await this.bot.answerCallbackQuery(callbackQueryId, {
        text,
        show_alert: showAlert,
      });
    } catch (error) {
      this.logger.error(`Error answering callback query: ${error.message}`);
    }
  }

  /**
   * Register webhook for Telegram
   */
  async registerWebhook(webhookUrl: string): Promise<boolean> {
    try {
      if (!this.bot) {
        return false;
      }

      await this.bot.setWebHook(webhookUrl);
      this.logger.log(`Webhook registered: ${webhookUrl}`);
      return true;
    } catch (error) {
      this.logger.error(`Error registering webhook: ${error.message}`);
      return false;
    }
  }

  /**
   * Process incoming webhook update
   */
  async processUpdate(update: any): Promise<void> {
    try {
      if (!this.bot) {
        return;
      }

      this.bot.processUpdate(update);
    } catch (error) {
      this.logger.error(`Error processing update: ${error.message}`);
    }
  }
}
