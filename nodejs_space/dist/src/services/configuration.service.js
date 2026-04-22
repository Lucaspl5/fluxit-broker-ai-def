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
var ConfigurationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ConfigurationService = ConfigurationService_1 = class ConfigurationService {
    prisma;
    logger = new common_1.Logger(ConfigurationService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureConfiguration(symbol) {
        let config = await this.prisma.configuration.findUnique({
            where: { symbol },
        });
        if (!config) {
            config = await this.prisma.configuration.create({
                data: {
                    symbol: symbol.toUpperCase(),
                    enabled: true,
                    analysis_interval_min: 15,
                    rsi_period: 14,
                    rsi_overbought: 70,
                    rsi_oversold: 30,
                    macd_fast_period: 12,
                    macd_slow_period: 26,
                    macd_signal_period: 9,
                    ma50_period: 50,
                    ma200_period: 200,
                    volume_threshold_pct: 120,
                    required_convergence: 3,
                },
            });
            this.logger.log(`Created configuration for symbol: ${symbol}`);
        }
        return config;
    }
    async getEnabledConfigurations() {
        return this.prisma.configuration.findMany({
            where: { enabled: true },
        });
    }
    async updateConfiguration(symbol, updates) {
        const config = await this.prisma.configuration.update({
            where: { symbol },
            data: updates,
        });
        this.logger.log(`Updated configuration for symbol: ${symbol}`);
        return config;
    }
    async getConfiguration(symbol) {
        return this.prisma.configuration.findUnique({
            where: { symbol },
        });
    }
    async disableConfiguration(symbol) {
        return this.prisma.configuration.update({
            where: { symbol },
            data: { enabled: false },
        });
    }
};
exports.ConfigurationService = ConfigurationService;
exports.ConfigurationService = ConfigurationService = ConfigurationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConfigurationService);
//# sourceMappingURL=configuration.service.js.map