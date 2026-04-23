import { Controller, Get, Post, Delete, Param, Query, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { OrderService } from '../services/order.service';

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private orderService: OrderService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Retrieve all trading orders from the system',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Maximum number of orders to return (default: 50)',
  })
  @ApiResponse({
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
  })
  async getAllOrders(@Query('limit') limit?: string): Promise<any[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const orders = await this.orderService.getAllOrders(parsedLimit);
    return orders.map((o) => ({
      ...o,
      quantity: parseFloat(o.quantity.toString()),
      price: parseFloat(o.price.toString()),
    }));
  }

  @Get('symbol/:symbol')
  @ApiOperation({
    summary: 'Get orders for a specific symbol',
    description: 'Retrieve orders for a particular stock symbol',
  })
  @ApiParam({
    name: 'symbol',
    required: true,
    description: 'Stock symbol (e.g., AAPL, GOOGL)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
  })
  async getOrdersBySymbol(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    const orders = await this.orderService.getOrdersBySymbol(symbol, limit || 20);
    return orders.map((o) => ({
      ...o,
      quantity: parseFloat(o.quantity.toString()),
      price: parseFloat(o.price.toString()),
    }));
  }

  @Post(':id/authorize')
  @ApiOperation({
    summary: 'Authorize and execute an order',
    description: 'Execute a pending order by authorizing it through Alpaca API',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Order executed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async authorizeOrder(@Param('id') id: string): Promise<any> {
    const success = await this.orderService.authorizeAndExecuteOrder(id);
    return {
      success,
      message: success ? 'Order executed successfully' : 'Order execution failed',
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Cancel a pending or executed order',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Order ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
  })
  async cancelOrder(@Param('id') id: string): Promise<any> {
    const success = await this.orderService.cancelOrder(id);
    return {
      success,
      message: success ? 'Order cancelled successfully' : 'Order cancellation failed',
    };
  }
}
