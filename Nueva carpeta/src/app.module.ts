import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { TechnicalAnalysisService } from './services/technical-analysis.service';
import { AlpacaService } from './services/alpaca.service';
import { TelegramService } from './services/telegram.service';
import { ConfigurationService } from './services/configuration.service';
import { SignalService } from './services/signal.service';
import { OrderService } from './services/order.service';
import { AnalysisController } from './controllers/analysis.controller';
import { TelegramController } from './controllers/telegram.controller';
import { SignalsController } from './controllers/signals.controller';
import { OrdersController } from './controllers/orders.controller';
import { PerformanceController } from './controllers/performance.controller';
import { ConfigController } from './controllers/config.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    AppController,
    AnalysisController,
    TelegramController,
    SignalsController,
    OrdersController,
    PerformanceController,
    ConfigController,
  ],
  providers: [
    AppService,
    PrismaService,
    TechnicalAnalysisService,
    AlpacaService,
    TelegramService,
    ConfigurationService,
    SignalService,
    OrderService,
  ],
})
export class AppModule {}
