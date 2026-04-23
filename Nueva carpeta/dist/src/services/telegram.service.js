"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var TelegramService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const prisma_service_1 = require("../prisma/prisma.service");
let TelegramService = TelegramService_1 = class TelegramService {
    prisma;
    logger = new common_1.Logger(TelegramService_1.name);
    bot = null;
    chatId = null;
    constructor(prisma) {
        this.prisma = prisma;
        this.initializeBot();
    }
    initializeBot() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!token) {
            this.logger.warn('Telegram bot token not configured');
            return;
        }
        this.bot = new node_telegram_bot_api_1.default(token, { polling: false });
        this.chatId = chatId || null;
        this.bot.on('message', async (msg) => {
            const text = msg.text?.toLowerCase() || '';
            const chat = msg.chat.id.toString();
            if (text === '/start') {
                await this.bot?.sendMessage(chat, '🤖 <b>Broker AI - Fluxit</b>\n\n' +
                    '✅ Bot activo y funcionando\n' +
                    '📊 Monitoreando 13 acciones\n' +
                    '⏱️ Análisis cada 15 minutos\n' +
                    '🔒 Paper Trading activo\n\n' +
                    '<b>Comandos:</b>\n' +
                    '/start - Estado del bot\n' +
                    '/status - Ver estado actual\n' +
                    '/signals - Últimas señales\n' +
                    '/help - Ayuda', { parse_mode: 'HTML' });
            }
            else if (text === '/status') {
                await this.bot?.sendMessage(chat, '📊 <b>Estado del Sistema</b>\n\n' +
                    '🟢 Backend: Activo\n' +
                    '🟢 Alpaca: Conectado (Paper)\n' +
                    '🟢 Análisis: Cada 15 min\n' +
                    '🔒 Convergencia: 4/4 indicadores\n' +
                    '📉 Stop Loss: -2%\n' +
                    '📈 Take Profit: +3-5%\n' +
                    '💰 Max riesgo/trade: €2', { parse_mode: 'HTML' });
            }
            else if (text === '/signals') {
                try {
                    const signals = await this.prisma.signal.findMany({
                        orderBy: { timestamp: 'desc' },
                        take: 5,
                    });
                    if (signals.length === 0) {
                        await this.bot?.sendMessage(chat, '📭 No hay señales generadas aún. El sistema analiza cada 15 minutos.');
                    }
                    else {
                        let msg = '📊 <b>Últimas Señales:</b>\n\n';
                        for (const s of signals) {
                            const emoji = s.signal_type === 'BUY' ? '🟢' : '🔴';
                            msg += `${emoji} ${s.symbol} - ${s.signal_type} - $${Number(s.current_price).toFixed(2)}\n`;
                            msg += `   RSI: ${Number(s.rsi).toFixed(1)} | Convergencia: ${s.convergence_score}/4\n\n`;
                        }
                        await this.bot?.sendMessage(chat, msg, { parse_mode: 'HTML' });
                    }
                }
                catch (e) {
                    await this.bot?.sendMessage(chat, '❌ Error obteniendo señales');
                }
            }
            else if (text === '/help') {
                await this.bot?.sendMessage(chat, '❓ <b>Ayuda - Broker AI</b>\n\n' +
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
                    '/help - Esta ayuda', { parse_mode: 'HTML' });
            }
        });
        this.logger.log('Telegram bot initialized');
    }
    async sendSignalNotification(message) {
        try {
            if (!this.bot || !this.chatId) {
                this.logger.warn('Telegram bot or chat ID not configured');
                return null;
            }
            const emoji = message.signalType === 'BUY' ? '🟢' : '🔴';
            const text = `${emoji} <b>${message.signalType} Signal Generated!</b>\n\n` +
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
        }
        catch (error) {
            this.logger.error(`Error sending signal notification: ${error.message}`);
            return null;
        }
    }
    async sendOrderConfirmation(symbol, type, quantity, price) {
        try {
            if (!this.bot || !this.chatId) {
                return;
            }
            const emoji = type === 'BUY' ? '🟢' : '🔴';
            const text = `${emoji} <b>Order Executed!</b>\n\n` +
                `📊 Symbol: <b>${symbol}</b>\n` +
                `📈 Type: <b>${type}</b>\n` +
                `📦 Quantity: <b>${quantity}</b>\n` +
                `💰 Price: <b>$${price}</b>`;
            await this.bot.sendMessage(this.chatId, text, {
                parse_mode: 'HTML',
            });
            this.logger.log(`Order confirmation sent for ${symbol}`);
        }
        catch (error) {
            this.logger.error(`Error sending order confirmation: ${error.message}`);
        }
    }
    async sendPerformanceUpdate(symbol, entryPrice, currentPrice, plPercent) {
        try {
            if (!this.bot || !this.chatId) {
                return;
            }
            const isProfit = parseFloat(plPercent) >= 0;
            const emoji = isProfit ? '📈' : '📉';
            const text = `${emoji} <b>Position Update</b>\n\n` +
                `📊 Symbol: <b>${symbol}</b>\n` +
                `🔢 Entry Price: <b>$${entryPrice}</b>\n` +
                `💹 Current Price: <b>$${currentPrice}</b>\n` +
                `${emoji} P&L: <b>${plPercent}%</b>`;
            await this.bot.sendMessage(this.chatId, text, {
                parse_mode: 'HTML',
            });
            this.logger.log(`Performance update sent for ${symbol}`);
        }
        catch (error) {
            this.logger.error(`Error sending performance update: ${error.message}`);
        }
    }
    onCallbackQuery(callback) {
        if (!this.bot) {
            this.logger.warn('Telegram bot not initialized');
            return;
        }
        this.bot.on('callback_query', callback);
        this.logger.log('Callback query listener registered');
    }
    async answerCallbackQuery(callbackQueryId, text, showAlert = false) {
        try {
            if (!this.bot) {
                return;
            }
            await this.bot.answerCallbackQuery(callbackQueryId, {
                text,
                show_alert: showAlert,
            });
        }
        catch (error) {
            this.logger.error(`Error answering callback query: ${error.message}`);
        }
    }
    async registerWebhook(webhookUrl) {
        try {
            if (!this.bot) {
                return false;
            }
            await this.bot.setWebHook(webhookUrl);
            this.logger.log(`Webhook registered: ${webhookUrl}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Error registering webhook: ${error.message}`);
            return false;
        }
    }
    async processUpdate(update) {
        try {
            if (!this.bot) {
                return;
            }
            this.bot.processUpdate(update);
        }
        catch (error) {
            this.logger.error(`Error processing update: ${error.message}`);
        }
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = TelegramService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map