import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { configuration } from '@prisma/client';

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get or create default configuration for a symbol
   */
  async ensureConfiguration(symbol: string): Promise<configuration> {
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
          required_convergence: 2,
        },
      });

      this.logger.log(`Created configuration for symbol: ${symbol}`);
    }

    return config;
  }

  /**
   * Get all enabled configurations
   */
  async getEnabledConfigurations(): Promise<configuration[]> {
    return this.prisma.configuration.findMany({
      where: { enabled: true },
    });
  }

  /**
   * Update configuration
   */
  async updateConfiguration(
    symbol: string,
    updates: Partial<configuration>,
  ): Promise<configuration> {
    const config = await this.prisma.configuration.update({
      where: { symbol },
      data: updates,
    });

    this.logger.log(`Updated configuration for symbol: ${symbol}`);
    return config;
  }

  /**
   * Get configuration by symbol
   */
  async getConfiguration(symbol: string): Promise<configuration | null> {
    return this.prisma.configuration.findUnique({
      where: { symbol },
    });
  }

  /**
   * Disable configuration
   */
  async disableConfiguration(symbol: string): Promise<configuration> {
    return this.prisma.configuration.update({
      where: { symbol },
      data: { enabled: false },
    });
  }
}
