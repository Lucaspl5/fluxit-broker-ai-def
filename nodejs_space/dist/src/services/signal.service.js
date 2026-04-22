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
var SignalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const alpaca_service_1 = require("./alpaca.service");
const technical_analysis_service_1 = require("./technical-analysis.service");
const telegram_service_1 = require("./telegram.service");
const configuration_service_1 = require("./configuration.service");
const decimal_js_1 = __importDefault(require("decimal.js"));
let SignalService = SignalService_1 = class SignalService {
    prisma;
    alpaca;
    technicalAnalysis;
    telegram;
    configuration;
    logger = new common_1.Logger(SignalService_1.name);
    constructor(prisma, alpaca, technicalAnalysis, telegram, configuration) {
        this.prisma = prisma;
        this.alpaca = alpaca;
        this.technicalAnalysis = technicalAnalysis;
        this.telegram = telegram;
        this.configuration = configuration;
    }
    async executeAnalysis() {
        const configs = await this.configuration.getEnabledConfigurations();
        const signals = [];
        for (const config of configs) {
            const signal = await this.analyzeSymbol(config.symbol);
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async analyzeSymbol(symbol) {
        try {
            const config = await this.configuration.ensureConfiguration(symbol);
            const bars = await this.alpaca.getHistoricalData(symbol, '1Day', config.ma200_period + 50);
            if (bars.length === 0) {
                this.logger.warn(`No historical data available for ${symbol}`);
                return null;
            }
            const prices = bars.map((b) => b.close);
            const volumes = bars.map((b) => b.volume);
            const currentPrice = prices[prices.length - 1];
            const indicators = this.technicalAnalysis.calculateIndicators(prices, volumes, config.rsi_period, config.macd_fast_period, config.macd_slow_period, config.macd_signal_period, config.ma50_period, config.ma200_period);
            if (!indicators) {
                this.logger.warn(`Could not calculate indicators for ${symbol}`);
                return null;
            }
            this.logger.log(`${symbol}: RSI=${indicators.rsi.toFixed(1)} MACD=${indicators.macd.toFixed(4)} MA50=${indicators.ma50.toFixed(2)} MA200=${indicators.ma200.toFixed(2)} Price=${indicators.currentPrice.toFixed(2)}`);
            const recentVolumes = volumes.slice(-20);
            const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
            const volumeRatio = volumes[volumes.length - 1] / avgVolume;
            const signal = this.technicalAnalysis.detectConvergenceSignal(indicators, config.rsi_overbought, config.rsi_oversold, config.required_convergence, volumeRatio);
            if (!signal) {
                return null;
            }
            const savedSignal = await this.prisma.signal.create({
                data: {
                    configuration_id: config.id,
                    symbol: symbol.toUpperCase(),
                    signal_type: signal.type,
                    rsi: new decimal_js_1.default(indicators.rsi),
                    macd: new decimal_js_1.default(indicators.macd),
                    macd_signal: new decimal_js_1.default(indicators.macdSignal),
                    macd_divergence: new decimal_js_1.default(indicators.macd - indicators.macdSignal),
                    ma50: new decimal_js_1.default(indicators.ma50),
                    ma200: new decimal_js_1.default(indicators.ma200),
                    current_price: new decimal_js_1.default(currentPrice),
                    volume: BigInt(volumes[volumes.length - 1]),
                    avg_volume: BigInt(Math.round(avgVolume)),
                    volume_ratio: new decimal_js_1.default(volumeRatio),
                    convergent_indicators: signal.convergentCount,
                    convergence_score: signal.convergentCount,
                    confidence_level: new decimal_js_1.default(Math.min(100, 60 + (signal.convergentCount * 10))),
                    risk_level: config.risk_profile === 'BAJO' ? 'LOW' : config.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
                    recommendation: this.getRecommendation(signal.type, indicators.rsi, signal.convergentCount),
                    reasoning: signal.reasoning,
                },
            });
            this.logger.log(`Signal generated for ${symbol}: ${signal.type} with ${signal.convergentCount} convergent indicators`);
            const messageId = await this.telegram.sendSignalNotification({
                symbol,
                signalType: signal.type,
                price: currentPrice.toFixed(2),
                rsi: indicators.rsi.toFixed(2),
                macd: indicators.macd.toFixed(4),
                ma50: indicators.ma50.toFixed(2),
                ma200: indicators.ma200.toFixed(2),
                reasoning: signal.reasoning,
                signalId: savedSignal.id,
            });
            if (messageId) {
                await this.prisma.signal.update({
                    where: { id: savedSignal.id },
                    data: { telegram_message_id: messageId },
                });
            }
            return savedSignal;
        }
        catch (error) {
            this.logger.error(`Error analyzing symbol ${symbol}: ${error.message}`);
            return null;
        }
    }
    async getRecentSignals(limit = 20) {
        return this.prisma.signal.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    async getSignalsBySymbol(symbol, limit = 20) {
        return this.prisma.signal.findMany({
            where: { symbol: symbol.toUpperCase() },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    getRecommendation(signalType, rsi, convergenceScore) {
        if (convergenceScore === 4) {
            return signalType === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL';
        }
        if (convergenceScore === 3) {
            return signalType === 'BUY' ? 'BUY' : 'SELL';
        }
        return 'NEUTRAL';
    }
};
exports.SignalService = SignalService;
exports.SignalService = SignalService = SignalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        alpaca_service_1.AlpacaService,
        technical_analysis_service_1.TechnicalAnalysisService,
        telegram_service_1.TelegramService,
        configuration_service_1.ConfigurationService])
], SignalService);
//# sourceMappingURL=signal.service.js.map