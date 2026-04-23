import { SignalService } from '../services/signal.service';
export declare class SignalsController {
    private signalService;
    private readonly logger;
    constructor(signalService: SignalService);
    getRecentSignals(limit?: string): Promise<any[]>;
    getSignalsBySymbol(symbol: string, limit?: string): Promise<any[]>;
}
