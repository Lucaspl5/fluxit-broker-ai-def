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
var SignalsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const signal_service_1 = require("../services/signal.service");
let SignalsController = SignalsController_1 = class SignalsController {
    signalService;
    logger = new common_1.Logger(SignalsController_1.name);
    constructor(signalService) {
        this.signalService = signalService;
    }
    async getRecentSignals(limit) {
        const parsedLimit = limit ? parseInt(limit, 10) : 20;
        const signals = await this.signalService.getRecentSignals(parsedLimit);
        return signals.map((s) => ({
            ...s,
            rsi: parseFloat(s.rsi.toString()),
            macd: parseFloat(s.macd.toString()),
            macd_signal: parseFloat(s.macd_signal.toString()),
            ma50: parseFloat(s.ma50.toString()),
            ma200: parseFloat(s.ma200.toString()),
            current_price: parseFloat(s.current_price.toString()),
            volume_ratio: parseFloat(s.volume_ratio.toString()),
        }));
    }
    async getSignalsBySymbol(symbol, limit) {
        const parsedLimit = limit ? parseInt(limit, 10) : 20;
        const signals = await this.signalService.getSignalsBySymbol(symbol, parsedLimit);
        return signals.map((s) => ({
            ...s,
            rsi: parseFloat(s.rsi.toString()),
            macd: parseFloat(s.macd.toString()),
            macd_signal: parseFloat(s.macd_signal.toString()),
            ma50: parseFloat(s.ma50.toString()),
            ma200: parseFloat(s.ma200.toString()),
            current_price: parseFloat(s.current_price.toString()),
            volume_ratio: parseFloat(s.volume_ratio.toString()),
        }));
    }
};
exports.SignalsController = SignalsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get recent signals',
        description: 'Retrieve recent trading signals from technical analysis',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: 'number',
        description: 'Maximum number of signals to return (default: 20)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Signals retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    symbol: { type: 'string' },
                    signal_type: { type: 'string', enum: ['BUY', 'SELL'] },
                    rsi: { type: 'number' },
                    macd: { type: 'number' },
                    ma50: { type: 'number' },
                    ma200: { type: 'number' },
                    current_price: { type: 'number' },
                    reasoning: { type: 'string' },
                    timestamp: { type: 'string' },
                },
            },
        },
    }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "getRecentSignals", null);
__decorate([
    (0, common_1.Get)(':symbol'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get signals for a specific symbol',
        description: 'Retrieve trading signals for a particular stock symbol',
    }),
    (0, swagger_1.ApiParam)({
        name: 'symbol',
        required: true,
        description: 'Stock symbol (e.g., AAPL, GOOGL)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: 'number',
        description: 'Maximum number of signals to return (default: 20)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Signals retrieved successfully',
    }),
    __param(0, (0, common_1.Param)('symbol')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "getSignalsBySymbol", null);
exports.SignalsController = SignalsController = SignalsController_1 = __decorate([
    (0, common_1.Controller)('signals'),
    __metadata("design:paramtypes", [signal_service_1.SignalService])
], SignalsController);
//# sourceMappingURL=signals.controller.js.map