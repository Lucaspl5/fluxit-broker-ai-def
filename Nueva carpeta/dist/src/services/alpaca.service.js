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
var AlpacaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlpacaService = void 0;
const common_1 = require("@nestjs/common");
const alpaca_trade_api_1 = __importDefault(require("@alpacahq/alpaca-trade-api"));
let AlpacaService = AlpacaService_1 = class AlpacaService {
    logger = new common_1.Logger(AlpacaService_1.name);
    alpaca;
    constructor() {
        const apiKey = process.env.ALPACA_API_KEY;
        const secretKey = process.env.ALPACA_SECRET_KEY;
        if (!apiKey || !secretKey) {
            this.logger.warn('Alpaca API credentials not configured');
            return;
        }
        this.alpaca = new alpaca_trade_api_1.default({
            credentials: {
                key: apiKey,
                secret: secretKey,
            },
            rate_limit: true,
        });
    }
    async getHistoricalData(symbol, timeframe = '1min', limit = 200) {
        try {
            if (!this.alpaca) {
                this.logger.warn('Alpaca not initialized');
                return [];
            }
            const startDate = new Date();
            if (timeframe === '1Day') {
                startDate.setDate(startDate.getDate() - (limit * 2));
            }
            else {
                startDate.setDate(startDate.getDate() - 30);
            }
            const barsIterator = await this.alpaca.getBarsV2(symbol, {
                timeframe,
                limit,
                start: startDate.toISOString().split('T')[0],
            });
            const data = [];
            let count = 0;
            for await (const bar of barsIterator) {
                data.push({
                    timestamp: new Date(bar.Timestamp).getTime(),
                    open: bar.o,
                    high: bar.h,
                    low: bar.l,
                    close: bar.c,
                    volume: bar.v,
                });
                count++;
                if (count >= limit)
                    break;
            }
            return data.sort((a, b) => a.timestamp - b.timestamp);
        }
        catch (error) {
            this.logger.error(`Error fetching historical data for ${symbol}: ${error.message}`);
            return [];
        }
    }
    async getCurrentPrice(symbol) {
        try {
            if (!this.alpaca) {
                return null;
            }
            const quote = await this.alpaca.getLatestQuote(symbol);
            if (quote) {
                return quote.ap || quote.bp || null;
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Error fetching current price for ${symbol}: ${error.message}`);
            return null;
        }
    }
    async executeOrder(orderRequest) {
        try {
            if (!this.alpaca) {
                this.logger.warn('Alpaca not initialized');
                return null;
            }
            const order = await this.alpaca.createOrder({
                symbol: orderRequest.symbol,
                qty: orderRequest.qty,
                side: orderRequest.side,
                type: orderRequest.type,
                time_in_force: 'day',
                limit_price: orderRequest.limit_price,
            });
            this.logger.log(`Order created: ${order.id} for ${orderRequest.symbol} ${orderRequest.side}`);
            return order;
        }
        catch (error) {
            this.logger.error(`Error executing order: ${error.message}`);
            return null;
        }
    }
    async cancelOrder(orderId) {
        try {
            if (!this.alpaca) {
                return false;
            }
            await this.alpaca.cancelOrder(orderId);
            this.logger.log(`Order cancelled: ${orderId}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Error cancelling order: ${error.message}`);
            return false;
        }
    }
    async getOrderStatus(orderId) {
        try {
            if (!this.alpaca) {
                return null;
            }
            const order = await this.alpaca.getOrder(orderId);
            return order;
        }
        catch (error) {
            this.logger.error(`Error getting order status: ${error.message}`);
            return null;
        }
    }
    async getAccount() {
        try {
            if (!this.alpaca) {
                return null;
            }
            const account = await this.alpaca.getAccount();
            return account;
        }
        catch (error) {
            this.logger.error(`Error getting account info: ${error.message}`);
            return null;
        }
    }
};
exports.AlpacaService = AlpacaService;
exports.AlpacaService = AlpacaService = AlpacaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AlpacaService);
//# sourceMappingURL=alpaca.service.js.map