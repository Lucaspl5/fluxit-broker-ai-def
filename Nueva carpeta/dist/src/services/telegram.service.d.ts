import TelegramBot from 'node-telegram-bot-api';
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
export declare class TelegramService {
    private prisma;
    private readonly logger;
    private bot;
    private chatId;
    constructor(prisma: PrismaService);
    private initializeBot;
    sendSignalNotification(message: TelegramSignalMessage): Promise<number | null>;
    sendOrderConfirmation(symbol: string, type: string, quantity: string, price: string): Promise<void>;
    sendPerformanceUpdate(symbol: string, entryPrice: string, currentPrice: string, plPercent: string): Promise<void>;
    onCallbackQuery(callback: (query: TelegramBot.CallbackQuery) => Promise<void>): void;
    answerCallbackQuery(callbackQueryId: string, text: string, showAlert?: boolean): Promise<void>;
    registerWebhook(webhookUrl: string): Promise<boolean>;
    processUpdate(update: any): Promise<void>;
}
export {};
