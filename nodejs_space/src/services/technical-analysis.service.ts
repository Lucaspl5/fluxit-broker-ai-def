import { Injectable, Logger } from '@nestjs/common';
import { RSI, MACD, SMA } from 'technicalindicators';
import Decimal from 'decimal.js';

interface IndicatorValues {
  rsi: number;
  macd: number;
  macdSignal: number;
  ma50: number;
  ma200: number;
  currentPrice: number;
}

interface ConvergenceSignal {
  type: 'BUY' | 'SELL';
  convergentCount: number;
  reasoning: string;
}

@Injectable()
export class TechnicalAnalysisService {
  private readonly logger = new Logger(TechnicalAnalysisService.name);

  /**
   * Calculate technical indicators for a given price series
   */
  calculateIndicators(
    prices: number[],
    volumes: number[],
    rsiPeriod: number = 14,
    macdFast: number = 12,
    macdSlow: number = 26,
    macdSignal: number = 9,
    ma50Period: number = 50,
    ma200Period: number = 200,
  ): IndicatorValues | null {
    try {
      if (prices.length < Math.max(ma200Period, macdSlow + macdSignal - 1)) {
        this.logger.warn(
          `Insufficient price data: ${prices.length} candles, need at least ${Math.max(ma200Period, macdSlow + macdSignal - 1)}`,
        );
        return null;
      }

      const rsiValues = RSI.calculate({
        values: prices,
        period: rsiPeriod,
      });

      const macdResult = MACD.calculate({
        values: prices,
        fastPeriod: macdFast,
        slowPeriod: macdSlow,
        signalPeriod: macdSignal,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });

      const ma50Values = SMA.calculate({
        values: prices,
        period: ma50Period,
      });

      const ma200Values = SMA.calculate({
        values: prices,
        period: ma200Period,
      });

      const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
      const macdData =
        macdResult.length > 0 ? macdResult[macdResult.length - 1] : null;
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
    } catch (error) {
      this.logger.error(`Error calculating indicators: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect convergence signals based on technical indicators
   */
  detectConvergenceSignal(
    indicators: IndicatorValues,
    rsiOverbought: number = 70,
    rsiOversold: number = 30,
    requiredConvergence: number = 3,
    volumeRatio: number = 1, // Current volume / average volume
  ): ConvergenceSignal | null {
    const bullishSignals: string[] = [];
    const bearishSignals: string[] = [];

    // RSI Analysis
    if (indicators.rsi < rsiOversold) {
      bullishSignals.push('RSI is oversold (<30)');
    } else if (indicators.rsi > rsiOverbought) {
      bearishSignals.push('RSI is overbought (>70)');
    }

    // MACD Analysis
    const macdDiff = indicators.macd - indicators.macdSignal;
    if (macdDiff > 0) {
      bullishSignals.push('MACD is above signal line');
    } else if (macdDiff < 0) {
      bearishSignals.push('MACD is below signal line');
    }

    // Moving Average Analysis
    const currentPrice = indicators.currentPrice;
    if (currentPrice > indicators.ma50) {
      bullishSignals.push('Price is above MA50');
    } else if (currentPrice < indicators.ma50) {
      bearishSignals.push('Price is below MA50');
    }

    if (currentPrice > indicators.ma200) {
      bullishSignals.push('Price is above MA200');
    } else if (currentPrice < indicators.ma200) {
      bearishSignals.push('Price is below MA200');
    }

    // Volume Analysis
    if (volumeRatio > 1.2) {
      // Volume threshold 120%
      if (bullishSignals.length > bearishSignals.length) {
        bullishSignals.push(`High volume (+${(volumeRatio * 100 - 100).toFixed(0)}%)`);
      } else if (bearishSignals.length > bullishSignals.length) {
        bearishSignals.push(`High volume (+${(volumeRatio * 100 - 100).toFixed(0)}%)`);
      }
    }

    // Determine signal
    if (bullishSignals.length >= requiredConvergence) {
      return {
        type: 'BUY',
        convergentCount: bullishSignals.length,
        reasoning: bullishSignals.join('; '),
      };
    } else if (bearishSignals.length >= requiredConvergence) {
      return {
        type: 'SELL',
        convergentCount: bearishSignals.length,
        reasoning: bearishSignals.join('; '),
      };
    }

    return null;
  }

  /**
   * Format indicators for display
   */
  formatIndicators(indicators: IndicatorValues): string {
    return `\n📊 Technical Indicators:\n` +
      `  • RSI(14): ${indicators.rsi.toFixed(2)}\n` +
      `  • MACD: ${indicators.macd.toFixed(4)} (Signal: ${indicators.macdSignal.toFixed(4)})\n` +
      `  • MA50: $${indicators.ma50.toFixed(2)}\n` +
      `  • MA200: $${indicators.ma200.toFixed(2)}\n` +
      `  • Current Price: $${indicators.currentPrice.toFixed(2)}`;
  }
}
