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
var PerformanceController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
let PerformanceController = PerformanceController_1 = class PerformanceController {
    prisma;
    logger = new common_1.Logger(PerformanceController_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPerformance(limit) {
        const records = await this.prisma.performance.findMany({
            orderBy: { created_at: 'desc' },
            take: limit || 50,
        });
        return records.map((r) => ({
            ...r,
            entry_price: parseFloat(r.entry_price.toString()),
            exit_price: r.exit_price ? parseFloat(r.exit_price.toString()) : null,
            profit_loss: r.profit_loss ? parseFloat(r.profit_loss.toString()) : null,
            profit_loss_pct: r.profit_loss_pct ? parseFloat(r.profit_loss_pct.toString()) : null,
        }));
    }
    async getPerformanceBySymbol(symbol) {
        const records = await this.prisma.performance.findMany({
            where: { symbol: symbol.toUpperCase() },
            orderBy: { created_at: 'desc' },
        });
        return records.map((r) => ({
            ...r,
            entry_price: parseFloat(r.entry_price.toString()),
            exit_price: r.exit_price ? parseFloat(r.exit_price.toString()) : null,
            profit_loss: r.profit_loss ? parseFloat(r.profit_loss.toString()) : null,
            profit_loss_pct: r.profit_loss_pct ? parseFloat(r.profit_loss_pct.toString()) : null,
        }));
    }
    async getPerformanceSummary() {
        const closedRecords = await this.prisma.performance.findMany({
            where: { status: 'CLOSED' },
        });
        const openRecords = await this.prisma.performance.findMany({
            where: { status: 'OPEN' },
        });
        const totalTrades = closedRecords.length;
        const winningTrades = closedRecords.filter((r) => r.profit_loss_pct && r.profit_loss_pct.toNumber() > 0).length;
        const losingTrades = closedRecords.filter((r) => r.profit_loss_pct && r.profit_loss_pct.toNumber() < 0).length;
        const totalPnL = closedRecords.reduce((sum, r) => sum + (r.profit_loss?.toNumber() || 0), 0);
        const avgPnLPct = totalTrades > 0 ? closedRecords.reduce((sum, r) => sum + (r.profit_loss_pct?.toNumber() || 0), 0) / totalTrades : 0;
        return {
            total_trades: totalTrades,
            open_trades: openRecords.length,
            winning_trades: winningTrades,
            losing_trades: losingTrades,
            win_rate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(2) : '0.00',
            total_profit_loss: totalPnL.toFixed(2),
            avg_profit_loss_pct: avgPnLPct.toFixed(4),
        };
    }
};
exports.PerformanceController = PerformanceController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get performance records',
        description: 'Retrieve P&L performance data for all closed positions',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: 'number',
        description: 'Maximum number of records (default: 50)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Performance records retrieved',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    symbol: { type: 'string' },
                    entry_price: { type: 'number' },
                    exit_price: { type: 'number' },
                    profit_loss: { type: 'number' },
                    profit_loss_pct: { type: 'number' },
                    duration_seconds: { type: 'number' },
                    status: { type: 'string' },
                },
            },
        },
    }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PerformanceController.prototype, "getPerformance", null);
__decorate([
    (0, common_1.Get)('symbol/:symbol'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get performance for a symbol',
        description: 'Retrieve performance data for a specific stock symbol',
    }),
    (0, swagger_1.ApiParam)({
        name: 'symbol',
        description: 'Stock symbol (e.g., AAPL)',
    }),
    __param(0, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PerformanceController.prototype, "getPerformanceBySymbol", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get performance summary statistics',
        description: 'Retrieve aggregated performance metrics',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Summary statistics retrieved',
        schema: {
            type: 'object',
            properties: {
                total_trades: { type: 'number' },
                winning_trades: { type: 'number' },
                losing_trades: { type: 'number' },
                win_rate: { type: 'number' },
                total_profit_loss: { type: 'number' },
                avg_profit_loss_pct: { type: 'number' },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PerformanceController.prototype, "getPerformanceSummary", null);
exports.PerformanceController = PerformanceController = PerformanceController_1 = __decorate([
    (0, common_1.Controller)('performance'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PerformanceController);
//# sourceMappingURL=performance.controller.js.map