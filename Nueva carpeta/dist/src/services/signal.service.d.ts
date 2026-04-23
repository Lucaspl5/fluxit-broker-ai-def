import { PrismaService } from '../prisma/prisma.service';
import { AlpacaService } from './alpaca.service';
import { TechnicalAnalysisService } from './technical-analysis.service';
import { TelegramService } from './telegram.service';
import { ConfigurationService } from './configuration.service';
import { signal as SignalModel } from '@prisma/client';
export declare class SignalService {
    private prisma;
    private alpaca;
    private technicalAnalysis;
    private telegram;
    private configuration;
    private readonly logger;
    constructor(prisma: PrismaService, alpaca: AlpacaService, technicalAnalysis: TechnicalAnalysisService, telegram: TelegramService, configuration: ConfigurationService);
    executeAnalysis(): Promise<SignalModel[]>;
    analyzeSymbol(symbol: string): Promise<SignalModel | null>;
    getRecentSignals(limit?: number): Promise<SignalModel[]>;
    getSignalsBySymbol(symbol: string, limit?: number): Promise<SignalModel[]>;
    private getRecommendation;
}
