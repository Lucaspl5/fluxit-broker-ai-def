import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SignalService } from '../services/signal.service';

const toFloat = (v: any) => parseFloat(v?.toString() ?? '0');

@Controller('signals')
export class SignalsController {
  constructor(private signalService: SignalService) {}

  @Get()
  @ApiOperation({ summary: 'Últimas señales' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecent(@Query('limit') limit?: string) {
    const signals = await this.signalService.getRecentSignals(limit ? +limit : 20);
    return signals.map((s) => ({
      ...s,
      rsi: toFloat(s.rsi), macd: toFloat(s.macd), macd_signal: toFloat(s.macd_signal),
      ma50: toFloat(s.ma50), ma200: toFloat(s.ma200),
      current_price: toFloat(s.current_price), volume_ratio: toFloat(s.volume_ratio),
    }));
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Señales por símbolo' })
  @ApiParam({ name: 'symbol', description: 'Ej: AAPL' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getBySymbol(@Param('symbol') symbol: string, @Query('limit') limit?: string) {
    const signals = await this.signalService.getSignalsBySymbol(symbol, limit ? +limit : 20);
    return signals.map((s) => ({
      ...s,
      rsi: toFloat(s.rsi), macd: toFloat(s.macd), macd_signal: toFloat(s.macd_signal),
      ma50: toFloat(s.ma50), ma200: toFloat(s.ma200),
      current_price: toFloat(s.current_price), volume_ratio: toFloat(s.volume_ratio),
    }));
  }
}
