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
var ConfigController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const configuration_service_1 = require("../services/configuration.service");
let ConfigController = ConfigController_1 = class ConfigController {
    configService;
    logger = new common_1.Logger(ConfigController_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    async getAllConfigs() {
        return this.configService.getEnabledConfigurations();
    }
    async getConfig(symbol) {
        const config = await this.configService.getConfiguration(symbol);
        if (!config) {
            return { error: 'Configuration not found' };
        }
        return config;
    }
    async createOrUpdateConfig(symbol, body) {
        const config = await this.configService.ensureConfiguration(symbol);
        if (Object.keys(body).length > 0) {
            return this.configService.updateConfiguration(symbol, body);
        }
        return config;
    }
    async disableConfig(symbol) {
        return this.configService.disableConfiguration(symbol);
    }
};
exports.ConfigController = ConfigController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all configurations',
        description: 'Retrieve monitoring configurations for all symbols',
    }),
    (0, swagger_1.ApiResponse)({
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
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "getAllConfigs", null);
__decorate([
    (0, common_1.Get)(':symbol'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get configuration for a symbol',
        description: 'Retrieve analysis parameters for a specific symbol',
    }),
    (0, swagger_1.ApiParam)({
        name: 'symbol',
        required: true,
        description: 'Stock symbol (e.g., AAPL)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Configuration retrieved successfully',
    }),
    __param(0, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "getConfig", null);
__decorate([
    (0, common_1.Post)(':symbol'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create or update configuration',
        description: 'Set up monitoring for a symbol with custom parameters',
    }),
    (0, swagger_1.ApiParam)({
        name: 'symbol',
        required: true,
        description: 'Stock symbol (e.g., AAPL)',
    }),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Configuration created/updated successfully',
    }),
    __param(0, (0, common_1.Param)('symbol')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "createOrUpdateConfig", null);
__decorate([
    (0, common_1.Post)(':symbol/disable'),
    (0, swagger_1.ApiOperation)({
        summary: 'Disable monitoring for a symbol',
        description: 'Stop analysis and signal generation for a symbol',
    }),
    (0, swagger_1.ApiParam)({
        name: 'symbol',
        required: true,
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Configuration disabled successfully',
    }),
    __param(0, (0, common_1.Param)('symbol')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConfigController.prototype, "disableConfig", null);
exports.ConfigController = ConfigController = ConfigController_1 = __decorate([
    (0, common_1.Controller)('config'),
    __metadata("design:paramtypes", [configuration_service_1.ConfigurationService])
], ConfigController);
//# sourceMappingURL=config.controller.js.map