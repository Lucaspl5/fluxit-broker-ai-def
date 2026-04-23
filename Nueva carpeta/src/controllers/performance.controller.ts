import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@Controller('performance')
export class PerformanceController {
  private readonly logger = new Logger(PerformanceController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Get performance records',
    description: 'Retrieve P&L performance data for all closed positions',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Maximum number of records (default: 50)',
  })
  @ApiResponse({
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
  })
  async getPerformance(@Query('limit') limit?: number): Promise<any[]> {
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

  @Get('symbol/:symbol')
  @ApiOperation({
    summary: 'Get performance for a symbol',
    description: 'Retrieve performance data for a specific stock symbol',
  })
  @ApiParam({
    name: 'symbol',
    description: 'Stock symbol (e.g., AAPL)',
  })
  async getPerformanceBySymbol(@Param('symbol') symbol: string): Promise<any[]> {
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

  @Get('stats/summary')
  @ApiOperation({
    summary: 'Get performance summary statistics',
    description: 'Retrieve aggregated performance metrics',
  })
  @ApiResponse({
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
  })
  async getPerformanceSummary(): Promise<any> {
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
}
