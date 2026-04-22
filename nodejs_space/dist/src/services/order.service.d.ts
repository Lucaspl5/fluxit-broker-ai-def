import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import { TelegramService } from './telegram.service';
import { ConfigurationService } from './configuration.service';
import { order as OrderModel } from '@prisma/client';
export declare class OrderService {
    private prisma;
    private alpaca;
    private telegram;
    private configuration;
    private readonly logger;
    constructor(prisma: PrismaService, alpaca: AlpacaService, telegram: TelegramService, configuration: ConfigurationService);
    createPendingOrder(signalId: string, symbol: string, orderType: 'BUY' | 'SELL', quantity: number, currentPrice: number): Promise<OrderModel>;
    authorizeAndExecuteOrder(orderId: string): Promise<boolean>;
    cancelOrder(orderId: string): Promise<boolean>;
    getPendingOrders(): Promise<OrderModel[]>;
    getOrdersBySymbol(symbol: string, limit?: number): Promise<OrderModel[]>;
    getAllOrders(limit?: number): Promise<OrderModel[]>;
}
