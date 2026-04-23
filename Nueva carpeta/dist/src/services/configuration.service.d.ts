import { PrismaService } from '../prisma/prisma.service';
import { configuration } from '@prisma/client';
export declare class ConfigurationService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    ensureConfiguration(symbol: string): Promise<configuration>;
    getEnabledConfigurations(): Promise<configuration[]>;
    updateConfiguration(symbol: string, updates: Partial<configuration>): Promise<configuration>;
    getConfiguration(symbol: string): Promise<configuration | null>;
    disableConfiguration(symbol: string): Promise<configuration>;
}
