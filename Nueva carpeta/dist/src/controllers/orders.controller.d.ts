import { OrderService } from '../services/order.service';
export declare class OrdersController {
    private orderService;
    private readonly logger;
    constructor(orderService: OrderService);
    getAllOrders(limit?: string): Promise<any[]>;
    getOrdersBySymbol(symbol: string, limit?: number): Promise<any[]>;
    authorizeOrder(id: string): Promise<any>;
    cancelOrder(id: string): Promise<any>;
}
