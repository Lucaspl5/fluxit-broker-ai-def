"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TechnicalAnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicalAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const technicalindicators_1 = require("technicalindicators");
let TechnicalAnalysisService = TechnicalAnalysisService_1 = class TechnicalAnalysisService {
    logger = new common_1.Logger(TechnicalAnalysisService_1.name);
    calculateIndicators(prices, volumes, rsiPeriod = 14, macdFast = 12, macdSlow = 26, macdSignal = 9, ma50Period = 50, ma200Period = 200) {
        try {
            if (prices.length < Math.max(ma200Period, macdSlow + macdSignal - 1)) {
                this.logger.warn(`Insufficient price data: ${prices.length} candles, need at least ${Math.max(ma200Period, macdSlow + macdSignal - 1)}`);
                return null;
            }
            const rsiValues = technicalindicators_1.RSI.calculate({
                values: prices,
                period: rsiPeriod,
            });
            const macdResult = technicalindicators_1.MACD.calculate({
                values: prices,
                fastPeriod: macdFast,
                slowPeriod: macdSlow,
                signalPeriod: macdSignal,
                SimpleMAOscillator: false,
                SimpleMASignal: false,
            });
            const ma50Values = technicalindicators_1.SMA.calculate({
                values: prices,
                period: ma50Period,
            });
            const ma200Values = technicalindicators_1.SMA.calculate({
                values: prices,
                period: ma200Period,
            });
            const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
            const macdData = macdResult.length > 0 ? macdResult[macdResult.length - 1] : null;
            const ma50 = ma50Values.length > 0 ? ma50Values[ma50Values.length - 1] : prices[prices.length - 1];
            const ma200 = ma200Values.length > 0 ? ma200Values[ma200Values.length - 1] : prices[prices.length - 1];
            const currentPrice = prices[prices.length - 1];
            return {
                rsi,
                macd: macdData?.MACD ?? 0,
                macdSignal: macdData?.signal ?? 0,
                ma50,
                ma200,
                currentPrice,
            };
        }
        catch (error) {
            this.logger.error(`Error calculating indicators: ${error.message}`);
            return null;
        }
    }
    detectConvergenceSignal(indicators, rsiOverbought = 70, rsiOversold = 30, requiredConvergence = 3, volumeRatio = 1) {
        const bullishSignals = [];
        const bearishSignals = [];
        if (indicators.rsi < rsiOversold) {
            bullishSignals.push('RSI is oversold (<30)');
        }
        else if (indicators.rsi > rsiOverbought) {
            bearishSignals.push('RSI is overbought (>70)');
        }
        const macdDiff = indicators.macd - indicators.macdSignal;
        if (macdDiff > 0) {
            bullishSignals.push('MACD is above signal line');
        }
        else if (macdDiff < 0) {
            bearishSignals.push('MACD is below signal line');
        }
        const currentPrice = indicators.currentPrice;
        if (currentPrice > indicators.ma50) {
            bullishSignals.push('Price is above MA50');
        }
        else if (currentPrice < indicators.ma50) {
            bearishSignals.push('Price is below MA50');
        }
        if (currentPrice > indicators.ma200) {
            bullishSignals.push('Price is above MA200');
        }
        else if (currentPrice < indicators.ma200) {
            bearishSignals.push('Price is below MA200');
        }
        if (volumeRatio > 1.2) {
            if (bullishSignals.length > bearishSignals.length) {
                bullishSignals.push(`High volume (+${(volumeRatio * 100 - 100).toFixed(0)}%)`);
            }
            else if (bearishSignals.length > bullishSignals.length) {
                bearishSignals.push(`High volume (+${(volumeRatio * 100 - 100).toFixed(0)}%)`);
            }
        }
        if (bullishSignals.length >= requiredConvergence) {
            return {
                type: 'BUY',
                convergentCount: bullishSignals.length,
                reasoning: bullishSignals.join('; '),
            };
        }
        else if (bearishSignals.length >= requiredConvergence) {
            return {
                type: 'SELL',
                convergentCount: bearishSignals.length,
                reasoning: bearishSignals.join('; '),
            };
        }
        return null;
    }
    formatIndicators(indicators) {
        return `\n📊 Technical Indicators:\n` +
            `  • RSI(14): ${indicators.rsi.toFixed(2)}\n` +
            `  • MACD: ${indicators.macd.toFixed(4)} (Signal: ${indicators.macdSignal.toFixed(4)})\n` +
            `  • MA50: $${indicators.ma50.toFixed(2)}\n` +
            `  • MA200: $${indicators.ma200.toFixed(2)}\n` +
            `  • Current Price: $${indicators.currentPrice.toFixed(2)}`;
    }
};
exports.TechnicalAnalysisService = TechnicalAnalysisService;
exports.TechnicalAnalysisService = TechnicalAnalysisService = TechnicalAnalysisService_1 = __decorate([
    (0, common_1.Injectable)()
], TechnicalAnalysisService);
//# sourceMappingURL=technical-analysis.service.js.map