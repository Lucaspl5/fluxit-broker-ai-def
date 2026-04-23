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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TelegramController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const telegram_service_1 = require("../services/telegram.service");
const order_service_1 = require("../services/order.service");
const signal_service_1 = require("../services/signal.service");
const prisma_service_1 = require("../prisma/prisma.service");
let TelegramController = TelegramController_1 = class TelegramController {
    telegramService;
    orderService;
    signalService;
    prisma;
    logger = new common_1.Logger(TelegramController_1.name);
    constructor(telegramService, orderService, signalService, prisma) {
        this.telegramService = telegramService;
        this.orderService = orderService;
        this.signalService = signalService;
        this.prisma = prisma;
    }
    async handleWebhook(update) {
        try {
            await this.telegramService.processUpdate(update);
            if (update.callback_query) {
                const callbackQuery = update.callback_query;
                const data = callbackQuery.data;
                const callbackQueryId = callbackQuery.id;
                this.logger.log(`Callback query received: ${data}`);
                if (data.startsWith('order_buy_') || data.startsWith('order_sell_')) {
                    const parts = data.split('_');
                    const orderType = parts[1].toUpperCase();
                    const signalId = parts.slice(2).join('_');
                    const signal = await this.prisma.signal.findUnique({
                        where: { id: signalId },
                    });
                    if (!signal) {
                        await this.telegramService.answerCallbackQuery(callbackQueryId, 'Signal not found', true);
                        return { success: false };
                    }
                    const order = await this.orderService.createPendingOrder(signalId, signal.symbol, orderType, 1, signal.current_price.toNumber());
                    const executed = await this.orderService.authorizeAndExecuteOrder(order.id);
                    if (executed) {
                        await this.telegramService.answerCallbackQuery(callbackQueryId, `✅ ${orderType} order executed!`, true);
                    }
                    else {
                        await this.telegramService.answerCallbackQuery(callbackQueryId, '❌ Order execution failed', true);
                    }
                }
                else if (data.startsWith('cancel_')) {
                    const signalId = data.split('_').slice(1).join('_');
                    await this.telegramService.answerCallbackQuery(callbackQueryId, 'Order cancelled', false);
                }
            }
            return { success: true };
        }
        catch (error) {
            this.logger.error(`Error processing webhook: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
};
exports.TelegramController = TelegramController;
__decorate([
    (0, common_1.Post)('telegram'),
    (0, swagger_1.ApiOperation)({
        summary: 'Telegram webhook handler',
        description: 'Receives updates from Telegram bot including callback queries from buy/sell buttons',
    }),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Webhook processed successfully',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TelegramController.prototype, "handleWebhook", null);
exports.TelegramController = TelegramController = TelegramController_1 = __decorate([
    (0, common_1.Controller)('webhook'),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService,
        order_service_1.OrderService,
        signal_service_1.SignalService,
        prisma_service_1.PrismaService])
], TelegramController);
//# sourceMappingURL=telegram.controller.js.map