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
    private ta: TechnicalAnalysisService,
    private telegram: TelegramService,
    private config: ConfigurationService,
  ) {}

  @Cron('*/15 * * * *')
  async scheduledAnalysis(): Promise<void> {
    this.logger.log('Scheduled analysis started');
    const signals = await this.executeAnalysis();
    this.logger.log(`Scheduled analysis finished — ${signals.length} signal(s) generated`);
  }

  @Cron('0 18 * * 5')
  async weeklyReport(): Promise<void> {
    this.logger.log('Sending weekly report to Telegram');
    await this.telegram.sendWeeklySummary();
  }

  @Cron('*/5 * * * *')
  async checkStopLossTakeProfit(): Promise<void> {
    const openPositions = await this.prisma.performance.findMany({
      where: { status: 'OPEN' },
      include: { buy_order: true },
    });
    if (openPositions.length === 0) return;

    for (const pos of openPositions) {
      const currentPrice = await this.alpaca.getLatestPrice(pos.symbol);
      if (!currentPrice) continue;

      const sl = Number(pos.buy_order.stop_loss_price ?? 0);
      const tp = Number(pos.buy_order.take_profit_price ?? 0);

      const hitSL = sl > 0 && currentPrice <= sl;
      const hitTP = tp > 0 && currentPrice >= tp;

      if (!hitSL && !hitTP) continue;

      const reason = hitSL ? 'Stop Loss' : 'Take Profit';
      this.logger.log(`${pos.symbol}: ${reason} triggered at $${currentPrice} (SL=$${sl} TP=$${tp})`);

      const alpacaOrder = await this.alpaca.executeOrder({
        symbol: pos.symbol, qty: Number(pos.quantity), side: 'sell', type: 'market',
      });

      const exitTime = new Date();
      const entry    = Number(pos.entry_price);
      const pl       = (currentPrice - entry) * Number(pos.quantity);
      const plPct    = ((currentPrice - entry) / entry) * 100;
      const duration = Math.floor((exitTime.getTime() - new Date(pos.entry_time).getTime()) / 1000);

      await this.prisma.performance.update({
        where: { id: pos.id },
        data: {
          exit_price: new Decimal(currentPrice),
          exit_time: exitTime,
          profit_loss: new Decimal(pl),
          profit_loss_pct: new Decimal(plPct),
          duration_seconds: duration,
          status: 'CLOSED',
        },
      });

      await this.prisma.order.create({
        data: {
          configuration_id: pos.configuration_id,
          symbol: pos.symbol,
          order_type: 'SELL',
          quantity: pos.quantity,
          price: new Decimal(currentPrice),
          max_risk_eur: pos.buy_order.max_risk_eur,
          status: alpacaOrder ? 'EXECUTED' : 'CANCELLED',
          alpaca_order_id: alpacaOrder?.id,
          execution_time: exitTime,
          notes: `Auto-closed by ${reason}`,
        },
      });

      const plEmoji = pl >= 0 ? '✅' : '❌';
      await this.telegram.sendAutoClose(pos.symbol, reason, currentPrice, pl, plPct);
      this.logger.log(`${pos.symbol} auto-closed (${reason}): P&L=${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}`);
    }
  }

  async executeAnalysis(): Promise<SignalModel[]> {
    const configs = await this.config.getEnabledConfigurations();
    const results: SignalModel[] = [];

    for (const cfg of configs) {
      const signal = await this.analyzeSymbol(cfg.symbol);
      if (signal) results.push(signal);
    }

    return results;
  }

  async analyzeSymbol(symbol: string): Promise<SignalModel | null> {
    try {
      const cfg = await this.config.ensureConfiguration(symbol);

      const bars = await this.alpaca.getHistoricalData(symbol, '1Day', cfg.ma200_period + 50);
      if (bars.length === 0) {
        this.logger.warn(`No market data for ${symbol}`);
        return null;
      }

      const prices = bars.map((b) => b.close);
      const volumes = bars.map((b) => b.volume);
      const currentPrice = prices.at(-1);

      const ind = this.ta.calculateIndicators(
        prices, volumes,
        cfg.rsi_period, cfg.macd_fast_period, cfg.macd_slow_period,
        cfg.macd_signal_period, cfg.ma50_period, cfg.ma200_period,
      );
      if (!ind) return null;

      this.logger.log(
        `${symbol}: price=$${currentPrice.toFixed(2)} RSI=${ind.rsi.toFixed(1)} MACD=${ind.macd.toFixed(4)} MA50=${ind.ma50.toFixed(2)} MA200=${ind.ma200.toFixed(2)}`,
      );

      const recentVol = volumes.slice(-20);
      const avgVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
      const volRatio = volumes.at(-1) / avgVol;

      const convergence = this.ta.detectConvergenceSignal(
        ind, cfg.rsi_overbought, cfg.rsi_oversold, cfg.required_convergence, volRatio,
      );
      if (!convergence) return null;

      // Skip BUY if there's already an open position for this symbol
      if (convergence.type === 'BUY') {
        const openPosition = await this.prisma.performance.findFirst({
          where: { symbol: symbol.toUpperCase(), status: 'OPEN' },
        });
        if (openPosition) {
          this.logger.log(`${symbol}: skipping BUY — already have an open position`);
          return null;
        }
      }

      const saved = await this.prisma.signal.create({
        data: {
          configuration_id: cfg.id,
          symbol: symbol.toUpperCase(),
          signal_type: convergence.type,
          rsi: new Decimal(ind.rsi),
          macd: new Decimal(ind.macd),
          macd_signal: new Decimal(ind.macdSignal),
          macd_divergence: new Decimal(ind.macd - ind.macdSignal),
          ma50: new Decimal(ind.ma50),
          ma200: new Decimal(ind.ma200),
          current_price: new Decimal(currentPrice),
          volume: BigInt(volumes.at(-1)),
          avg_volume: BigInt(Math.round(avgVol)),
          volume_ratio: new Decimal(volRatio),
          convergent_indicators: convergence.convergentCount,
          convergence_score: convergence.convergentCount,
          confidence_level: new Decimal(Math.min(100, 60 + convergence.convergentCount * 10)),
          risk_level: cfg.risk_profile === 'BAJO' ? 'LOW' : cfg.risk_profile === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
          recommendation: this.toRecommendation(convergence.type, convergence.convergentCount),
          reasoning: convergence.reasoning,
        },
      });

      this.logger.log(`Signal saved: ${symbol} ${convergence.type} (${convergence.convergentCount} indicators)`);

      const messageId = await this.telegram.sendSignalNotification({
        symbol,
        signalType: convergence.type,
        price: currentPrice.toFixed(2),
        rsi: ind.rsi.toFixed(2),
        macd: ind.macd.toFixed(4),
        ma50: ind.ma50.toFixed(2),
        ma200: ind.ma200.toFixed(2),
        reasoning: convergence.reasoning,
        signalId: saved.id,
      });

      if (messageId) {
        await this.prisma.signal.update({
          where: { id: saved.id },
          data: { telegram_message_id: messageId },
        });
      }

      return saved;
    } catch (error) {
      this.logger.error(`analyzeSymbol(${symbol}): ${error.message}`);
      return null;
    }
  }

  async getRecentSignals(limit = 20): Promise<SignalModel[]> {
    return this.prisma.signal.findMany({ orderBy: { timestamp: 'desc' }, take: limit });
  }

  async getSignalsBySymbol(symbol: string, limit = 20): Promise<SignalModel[]> {
    return this.prisma.signal.findMany({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  private toRecommendation(type: string, score: number): string {
    if (score >= 4) return type === 'BUY' ? 'STRONG_BUY' : 'STRONG_SELL';
    if (score >= 3) return type === 'BUY' ? 'BUY' : 'SELL';
    return 'NEUTRAL';
  }
}
