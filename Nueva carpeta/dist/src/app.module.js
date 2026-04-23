"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma/prisma.service");
const technical_analysis_service_1 = require("./services/technical-analysis.service");
const alpaca_service_1 = require("./services/alpaca.service");
const telegram_service_1 = require("./services/telegram.service");
const configuration_service_1 = require("./services/configuration.service");
const signal_service_1 = require("./services/signal.service");
const order_service_1 = require("./services/order.service");
const analysis_controller_1 = require("./controllers/analysis.controller");
const telegram_controller_1 = require("./controllers/telegram.controller");
const signals_controller_1 = require("./controllers/signals.controller");
const orders_controller_1 = require("./controllers/orders.controller");
const performance_controller_1 = require("./controllers/performance.controller");
const config_controller_1 = require("./controllers/config.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
        ],
        controllers: [
            app_controller_1.AppController,
            analysis_controller_1.AnalysisController,
            telegram_controller_1.TelegramController,
            signals_controller_1.SignalsController,
            orders_controller_1.OrdersController,
            performance_controller_1.PerformanceController,
            config_controller_1.ConfigController,
        ],
        providers: [
            app_service_1.AppService,
            prisma_service_1.PrismaService,
            technical_analysis_service_1.TechnicalAnalysisService,
            alpaca_service_1.AlpacaService,
            telegram_service_1.TelegramService,
            configuration_service_1.ConfigurationService,
            signal_service_1.SignalService,
            order_service_1.OrderService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map