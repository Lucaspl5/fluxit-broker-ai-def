import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { configuration } from '@prisma/client';

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(private prisma: PrismaService) {}

  async ensureConfiguration(symbol: string): Promise<configuration> {
    let config = await this.prisma.configuration.findUnique({ where: { symbol } });

    if (!config) {
      config = await this.prisma.configuration.create({
        data: {
          symbol: symbol.toUpperCase(),
          enabled: true,
          required_convergence: 2,
        },
      });
      this.logger.log(`Created default configuration for ${symbol}`);
    }

    return config;
  }

  async getEnabledConfigurations(): Promise<configuration[]> {
    return this.prisma.configuration.findMany({ where: { enabled: true } });
  }

  async getConfiguration(symbol: string): Promise<configuration | null> {
    return this.prisma.configuration.findUnique({ where: { symbol } });
  }

  async updateConfiguration(symbol: string, updates: Partial<configuration>): Promise<configuration> {
    return this.prisma.configuration.update({ where: { symbol }, data: updates });
  }

  async disableConfiguration(symbol: string): Promise<configuration> {
    return this.prisma.configuration.update({ where: { symbol }, data: { enabled: false } });
  }
}
