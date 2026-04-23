import { SignalService } from '../services/signal.service';
export declare class AnalysisController {
    private signalService;
    private readonly logger;
    constructor(signalService: SignalService);
    runAnalysis(body: {
        api_key?: string;
    }): Promise<any>;
}
