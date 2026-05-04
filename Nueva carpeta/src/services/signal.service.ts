import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import { TechnicalAnalysisService } from './technical-analysis.service';
import { TelegramService } from './telegram.service';
import { ConfigurationService } from './configuration.service';
import { signal as SignalModel } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class SignalService {
  private readonly logger = new Logger(SignalService.name);

  constructor(
    private prisma: PrismaService,
    private alpaca: AlpacaService,
    private technicalAnalysis: TechnicalAnalysisService,
    private telegram: TelegramService,
    private configuration: ConfigurationService,
  ) {}

  @Cron('*/15 * * * *')
  async scheduledAnalysis(): Promise<void> {
    this.logger.log('Scheduled analysis triggered');
    await this.executeAnalysis();
  }

  /**
   * Execute full analysis for all enabled symbols
   */
  async executeAnalysis(): Promise<SignalModel[]> {
    const configs = await this.configuration.getEnabledConfigurations();
    const signals: SignalModel[] = [];

    for (const config of configs) {
      const signal = await this.analyzeSymbol(config.symbol);
      if (signal) {
        signals.push(signal);
      }
    }

    return signals;
  }

  /**
   * Analyze a single symbol and generate signal if conditions are met
   */
  async analyzeSymbol(symbol: string): Promise<SignalModel | null> {
    try {
      const config = await this.configuration.ensureConfiguration(symbol);

      // Fetch historical data
      const bars = await this.alpaca.getHistoricalData(symbol, '1Day', config.ma200_period + 50);
      if (bars.length === 0) {
        this.logger.warn(`No historical data available for ${symbol}`);
        return null;
      }

      // Extract prices and volumes
      const prices = bars.map((b) => b.close);
      const volumes = bars.map((b) => b.volume);
      const currentPrice = prices[prices.length - 1];

      // Calculate indicators
      const indicators = this.technicalAnalysis.calculateIndicators(
        prices,
        volumes,
        config.rsi_period,
        config.macd_fast_period,
        config.macd_slow_period,
        config.macd_signal_period,
        config.ma50_period,
        config.ma200_period,
      );

      if (!indicators) {
        this.logger.warn(`Could not calculate indicators for ${symbol}`);
        return null;
      }

      this.logger.log(`${symbol}: RSI=${indicators.rsi.toFixed(1)} MACD=${indicators.macd.toFixed(4)} MA50=${indicators.ma50.toFixed(2)} MA200=${indicators.ma200.toFixed(2)} Price=${indicators.currentPrice.toFixed(2)}`);

      // Calculate volume ratio
      const recentVolumes = volumes.slice(-20); // Last 20 bars
      const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
      const volumeRatio = volumes[volumes.length - 1] / avgVolume;

      // Detect convergence signal
      const signal = this.technicalAnalysis.detectConvergenceSignal(
        indicators,
        config.rsi_overbought,
        config.rsi_oversold,
        config.required_convergence,
        volumeRatio,
      );

      if (!signal) {
        return null; // No convergence detected
      }

      // Save signal to database
      const savedSignal = await this.prisma.signal.create({
        data: {
          configuration_id: config.id,
          symbol: symbol.toUpperCase(),
          signal_type: signal.type,
          rsi: new Decimal(indicators.rsi),
          macd: new Decimal(indicators.macd),
          macd_signal: new Decimal(indicators.macdSignal),
          macd_divergence: new Decimal(indicators.macd - indicators.macdSignal),
          ma50: new Decimal(indicators.ma50),
          ma200: new Decimal(indicators.ma200),
          current_price: new Decimal(currentPrice),
          volume: BigInt(volumes[volumes.length - 1]),
          avg_volume: BigInt(Math.round(avgVolume)),
          volume_ratio: new Decimal(volumeRatio),
          convergent_indicators: signal.convergentCount,
          convergence_score: signal.convergentCount,
          confidence_level: new Decimal(Math.min(100, 60 + (signal.convergentCount * 10))),
          risk_level: config.risk_profile === 'BAJO' ? 'LOW' : config.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
          recommendation: this.getRecommendation(signal.type, indicators.rsi, signal.convergentCount),
          reasoning: signal.reasoning,
        },
      });

      this.logger.log(
        `Signal generated for ${symbol}: ${signal.type} with ${signal.convergentCount} convergent indicators`,
      );

      // Send Telegram notification
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
    } catch (error) {
      this.logger.error(`Error analyzing symbol ${symbol}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get recent signals
   */
  async getRecentSignals(limit: number = 20): Promise<SignalModel[]> {
    return this.prisma.signal.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get signals by symbol
   */
  async getSignalsBySymbol(symbol: string, limit: number = 20): Promise<SignalModel[]> {
    return this.prisma.signal.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recommendation based on signal and indicators
   */
  private getRecommendation(signalType: string, rsi: number, convergenceScore: number): string {
    if (convergenceScore === 4) {
      return signalType === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL';
    }
    if (convergenceScore === 3) {
      return signalType === 'BUY' ? 'BUY' : 'SELL';
    }
    return 'NEUTRAL';
  }
}
