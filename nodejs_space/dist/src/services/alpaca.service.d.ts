interface MarketDataPoint {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface OrderRequest {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    limit_price?: number;
}
export declare class AlpacaService {
    private readonly logger;
    private alpaca;
    constructor();
    getHistoricalData(symbol: string, timeframe?: string, limit?: number): Promise<MarketDataPoint[]>;
    getCurrentPrice(symbol: string): Promise<number | null>;
    executeOrder(orderRequest: OrderRequest): Promise<any | null>;
    cancelOrder(orderId: string): Promise<boolean>;
    getOrderStatus(orderId: string): Promise<any | null>;
    getAccount(): Promise<any | null>;
}
export {};
