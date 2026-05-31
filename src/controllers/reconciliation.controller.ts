import { Controller, Get, Post, Query, ForbiddenException } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReconciliationService } from '../services/reconciliation.service';

// Simple guard token. Override via env RECONCILE_TOKEN in Railway.
const RECONCILE_TOKEN = process.env.RECONCILE_TOKEN ?? 'fluxit-broker-reconcile-2026';

@Controller('admin/reconcile')
export class ReconciliationController {
  constructor(private reconciliation: ReconciliationService) {}

  private assertToken(token?: string) {
    if (token !== RECONCILE_TOKEN) {
      throw new ForbiddenException('Invalid or missing reconcile token');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Dry-run reconciliation report (real P&L from Alpaca fills, no writes)' })
  @ApiQuery({ name: 'token', required: true })
  async report(@Query('token') token?: string) {
    this.assertToken(token);
    return this.reconciliation.reconcile(true);
  }

  @Post()
  @ApiOperation({ summary: 'APPLY reconciliation — wipes corrupt orders/performance and rebuilds from real Alpaca fills' })
  @ApiQuery({ name: 'token', required: true })
  async apply(@Query('token') token?: string) {
    this.assertToken(token);
    return this.reconciliation.reconcile(false);
  }
}
