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
var OrderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const alpaca_service_1 = require("./alpaca.service");
const telegram_service_1 = require("./telegram.service");
const configuration_service_1 = require("./configuration.service");
const decimal_js_1 = __importDefault(require("decimal.js"));
let OrderService = OrderService_1 = class OrderService {
    prisma;
    alpaca;
    telegram;
    configuration;
    logger = new common_1.Logger(OrderService_1.name);
    constructor(prisma, alpaca, telegram, configuration) {
        this.prisma = prisma;
        this.alpaca = alpaca;
        this.telegram = telegram;
        this.configuration = configuration;
    }
    async createPendingOrder(signalId, symbol, orderType, quantity, currentPrice) {
        const config = await this.configuration.ensureConfiguration(symbol);
        const stopLossPrice = new decimal_js_1.default(currentPrice).mul(orderType === 'BUY'
            ? new decimal_js_1.default(1).minus(config.stop_loss_pct.div(100))
            : new decimal_js_1.default(1).plus(config.stop_loss_pct.div(100)));
        const takeProfitPrice = new decimal_js_1.default(currentPrice).mul(orderType === 'BUY'
            ? new decimal_js_1.default(1).plus(config.take_profit_pct.div(100))
            : new decimal_js_1.default(1).minus(config.take_profit_pct.div(100)));
        const order = await this.prisma.order.create({
            data: {
                configuration_id: config.id,
                signal_id: signalId,
                symbol: symbol.toUpperCase(),
                order_type: orderType,
                quantity: new decimal_js_1.default(quantity),
                price: new decimal_js_1.default(currentPrice),
                stop_loss_price: stopLossPrice,
                take_profit_price: takeProfitPrice,
                max_risk_eur: config.max_risk_per_trade,
                risk_level: config.risk_profile === 'BAJO' ? 'LOW' : config.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
                status: 'PENDING',
                status_reason: 'Awaiting user authorization',
            },
        });
        this.logger.log(`Pending order created: ${order.id} for ${symbol}`);
        return order;
    }
    async authorizeAndExecuteOrder(orderId) {
        try {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
            });
            if (!order) {
                this.logger.warn(`Order not found: ${orderId}`);
                return false;
            }
            if (order.status !== 'PENDING') {
                this.logger.warn(`Order is not in PENDING status: ${order.id}`);
                return false;
            }
            const alpacaOrder = await this.alpaca.executeOrder({
                symbol: order.symbol,
                qty: order.quantity.toNumber(),
                side: order.order_type.toLowerCase(),
                type: 'market',
            });
            if (!alpacaOrder) {
                this.logger.error(`Failed to execute order on Alpaca: ${order.id}`);
                await this.prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'FAILED' },
                });
                return false;
            }
            const updatedOrder = await this.prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'EXECUTED',
                    alpaca_order_id: alpacaOrder.id,
                    user_authorization_time: new Date(),
                    execution_time: new Date(),
                },
            });
            this.logger.log(`Order executed: ${order.id} on Alpaca: ${alpacaOrder.id}`);
            await this.telegram.sendOrderConfirmation(order.symbol, order.order_type, order.quantity.toFixed(2), order.price.toFixed(2));
            if (order.order_type === 'BUY') {
                await this.prisma.performance.create({
                    data: {
                        configuration_id: order.configuration_id,
                        buy_order_id: order.id,
                        signal_id: order.signal_id || undefined,
                        symbol: order.symbol,
                        entry_price: order.price,
                        entry_time: updatedOrder.execution_time || new Date(),
                        quantity: order.quantity,
                        status: 'OPEN',
                    },
                });
            }
            return true;
        }
        catch (error) {
            this.logger.error(`Error authorizing and executing order: ${error.message}`);
            return false;
        }
    }
    async cancelOrder(orderId) {
        try {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
            });
            if (!order) {
                this.logger.warn(`Order not found: ${orderId}`);
                return false;
            }
            if (order.alpaca_order_id) {
                await this.alpaca.cancelOrder(order.alpaca_order_id);
            }
            await this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'CANCELLED' },
            });
            this.logger.log(`Order cancelled: ${order.id}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Error cancelling order: ${error.message}`);
            return false;
        }
    }
    async getPendingOrders() {
        return this.prisma.order.findMany({
            where: { status: 'PENDING' },
            orderBy: { timestamp: 'desc' },
        });
    }
    async getOrdersBySymbol(symbol, limit = 20) {
        return this.prisma.order.findMany({
            where: { symbol: symbol.toUpperCase() },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    async getAllOrders(limit = 50) {
        return this.prisma.order.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = OrderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        alpaca_service_1.AlpacaService,
        telegram_service_1.TelegramService,
        configuration_service_1.ConfigurationService])
], OrderService);
//# sourceMappingURL=order.service.js.map