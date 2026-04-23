import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignalService } from '../services/signal.service';

@Controller('analysis')
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(private signalService: SignalService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Execute technical analysis',
    description: 'Runs technical analysis for all enabled symbols and generates signals. Designed to be called by external cron jobs every 15 minutes.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        api_key: {
          type: 'string',
          description: 'API key for authentication',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        signals_generated: { type: 'number' },
        timestamp: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async runAnalysis(@Body() body: { api_key?: string }): Promise<any> {
    try {
      this.logger.log('Analysis execution started');

      // Verify API key if provided
      if (body.api_key && body.api_key !== process.env.ANALYSIS_API_KEY) {
        return {
          success: false,
          error: 'Invalid API key',
        };
      }

      const signals = await this.signalService.executeAnalysis();

      return {
        success: true,
        signals_generated: signals.length,
        timestamp: new Date().toISOString(),
        message: `Analysis completed. ${signals.length} signal(s) generated.`,
      };
    } catch (error) {
      this.logger.error(`Analysis execution failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
