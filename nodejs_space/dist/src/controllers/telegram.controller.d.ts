import { TelegramService } from '../services/telegram.service';
import { OrderService } from '../services/order.service';
import { SignalService } from '../services/signal.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class TelegramController {
    private telegramService;
    private orderService;
    private signalService;
    private prisma;
    private readonly logger;
    constructor(telegramService: TelegramService, orderService: OrderService, signalService: SignalService, prisma: PrismaService);
    handleWebhook(update: any): Promise<any>;
}
