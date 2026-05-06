import { Controller, Post, Body, Res } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { TelegramService } from '../services/telegram.service';
import { Response } from 'express';

@Controller('webhook')
export class TelegramController {
  constructor(private telegram: TelegramService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram webhook — recibe updates del bot' })
  handleWebhook(@Body() update: any, @Res() res: Response) {
    res.json({ ok: true }); // respond immediately so Telegram doesn't retry
    this.telegram.processUpdate(update).catch(() => {});
  }
}
