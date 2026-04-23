import { ConfigurationService } from '../services/configuration.service';
export declare class ConfigController {
    private configService;
    private readonly logger;
    constructor(configService: ConfigurationService);
    getAllConfigs(): Promise<any[]>;
    getConfig(symbol: string): Promise<any>;
    createOrUpdateConfig(symbol: string, body: any): Promise<any>;
    disableConfig(symbol: string): Promise<any>;
}
