import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { TelegramService } from '../services/telegram.service';

@Controller('webhook')
export class TelegramController {
  constructor(private telegram: TelegramService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram webhook — recibe updates del bot' })
  async handleWebhook(@Body() update: any) {
    await this.telegram.processUpdate(update);
    return { ok: true };
  }
}
