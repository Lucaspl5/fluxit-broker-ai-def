import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from '../prisma/prisma.service';

export interface SignalMessage {
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
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.initBot();
    this.registerWebhook();
  }

  private initBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN not set — Telegram integration disabled');
      return;
    }

    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    if (!this.chatId) {
      this.logger.error('TELEGRAM_CHAT_ID not set — cannot send proactive messages');
    }

    this.bot = new TelegramBot(token, { polling: false });
    this.registerCommands();
    this.logger.log('Telegram bot initialized');
  }

  private registerCommands() {
    if (!this.bot) return;

    this.bot.on('message', async (msg) => {
      const text = msg.text?.toLowerCase().trim() || '';
      const chat = String(msg.chat.id);

      if (text === '/start') {
        await this.bot.sendMessage(chat,
          '🤖 <b>Broker AI — Fluxit</b>\n\n' +
          '✅ Bot activo y funcionando\n' +
          '📊 Monitoreando 13 acciones\n' +
          '⏱️ Análisis automático cada 15 minutos\n' +
          '🔒 Paper Trading activo\n\n' +
          '<b>Comandos:</b>\n' +
          '/status — Estado del sistema\n' +
          '/signals — Últimas señales\n' +
          '/help — Ayuda',
          { parse_mode: 'HTML' },
        );
      } else if (text === '/status') {
        await this.bot.sendMessage(chat,
          '📊 <b>Estado del Sistema</b>\n\n' +
          '🟢 Backend: Activo\n' +
          '🟢 Alpaca: Paper Trading\n' +
          '🟢 Análisis: Cada 15 min\n' +
          '📉 Stop Loss: -2%\n' +
          '📈 Take Profit: +3-5%\n' +
          '💰 Max riesgo/trade: €2\n' +
          '🎯 Convergencia mínima: 2 indicadores',
          { parse_mode: 'HTML' },
        );
      } else if (text === '/signals') {
        try {
          const signals = await this.prisma.signal.findMany({
            orderBy: { timestamp: 'desc' },
            take: 5,
          });
          if (signals.length === 0) {
            await this.bot.sendMessage(chat, '📭 No hay señales aún. El análisis se ejecuta cada 15 minutos.');
          } else {
            let reply = '📊 <b>Últimas Señales:</b>\n\n';
            for (const s of signals) {
              const e = s.signal_type === 'BUY' ? '🟢' : '🔴';
              reply += `${e} <b>${s.symbol}</b> — ${s.signal_type} — $${Number(s.current_price).toFixed(2)}\n`;
              reply += `   RSI: ${Number(s.rsi).toFixed(1)} | Score: ${s.convergence_score}/5\n\n`;
            }
            await this.bot.sendMessage(chat, reply, { parse_mode: 'HTML' });
          }
        } catch {
          await this.bot.sendMessage(chat, '❌ Error obteniendo señales.');
        }
      } else if (text === '/help') {
        await this.bot.sendMessage(chat,
          '❓ <b>Ayuda — Broker AI</b>\n\n' +
          'Analiza 13 acciones cada 15 minutos con 4 indicadores:\n' +
          '• RSI\n• MACD\n• MA50 / MA200\n• Volumen\n\n' +
          'Cuando convergen los indicadores recibes una señal con botones <b>[COMPRAR]</b> / <b>[CANCELAR]</b>.\n\n' +
          '/status — Estado\n/signals — Señales recientes\n/help — Esta ayuda',
          { parse_mode: 'HTML' },
        );
      }
    });
  }

  private async registerWebhook() {
    if (!this.bot) return;

    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL;
    if (!domain) {
      this.logger.warn('RAILWAY_PUBLIC_DOMAIN not set — webhook not registered. Button callbacks will not work.');
      return;
    }

    const url = `https://${domain}/webhook/telegram`;
    try {
      await this.bot.setWebHook(url);
      this.logger.log(`Webhook registered: ${url}`);
    } catch (error) {
      this.logger.error(`Failed to register webhook: ${error.message}`);
    }
  }

  async sendSignalNotification(msg: SignalMessage): Promise<number | null> {
    if (!this.bot) {
      this.logger.error('Cannot send signal — bot not initialized (check TELEGRAM_BOT_TOKEN)');
      return null;
    }
    if (!this.chatId) {
      this.logger.error('Cannot send signal — TELEGRAM_CHAT_ID not set');
      return null;
    }

    try {
      const emoji = msg.signalType === 'BUY' ? '🟢' : '🔴';
      const text =
        `${emoji} <b>Señal ${msg.signalType} detectada</b>\n\n` +
        `📊 Símbolo: <b>${msg.symbol}</b>\n` +
        `💹 Precio: <b>$${msg.price}</b>\n\n` +
        `📈 Indicadores:\n` +
        `  • RSI: ${msg.rsi}\n` +
        `  • MACD: ${msg.macd}\n` +
        `  • MA50: $${msg.ma50}\n` +
        `  • MA200: $${msg.ma200}\n\n` +
        `📝 Análisis: ${msg.reasoning}\n\n` +
        `¿Ejecutar la orden?`;

      const sent = await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: `✅ ${msg.signalType}`, callback_data: `order_${msg.signalType.toLowerCase()}_${msg.signalId}` },
            { text: '❌ Cancelar', callback_data: `cancel_${msg.signalId}` },
          ]],
        },
      });

      this.logger.log(`Signal sent to Telegram: message_id=${sent.message_id} symbol=${msg.symbol} type=${msg.signalType}`);
      return sent.message_id;
    } catch (error) {
      this.logger.error(`sendSignalNotification(${msg.symbol}): ${error.message}`);
      return null;
    }
  }

  async sendOrderConfirmation(symbol: string, type: string, quantity: string, price: string): Promise<void> {
    if (!this.bot || !this.chatId) return;
    try {
      const emoji = type === 'BUY' ? '🟢' : '🔴';
      await this.bot.sendMessage(this.chatId,
        `${emoji} <b>Orden Ejecutada</b>\n\n` +
        `📊 <b>${symbol}</b>\n` +
        `📈 Tipo: ${type}\n` +
        `📦 Cantidad: ${quantity}\n` +
        `💰 Precio: $${price}`,
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(`sendOrderConfirmation: ${error.message}`);
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.answerCallbackQuery(callbackQueryId, { text, show_alert: showAlert });
    } catch (error) {
      this.logger.error(`answerCallbackQuery: ${error.message}`);
    }
  }

  async processUpdate(update: any): Promise<void> {
    if (!this.bot) return;
    try {
      this.bot.processUpdate(update);
    } catch (error) {
      this.logger.error(`processUpdate: ${error.message}`);
    }
  }
}
