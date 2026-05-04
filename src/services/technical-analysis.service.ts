import { Injectable, Logger } from '@nestjs/common';
import { RSI, MACD, SMA } from 'technicalindicators';

export interface Indicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  ma50: number;
  ma200: number;
  currentPrice: number;
}

export interface ConvergenceSignal {
  type: 'BUY' | 'SELL';
  convergentCount: number;
  reasoning: string;
}

@Injectable()
export class TechnicalAnalysisService {
  private readonly logger = new Logger(TechnicalAnalysisService.name);

  calculateIndicators(
    prices: number[],
    volumes: number[],
    rsiPeriod = 14,
    macdFast = 12,
    macdSlow = 26,
    macdSignalPeriod = 9,
    ma50Period = 50,
    ma200Period = 200,
  ): Indicators | null {
    const minRequired = Math.max(ma200Period, macdSlow + macdSignalPeriod - 1);
    if (prices.length < minRequired) {
      this.logger.warn(`Not enough data for ${prices.length} bars (need ${minRequired})`);
      return null;
    }

    try {
      const rsiValues = RSI.calculate({ values: prices, period: rsiPeriod });
      const macdValues = MACD.calculate({
        values: prices,
        fastPeriod: macdFast,
        slowPeriod: macdSlow,
        signalPeriod: macdSignalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const ma50Values = SMA.calculate({ values: prices, period: ma50Period });
      const ma200Values = SMA.calculate({ values: prices, period: ma200Period });

      const rsi = rsiValues.at(-1) ?? 50;
      const macdData = macdValues.at(-1);
      const ma50 = ma50Values.at(-1) ?? prices.at(-1);
      const ma200 = ma200Values.at(-1) ?? prices.at(-1);

      return {
        rsi,
        macd: macdData?.MACD ?? 0,
        macdSignal: macdData?.signal ?? 0,
        ma50,
        ma200,
        currentPrice: prices.at(-1),
      };
    } catch (error) {
      this.logger.error(`calculateIndicators: ${error.message}`);
      return null;
    }
  }

  detectConvergenceSignal(
    ind: Indicators,
    rsiOverbought = 70,
    rsiOversold = 30,
    requiredConvergence = 2,
    volumeRatio = 1,
  ): ConvergenceSignal | null {
    const bullish: string[] = [];
    const bearish: string[] = [];

    if (ind.rsi < rsiOversold) bullish.push(`RSI oversold (${ind.rsi.toFixed(1)})`);
    else if (ind.rsi > rsiOverbought) bearish.push(`RSI overbought (${ind.rsi.toFixed(1)})`);

    if (ind.macd > ind.macdSignal) bullish.push('MACD above signal');
    else if (ind.macd < ind.macdSignal) bearish.push('MACD below signal');

    if (ind.currentPrice > ind.ma50) bullish.push('Price above MA50');
    else if (ind.currentPrice < ind.ma50) bearish.push('Price below MA50');

    if (ind.currentPrice > ind.ma200) bullish.push('Price above MA200');
    else if (ind.currentPrice < ind.ma200) bearish.push('Price below MA200');

    if (volumeRatio > 1.2) {
      const tag = `High volume (+${((volumeRatio - 1) * 100).toFixed(0)}%)`;
      if (bullish.length > bearish.length) bullish.push(tag);
      else if (bearish.length > bullish.length) bearish.push(tag);
    }

    if (bullish.length >= requiredConvergence) {
      return { type: 'BUY', convergentCount: bullish.length, reasoning: bullish.join('; ') };
    }
    if (bearish.length >= requiredConvergence) {
      return { type: 'SELL', convergentCount: bearish.length, reasoning: bearish.join('; ') };
    }
    return null;
  }
}
