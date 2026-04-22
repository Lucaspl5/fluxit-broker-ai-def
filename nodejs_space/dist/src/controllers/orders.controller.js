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
var OrdersController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const order_service_1 = require("../services/order.service");
let OrdersController = OrdersController_1 = class OrdersController {
    orderService;
    logger = new common_1.Logger(OrdersController_1.name);
    constructor(orderService) {
        this.orderService = orderService;
    }
    async getAllOrders(limit) {
        const parsedLimit = limit ? parseInt(limit, 10) : 50;
        const orders = await this.orderService.getAllOrders(parsedLimit);
        return orders.map((o) => ({
            ...o,
            quantity: parseFloat(o.quantity.toString()),
            price: parseFloat(o.price.toString()),
        }));
    }
    async getOrdersBySymbol(symbol, limit) {
        const orders = await this.orderService.getOrdersBySymbol(symbol, limit || 20);
        return orders.map((o) => ({
            ...o,
            quantity: parseFloat(o.quantity.toString()),
            price: parseFloat(o.price.toString()),
        }));
    }
    async authorizeOrder(id) {
        const success = await this.orderService.authorizeAndExecuteOrder(id);
        return {
            success,
            message: success ? 'Order executed successfully' : 'Order execution failed',
        };
    }
    async cancelOrder(id) {
        const success = await this.orderService.cancelOrder(id);
        return {
            success,
            message: success ? 'Order cancelled successfully' : 'Order cancellation failed',
        };
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Get all orders',
        description: 'Retrieve all trading orders from the system',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: 'number',
        description: 'Maximum number of orders to return (default: 50)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Orders retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    symbol: { type: 'string' },
                    order_type: { type: 'string', enum: ['BUY', 'SELL'] },
                    quantity: { type: 'number' },
                    price: { type: 'number' },
                    status: { type: 'string' },
                    timestamp: { type: 'string' },
                },
            },
        },
    }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getAllOrders", null);
__decorate([
    (0, common_1.Get)('symbol/:symbol'),
    (0, swagger_1.ApiOperation)({
        summary: 'Get orders for a specific symbol',
        description: 'Retrieve orders for a particular stock symbol',
    }),
    (0, swagger_1.ApiParam)({
        name: 'symbol',
        required: true,
        description: 'Stock symbol (e.g., AAPL, GOOGL)',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'limit',
        required: false,
        type: 'number',
    }),
    __param(0, (0, common_1.Param)('symbol')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrdersBySymbol", null);
__decorate([
    (0, common_1.Post)(':id/authorize'),
    (0, swagger_1.ApiOperation)({
        summary: 'Authorize and execute an order',
        description: 'Execute a pending order by authorizing it through Alpaca API',
    }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        required: true,
        description: 'Order ID',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Order executed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "authorizeOrder", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel an order',
        description: 'Cancel a pending or executed order',
    }),
    (0, swagger_1.ApiParam)({
        name: 'id',
        required: true,
        description: 'Order ID',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Order cancelled successfully',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "cancelOrder", null);
exports.OrdersController = OrdersController = OrdersController_1 = __decorate([
    (0, common_1.Controller)('orders'),
    __metadata("design:paramtypes", [order_service_1.OrderService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map