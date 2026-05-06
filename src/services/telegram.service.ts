import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import TelegramBot = require('node-telegram-bot-api');
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';

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

  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
  ) {}

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
    this.registerHandlers();
    this.logger.log('Telegram bot initialized');
  }

  private mainMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📈 Señales',    callback_data: 'dash_signals' },
          { text: '📋 Órdenes',    callback_data: 'dash_orders' },
        ],
        [
          { text: '💰 Rendimiento', callback_data: 'dash_performance' },
          { text: '📌 Posiciones',  callback_data: 'dash_positions' },
        ],
        [
          { text: '🏦 Cuenta',      callback_data: 'dash_account' },
          { text: '⚙️ Estado',      callback_data: 'dash_status' },
        ],
        [
          { text: '🔄 Actualizar',  callback_data: 'dash_menu' },
        ],
      ],
    };
  }

  private backKeyboard(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: '← Volver al menú', callback_data: 'dash_menu' }]],
    };
  }

  private mainMenuText(): string {
    const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return (
      '📊 <b>BROKER AI — DASHBOARD</b>\n' +
      `🕐 Actualizado: ${now}\n\n` +
      '¿Qué quieres ver?'
    );
  }

  private async buildSignalsText(): Promise<string> {
    const signals = await this.prisma.signal.findMany({
      orderBy: { timestamp: 'desc' },
      take: 8,
    });
    if (signals.length === 0) return '📭 <b>Señales</b>\n\nAún no hay señales. Análisis cada 15 min.';

    let text = '📈 <b>Últimas Señales</b>\n\n';
    for (const s of signals) {
      const e = s.signal_type === 'BUY' ? '🟢' : '🔴';
      const time = new Date(s.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      text += `${e} <b>${s.symbol}</b>  $${Number(s.current_price).toFixed(2)}\n`;
      text += `   RSI ${Number(s.rsi).toFixed(1)} · Score ${s.convergence_score}/5 · ${time}\n\n`;
    }
    return text;
  }

  private async buildOrdersText(): Promise<string> {
    const orders = await this.prisma.order.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
    if (orders.length === 0) return '📋 <b>Órdenes</b>\n\nNo hay órdenes todavía.';

    const statusEmoji: Record<string, string> = {
      PENDING: '⏳', AUTHORIZED: '✅', EXECUTED: '✅', FAILED: '❌', CANCELLED: '🚫',
    };
    let text = '📋 <b>Órdenes Recientes</b>\n\n';
    for (const o of orders) {
      const e = statusEmoji[o.status] ?? '❓';
      const side = o.order_type === 'BUY' ? '🟢' : '🔴';
      const time = new Date(o.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      text += `${side} <b>${o.symbol}</b>  ${e} ${o.status}\n`;
      text += `   $${Number(o.price).toFixed(2)} · ${Number(o.quantity).toFixed(2)} acc · ${time}\n\n`;
    }
    return text;
  }

  private async buildPerformanceText(): Promise<string> {
    const perfs = await this.prisma.performance.findMany({ orderBy: { entry_time: 'desc' }, take: 20 });
    if (perfs.length === 0) return '💰 <b>Rendimiento</b>\n\nAún no hay operaciones cerradas.';

    const closed = perfs.filter(p => p.status === 'CLOSED' && p.profit_loss != null);
    const open   = perfs.filter(p => p.status === 'OPEN');
    const totalPL = closed.reduce((acc, p) => acc + Number(p.profit_loss), 0);
    const wins    = closed.filter(p => Number(p.profit_loss) > 0).length;
    const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

    let text = '💰 <b>Rendimiento</b>\n\n';
    text += `📊 Operaciones cerradas: ${closed.length}\n`;
    text += `🏆 Tasa de acierto: ${winRate}%\n`;
    text += `💵 P&L Total: ${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}\n`;
    text += `📌 Posiciones abiertas: ${open.length}\n\n`;

    if (closed.length > 0) {
      text += '<b>Últimas cerradas:</b>\n';
      for (const p of closed.slice(0, 5)) {
        const pl = Number(p.profit_loss);
        const plPct = Number(p.profit_loss_pct ?? 0);
        const e = pl >= 0 ? '✅' : '❌';
        text += `${e} <b>${p.symbol}</b>  ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)\n`;
      }
    }
    return text;
  }

  private async buildPositionsView(): Promise<{ text: string; keyboard: TelegramBot.InlineKeyboardMarkup }> {
    const positions = await this.prisma.performance.findMany({
      where: { status: 'OPEN' },
      include: { buy_order: true },
      orderBy: { entry_time: 'desc' },
    });

    if (positions.length === 0) {
      return {
        text: '📌 <b>Posiciones Abiertas</b>\n\nNo hay posiciones abiertas.',
        keyboard: this.backKeyboard(),
      };
    }

    let text = '📌 <b>Posiciones Abiertas</b>\n\n';
    const closeButtons: TelegramBot.InlineKeyboardButton[][] = [];

    for (const p of positions) {
      const entry = new Date(p.entry_time).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      text += `🟢 <b>${p.symbol}</b>\n`;
      text += `   Entrada: $${Number(p.entry_price).toFixed(2)}\n`;
      text += `   Cantidad: ${Number(p.quantity).toFixed(2)} acc\n`;
      text += `   SL: $${Number(p.buy_order.stop_loss_price ?? 0).toFixed(2)}  TP: $${Number(p.buy_order.take_profit_price ?? 0).toFixed(2)}\n`;
      text += `   Desde: ${entry}\n\n`;
      closeButtons.push([{ text: `🔴 Cerrar ${p.symbol}`, callback_data: `close_pos_${p.id}` }]);
    }

    closeButtons.push([{ text: '← Volver al menú', callback_data: 'dash_menu' }]);
    return { text, keyboard: { inline_keyboard: closeButtons } };
  }

  private async buildAccountText(): Promise<string> {
    const account = await this.alpaca.getAccount();
    if (!account) return '🏦 <b>Cuenta Alpaca</b>\n\n❌ No se pudo conectar con Alpaca.';

    const equity   = Number(account.equity ?? 0);
    const cash     = Number(account.cash ?? 0);
    const pl       = Number(account.unrealized_pl ?? 0);
    const plPct    = Number(account.unrealized_plpc ?? 0) * 100;
    const buying   = Number(account.buying_power ?? 0);

    return (
      '🏦 <b>Cuenta Alpaca (Paper)</b>\n\n' +
      `💼 Patrimonio: $${equity.toFixed(2)}\n` +
      `💵 Efectivo: $${cash.toFixed(2)}\n` +
      `📈 P&L No realizado: ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)\n` +
      `🛒 Poder de compra: $${buying.toFixed(2)}\n\n` +
      `🔒 Modo: Paper Trading`
    );
  }

  private buildStatusText(): string {
    return (
      '⚙️ <b>Estado del Sistema</b>\n\n' +
      '🟢 Backend: Activo\n' +
      '🟢 Alpaca: Paper Trading\n' +
      '🟢 Análisis: Cada 15 min\n' +
      '📉 Stop Loss: -2%\n' +
      '📈 Take Profit: +4%\n' +
      '💰 Máx riesgo/trade: $2\n' +
      '🎯 Convergencia mínima: 2 indicadores\n' +
      '📊 Símbolos: 13 acciones monitoreadas'
    );
  }

  private registerHandlers() {
    if (!this.bot) return;

    const sendMenu = async (chatId: string) => {
      try {
        await this.bot!.sendMessage(chatId, this.mainMenuText(), {
          parse_mode: 'HTML',
          reply_markup: this.mainMenuKeyboard(),
        });
      } catch (e) {
        this.logger.error(`sendMenu error: ${e.message}`);
      }
    };

    this.bot.onText(/^\/(start|menu)(@\S+)?$/i, async (msg) => {
      this.logger.log(`Command received: ${msg.text} from chat ${msg.chat.id}`);
      await sendMenu(String(msg.chat.id));
    });

    this.bot.onText(/^\/help(@\S+)?$/i, async (msg) => {
      const chat = String(msg.chat.id);
      try {
        await this.bot!.sendMessage(chat,
          '❓ <b>Ayuda — Broker AI</b>\n\n' +
          'Analiza 13 acciones cada 15 minutos con 4 indicadores:\n' +
          '• RSI  • MACD  • MA50/MA200  • Volumen\n\n' +
          'Cuando convergen los indicadores recibes una señal BUY/SELL con botones para autorizar o cancelar la orden.\n\n' +
          '<b>Comandos:</b>\n' +
          '/menu — Dashboard principal\n' +
          '/help — Esta ayuda',
          { parse_mode: 'HTML' },
        );
      } catch (e) {
        this.logger.error(`sendHelp error: ${e.message}`);
      }
    });

    this.bot.on('callback_query', async (query) => {
      if (!this.bot || !query.message) return;
      const chat  = String(query.message.chat.id);
      const msgId = query.message.message_id;
      const data  = query.data || '';

      try {
        await this.bot.answerCallbackQuery(query.id);
      } catch (_) {}

      try {
        if (data === 'dash_menu') {
          await this.bot.editMessageText(this.mainMenuText(), {
            chat_id: chat, message_id: msgId,
            parse_mode: 'HTML', reply_markup: this.mainMenuKeyboard(),
          });
          return;
        }

        if (data.startsWith('order_') || data.startsWith('cancel_')) {
          await this.handleOrderCallback(query, data, chat, msgId);
          return;
        }

        if (data.startsWith('close_pos_')) {
          await this.handleClosePosition(data, chat, msgId);
          return;
        }

        if (data === 'dash_positions') {
          const { text, keyboard } = await this.buildPositionsView();
          await this.bot.editMessageText(text, {
            chat_id: chat, message_id: msgId,
            parse_mode: 'HTML', reply_markup: keyboard,
          });
          return;
        }

        let sectionText = '';
        switch (data) {
          case 'dash_signals':     sectionText = await this.buildSignalsText();     break;
          case 'dash_orders':      sectionText = await this.buildOrdersText();      break;
          case 'dash_performance': sectionText = await this.buildPerformanceText(); break;
          case 'dash_account':     sectionText = await this.buildAccountText();     break;
          case 'dash_status':      sectionText = this.buildStatusText();            break;
          default: return;
        }

        await this.bot.editMessageText(sectionText, {
          chat_id: chat, message_id: msgId,
          parse_mode: 'HTML', reply_markup: this.backKeyboard(),
        });
      } catch (e) {
        this.logger.error(`callback_query [${data}] error: ${e.message}`);
        try {
          await this.bot!.sendMessage(chat, `❌ Error procesando la acción. Intenta de nuevo.`);
        } catch (_) {}
      }
    });
  }

  private async handleClosePosition(data: string, chat: string, msgId: number): Promise<void> {
    if (!this.bot) return;
    const perfId = data.replace('close_pos_', '');

    const perf = await this.prisma.performance.findUnique({
      where: { id: perfId },
      include: { buy_order: true },
    });

    if (!perf || perf.status !== 'OPEN') {
      await this.bot.editMessageText('⚠️ Esta posición ya fue cerrada.', {
        chat_id: chat, message_id: msgId, reply_markup: this.backKeyboard(),
      });
      return;
    }

    await this.bot.editMessageText(
      `⏳ <b>Cerrando ${perf.symbol}...</b>`,
      { chat_id: chat, message_id: msgId, parse_mode: 'HTML' },
    );

    const alpacaOrder = await this.alpaca.executeOrder({
      symbol: perf.symbol,
      qty: Number(perf.quantity),
      side: 'sell',
      type: 'market',
    });

    const latestPrice = await this.alpaca.getLatestPrice(perf.symbol);
    const exitPrice = latestPrice ?? Number(perf.entry_price);
    const entry     = Number(perf.entry_price);
    const qty       = Number(perf.quantity);
    const pl        = (exitPrice - entry) * qty;
    const plPct     = ((exitPrice - entry) / entry) * 100;
    const exitTime  = new Date();
    const duration  = Math.floor((exitTime.getTime() - new Date(perf.entry_time).getTime()) / 1000);

    await this.prisma.performance.update({
      where: { id: perfId },
      data: {
        exit_price: exitPrice,
        exit_time: exitTime,
        profit_loss: pl,
        profit_loss_pct: plPct,
        duration_seconds: duration,
        status: 'CLOSED',
      },
    });

    await this.prisma.order.create({
      data: {
        configuration_id: perf.configuration_id,
        symbol: perf.symbol,
        order_type: 'SELL',
        quantity: perf.quantity,
        price: exitPrice,
        max_risk_eur: perf.buy_order.max_risk_eur,
        status: alpacaOrder ? 'EXECUTED' : 'CANCELLED',
        alpaca_order_id: alpacaOrder?.id,
        execution_time: exitTime,
        notes: alpacaOrder
          ? 'Closed manually via Telegram dashboard'
          : 'Closed manually (market closed — Alpaca order pending)',
      },
    });

    const plEmoji = pl >= 0 ? '✅' : '❌';
    const alpacaNote = alpacaOrder ? '' : '\n⚠️ <i>Mercado cerrado: posición cerrada en el sistema. La orden en Alpaca se ejecutará en la apertura.</i>';
    const { text, keyboard } = await this.buildPositionsView();
    await this.bot.editMessageText(
      `${plEmoji} <b>${perf.symbol} cerrada</b>  P&L: ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)${alpacaNote}\n\n` + text,
      { chat_id: chat, message_id: msgId, parse_mode: 'HTML', reply_markup: keyboard },
    );

    this.logger.log(`Position manually closed: ${perf.symbol} P&L=${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}`);
  }

  private async handleOrderCallback(
    query: TelegramBot.CallbackQuery,
    data: string,
    chat: string,
    msgId: number,
  ) {
    if (!this.bot || !query.message) return;

    if (data.startsWith('order_')) {
      const parts = data.split('_');
      const orderSide = parts[1] as 'buy' | 'sell';
      const signalId = parts.slice(2).join('_');

      // Look up the signal to get order details
      const signal = await this.prisma.signal.findUnique({
        where: { id: signalId },
        include: { configuration: true },
      });

      if (!signal) {
        await this.bot.editMessageText('⚠️ Esta señal no existe.', {
          chat_id: chat, message_id: msgId, reply_markup: this.backKeyboard(),
        });
        return;
      }

      // Block BUY if already have open position for this symbol
      // Use upsert-style atomic check to prevent race condition on double-tap
      if (orderSide === 'buy') {
        const existing = await this.prisma.performance.findFirst({
          where: { symbol: signal.symbol, status: 'OPEN' },
        });
        if (existing) {
          await this.bot.editMessageText(
            `⚠️ Ya tienes una posición abierta en <b>${signal.symbol}</b>. Ciérrala primero.`,
            { chat_id: chat, message_id: msgId, parse_mode: 'HTML', reply_markup: this.backKeyboard() },
          );
          return;
        }
        // Also block if there's already an order for this exact signal
        const sameSignalOrder = await this.prisma.order.findFirst({
          where: { signal_id: signalId, order_type: 'BUY' },
        });
        if (sameSignalOrder) {
          await this.bot.editMessageText(
            `⚠️ Esta señal de <b>${signal.symbol}</b> ya fue procesada.`,
            { chat_id: chat, message_id: msgId, parse_mode: 'HTML', reply_markup: this.backKeyboard() },
          );
          return;
        }
      }

      // Block SELL if no open position for this symbol
      if (orderSide === 'sell') {
        const openPos = await this.prisma.performance.findFirst({
          where: { symbol: signal.symbol, status: 'OPEN' },
        });
        if (!openPos) {
          await this.bot.editMessageText(
            `⚠️ No tienes posición abierta en <b>${signal.symbol}</b> para vender.`,
            { chat_id: chat, message_id: msgId, parse_mode: 'HTML', reply_markup: this.backKeyboard() },
          );
          return;
        }
      }

      await this.bot.editMessageText(
        query.message.text + '\n\n⏳ <b>Procesando orden...</b>',
        { chat_id: chat, message_id: msgId, parse_mode: 'HTML' },
      );

      const alpacaOrder = await this.alpaca.executeOrder({
        symbol: signal.symbol,
        qty: 1,
        side: orderSide,
        type: 'market',
      });

      const cfg = signal.configuration;
      const price = Number(signal.current_price);
      const slMul = orderSide === 'buy' ? 1 - Number(cfg.stop_loss_pct) / 100 : 1 + Number(cfg.stop_loss_pct) / 100;
      const tpMul = orderSide === 'buy' ? 1 + Number(cfg.take_profit_pct) / 100 : 1 - Number(cfg.take_profit_pct) / 100;

      const savedOrder = await this.prisma.order.create({
        data: {
          configuration_id: cfg.id,
          signal_id: signalId,
          symbol: signal.symbol,
          order_type: orderSide.toUpperCase() as 'BUY' | 'SELL',
          quantity: 1,
          price,
          stop_loss_price: price * slMul,
          take_profit_price: price * tpMul,
          max_risk_eur: cfg.max_risk_per_trade,
          risk_level: cfg.risk_profile === 'BAJO' ? 'LOW' : cfg.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
          status: alpacaOrder ? 'EXECUTED' : 'CANCELLED',
          alpaca_order_id: alpacaOrder?.id,
          user_authorization_time: new Date(),
          execution_time: new Date(),
          status_reason: alpacaOrder ? undefined : 'Market closed — will execute at open',
        },
      });

      const exitTime = new Date();

      if (orderSide === 'buy') {
        await this.prisma.performance.create({
          data: {
            configuration_id: cfg.id,
            buy_order_id: savedOrder.id,
            signal_id: signalId,
            symbol: signal.symbol,
            entry_price: price,
            entry_time: exitTime,
            quantity: 1,
            status: 'OPEN',
          },
        });
      } else {
        const openPerf = await this.prisma.performance.findFirst({
          where: { symbol: signal.symbol, status: 'OPEN' },
          orderBy: { entry_time: 'asc' },
        });
        if (openPerf) {
          const entry   = Number(openPerf.entry_price);
          const pl      = (price - entry) * 1;
          const plPct   = ((price - entry) / entry) * 100;
          const duration = Math.floor((exitTime.getTime() - new Date(openPerf.entry_time).getTime()) / 1000);
          await this.prisma.performance.update({
            where: { id: openPerf.id },
            data: { exit_price: price, exit_time: exitTime, profit_loss: pl, profit_loss_pct: plPct, duration_seconds: duration, status: 'CLOSED' },
          });
        }
      }

      const statusLine = alpacaOrder
        ? '✅ <b>Orden ejecutada.</b>'
        : '✅ <b>Orden registrada.</b>\n⚠️ <i>Mercado cerrado — se ejecutará en la apertura.</i>';

      await this.bot.editMessageText(
        query.message.text + `\n\n${statusLine}`,
        { chat_id: chat, message_id: msgId, parse_mode: 'HTML', reply_markup: this.backKeyboard() },
      );
      this.logger.log(`Order executed via Telegram: signal=${signalId} side=${orderSide} symbol=${signal.symbol}`);

    } else if (data.startsWith('cancel_')) {
      const signalId = data.replace('cancel_', '');

      await this.prisma.order.updateMany({
        where: { signal_id: signalId, status: 'PENDING' },
        data: { status: 'CANCELLED', status_reason: 'Cancelled by user via Telegram' },
      });

      await this.bot.editMessageText(
        query.message.text + '\n\n🚫 <b>Orden cancelada.</b>',
        { chat_id: chat, message_id: msgId, parse_mode: 'HTML', reply_markup: this.backKeyboard() },
      );
    }
  }

  private async registerWebhook() {
    if (!this.bot) return;

    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL;
    if (!domain) {
      this.logger.warn('RAILWAY_PUBLIC_DOMAIN not set — webhook not registered.');
      return;
    }

    const url = `https://${domain}/webhook/telegram`;
    try {
      await this.bot.setWebHook(url);
      const info = await this.bot.getWebHookInfo();
      this.logger.log(`Webhook registered: ${url} | pending_updates: ${info.pending_update_count} | last_error: ${info.last_error_message || 'none'}`);
    } catch (error) {
      this.logger.error(`Failed to register webhook: ${error.message}`);
    }
  }

  async forceRegisterWebhook(): Promise<object> {
    if (!this.bot) return { error: 'Bot not initialized' };

    const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.APP_URL;
    if (!domain) return { error: 'RAILWAY_PUBLIC_DOMAIN not set' };

    const url = `https://${domain}/webhook/telegram`;
    try {
      await this.bot.setWebHook(url);
      const info = await this.bot.getWebHookInfo();
      return { ok: true, url, info };
    } catch (error) {
      return { error: error.message };
    }
  }

  async sendSignalNotification(msg: SignalMessage): Promise<number | null> {
    if (!this.bot) {
      this.logger.error('Cannot send signal — bot not initialized');
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
            { text: '❌ Cancelar',          callback_data: `cancel_${msg.signalId}` },
          ]],
        },
      });

      this.logger.log(`Signal sent: message_id=${sent.message_id} symbol=${msg.symbol}`);
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
        `📦 Cantidad: ${quantity} acc\n` +
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

  async sendAutoClose(symbol: string, reason: string, price: number, pl: number, plPct: number): Promise<void> {
    if (!this.bot || !this.chatId) return;
    try {
      const plEmoji = pl >= 0 ? '✅' : '❌';
      await this.bot.sendMessage(this.chatId,
        `🤖 <b>Cierre automático — ${symbol}</b>\n\n` +
        `📌 Motivo: <b>${reason}</b>\n` +
        `💰 Precio de salida: $${price.toFixed(2)}\n` +
        `${plEmoji} P&L: ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)} (${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%)`,
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error(`sendAutoClose: ${error.message}`);
    }
  }

  async sendWeeklySummary(): Promise<void> {
    if (!this.bot || !this.chatId) return;

    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [signals, orders, perfs] = await Promise.all([
        this.prisma.signal.findMany({ where: { timestamp: { gte: weekAgo } } }),
        this.prisma.order.findMany({ where: { timestamp: { gte: weekAgo } } }),
        this.prisma.performance.findMany({
          where: { status: 'CLOSED', updated_at: { gte: weekAgo } },
        }),
      ]);

      const buySignals  = signals.filter(s => s.signal_type === 'BUY').length;
      const sellSignals = signals.filter(s => s.signal_type === 'SELL').length;
      const executed    = orders.filter(o => o.status === 'EXECUTED').length;
      const cancelled   = orders.filter(o => o.status === 'CANCELLED').length;

      const totalPL  = perfs.reduce((acc, p) => acc + Number(p.profit_loss ?? 0), 0);
      const wins     = perfs.filter(p => Number(p.profit_loss ?? 0) > 0);
      const losses   = perfs.filter(p => Number(p.profit_loss ?? 0) <= 0);
      const winRate  = perfs.length > 0 ? Math.round((wins.length / perfs.length) * 100) : 0;

      const best  = perfs.sort((a, b) => Number(b.profit_loss ?? 0) - Number(a.profit_loss ?? 0))[0];
      const worst = perfs.sort((a, b) => Number(a.profit_loss ?? 0) - Number(b.profit_loss ?? 0))[0];

      const weekLabel = `${weekAgo.getDate()}/${weekAgo.getMonth() + 1} – ${now.getDate()}/${now.getMonth() + 1}`;
      const plEmoji   = totalPL >= 0 ? '✅' : '❌';

      let text =
        `📊 <b>RESUMEN SEMANAL</b>\n` +
        `📅 ${weekLabel}\n\n` +
        `<b>Señales generadas:</b>\n` +
        `  🟢 BUY: ${buySignals}  🔴 SELL: ${sellSignals}  (Total: ${signals.length})\n\n` +
        `<b>Órdenes:</b>\n` +
        `  ✅ Ejecutadas: ${executed}  🚫 Canceladas: ${cancelled}\n\n` +
        `<b>Operaciones cerradas:</b> ${perfs.length}\n` +
        `  🏆 Win rate: ${winRate}%  (${wins.length}W / ${losses.length}L)\n` +
        `  ${plEmoji} P&L total: ${totalPL >= 0 ? '+' : ''}$${totalPL.toFixed(2)}\n`;

      if (best) {
        text += `\n🥇 Mejor trade: <b>${best.symbol}</b> +$${Number(best.profit_loss).toFixed(2)}`;
      }
      if (worst && worst.id !== best?.id) {
        text += `\n📉 Peor trade: <b>${worst.symbol}</b> $${Number(worst.profit_loss).toFixed(2)}`;
      }

      if (perfs.length === 0 && executed === 0) {
        text += `\n\n💤 Semana sin operaciones ejecutadas. El sistema sigue monitoreando.`;
      }

      text += `\n\n/menu para ver el dashboard completo`;

      await this.bot.sendMessage(this.chatId, text, { parse_mode: 'HTML' });
      this.logger.log('Weekly summary sent to Telegram');
    } catch (error) {
      this.logger.error(`sendWeeklySummary: ${error.message}`);
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
