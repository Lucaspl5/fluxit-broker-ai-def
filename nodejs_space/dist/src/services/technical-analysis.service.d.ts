interface IndicatorValues {
    rsi: number;
    macd: number;
    macdSignal: number;
    ma50: number;
    ma200: number;
    currentPrice: number;
}
interface ConvergenceSignal {
    type: 'BUY' | 'SELL';
    convergentCount: number;
    reasoning: string;
}
export declare class TechnicalAnalysisService {
    private readonly logger;
    calculateIndicators(prices: number[], volumes: number[], rsiPeriod?: number, macdFast?: number, macdSlow?: number, macdSignal?: number, ma50Period?: number, ma200Period?: number): IndicatorValues | null;
    detectConvergenceSignal(indicators: IndicatorValues, rsiOverbought?: number, rsiOversold?: number, requiredConvergence?: number, volumeRatio?: number): ConvergenceSignal | null;
    formatIndicators(indicators: IndicatorValues): string;
}
export {};
