import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns API status and version information',
  })
  @ApiResponse({
    status: 200,
    description: 'API is running',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  getHello(): any {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Service health status',
  })
  health(): any {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
