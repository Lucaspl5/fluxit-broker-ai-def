import { PrismaService } from '../prisma/prisma.service';
export declare class PerformanceController {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getPerformance(limit?: number): Promise<any[]>;
    getPerformanceBySymbol(symbol: string): Promise<any[]>;
    getPerformanceSummary(): Promise<any>;
}
