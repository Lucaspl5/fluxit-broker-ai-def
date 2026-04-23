import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SignalService } from '../services/signal.service';

@Controller('signals')
export class SignalsController {
  private readonly logger = new Logger(SignalsController.name);

  constructor(private signalService: SignalService) {}

  @Get()
  @ApiOperation({
    summary: 'Get recent signals',
    description: 'Retrieve recent trading signals from technical analysis',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Maximum number of signals to return (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Signals retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          signal_type: { type: 'string', enum: ['BUY', 'SELL'] },
          rsi: { type: 'number' },
          macd: { type: 'number' },
          ma50: { type: 'number' },
          ma200: { type: 'number' },
          current_price: { type: 'number' },
          reasoning: { type: 'string' },
          timestamp: { type: 'string' },
        },
      },
    },
  })
  async getRecentSignals(@Query('limit') limit?: string): Promise<any[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const signals = await this.signalService.getRecentSignals(parsedLimit);
    return signals.map((s) => ({
      ...s,
      rsi: parseFloat(s.rsi.toString()),
      macd: parseFloat(s.macd.toString()),
      macd_signal: parseFloat(s.macd_signal.toString()),
      ma50: parseFloat(s.ma50.toString()),
      ma200: parseFloat(s.ma200.toString()),
      current_price: parseFloat(s.current_price.toString()),
      volume_ratio: parseFloat(s.volume_ratio.toString()),
    }));
  }

  @Get(':symbol')
  @ApiOperation({
    summary: 'Get signals for a specific symbol',
    description: 'Retrieve trading signals for a particular stock symbol',
  })
  @ApiParam({
    name: 'symbol',
    required: true,
    description: 'Stock symbol (e.g., AAPL, GOOGL)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Maximum number of signals to return (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Signals retrieved successfully',
  })
  async getSignalsBySymbol(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const signals = await this.signalService.getSignalsBySymbol(symbol, parsedLimit);
    return signals.map((s) => ({
      ...s,
      rsi: parseFloat(s.rsi.toString()),
      macd: parseFloat(s.macd.toString()),
      macd_signal: parseFloat(s.macd_signal.toString()),
      ma50: parseFloat(s.ma50.toString()),
      ma200: parseFloat(s.ma200.toString()),
      current_price: parseFloat(s.current_price.toString()),
      volume_ratio: parseFloat(s.volume_ratio.toString()),
    }));
  }
}
