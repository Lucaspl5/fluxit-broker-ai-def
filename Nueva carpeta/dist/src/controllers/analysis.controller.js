"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AnalysisController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const signal_service_1 = require("../services/signal.service");
let AnalysisController = AnalysisController_1 = class AnalysisController {
    signalService;
    logger = new common_1.Logger(AnalysisController_1.name);
    constructor(signalService) {
        this.signalService = signalService;
    }
    async runAnalysis(body) {
        try {
            this.logger.log('Analysis execution started');
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
        }
        catch (error) {
            this.logger.error(`Analysis execution failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    }
};
exports.AnalysisController = AnalysisController;
__decorate([
    (0, common_1.Post)('run'),
    (0, swagger_1.ApiOperation)({
        summary: 'Execute technical analysis',
        description: 'Runs technical analysis for all enabled symbols and generates signals. Designed to be called by external cron jobs every 15 minutes.',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                api_key: {
                    type: 'string',
                    description: 'API key for authentication',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "runAnalysis", null);
exports.AnalysisController = AnalysisController = AnalysisController_1 = __decorate([
    (0, common_1.Controller)('analysis'),
    __metadata("design:paramtypes", [signal_service_1.SignalService])
], AnalysisController);
//# sourceMappingURL=analysis.controller.js.map