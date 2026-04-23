import { Controller, Get, Post, Param, Body, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { ConfigurationService } from '../services/configuration.service';

@Controller('config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private configService: ConfigurationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all configurations',
    description: 'Retrieve monitoring configurations for all symbols',
  })
  @ApiResponse({
    status: 200,
    description: 'Configurations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          enabled: { type: 'boolean' },
          analysis_interval_min: { type: 'number' },
          rsi_period: { type: 'number' },
          rsi_overbought: { type: 'number' },
          rsi_oversold: { type: 'number' },
        },
      },
    },
  })
  async getAllConfigs(): Promise<any[]> {
    return this.configService.getEnabledConfigurations();
  }

  @Get(':symbol')
  @ApiOperation({
    summary: 'Get configuration for a symbol',
    description: 'Retrieve analysis parameters for a specific symbol',
  })
  @ApiParam({
    name: 'symbol',
    required: true,
    description: 'Stock symbol (e.g., AAPL)',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
  })
  async getConfig(@Param('symbol') symbol: string): Promise<any> {
    const config = await this.configService.getConfiguration(symbol);
    if (!config) {
      return { error: 'Configuration not found' };
    }
    return config;
  }

  @Post(':symbol')
  @ApiOperation({
    summary: 'Create or update configuration',
    description: 'Set up monitoring for a symbol with custom parameters',
  })
  @ApiParam({
    name: 'symbol',
    required: true,
    description: 'Stock symbol (e.g., AAPL)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        analysis_interval_min: { type: 'number' },
        rsi_period: { type: 'number' },
        rsi_overbought: { type: 'number' },
        rsi_oversold: { type: 'number' },
        required_convergence: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Configuration created/updated successfully',
  })
  async createOrUpdateConfig(
    @Param('symbol') symbol: string,
    @Body() body: any,
  ): Promise<any> {
    const config = await this.configService.ensureConfiguration(symbol);

    if (Object.keys(body).length > 0) {
      return this.configService.updateConfiguration(symbol, body);
    }

    return config;
  }

  @Post(':symbol/disable')
  @ApiOperation({
    summary: 'Disable monitoring for a symbol',
    description: 'Stop analysis and signal generation for a symbol',
  })
  @ApiParam({
    name: 'symbol',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration disabled successfully',
  })
  async disableConfig(@Param('symbol') symbol: string): Promise<any> {
    return this.configService.disableConfiguration(symbol);
  }
}
