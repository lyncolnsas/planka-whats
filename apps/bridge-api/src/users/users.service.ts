import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface UserMapping {
    whatsappNumber: string;
    plankaUserId: string;
}

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);
    private whitelist: UserMapping[] = [];

    constructor(private readonly configService: ConfigService) {
        this.loadWhitelist();
    }

    /**
     * Loads the whitelist from environment variables for now.
     * Format: WHATSAPP_ID:PLANKA_ID,WHATSAPP_ID2:PLANKA_ID2
     */
    private loadWhitelist() {
        const rawMapping = this.configService.get<string>('USER_WHITELIST_MAPPING');
        if (!rawMapping) {
            this.logger.warn('USER_WHITELIST_MAPPING not configured. All commands will be blocked.');
            return;
        }

        this.whitelist = rawMapping.split(',').map(item => {
            const [whatsappNumber, plankaUserId] = item.split(':');
            return { whatsappNumber, plankaUserId };
        });

        this.logger.log(`Loaded ${this.whitelist.length} users into the whitelist.`);
    }

    isAuthorized(whatsappNumber: string): boolean {
        // Normalize number: Evolution API uses number@s.whatsapp.net
        const cleanNumber = whatsappNumber.split('@')[0];
        return this.whitelist.some(u => u.whatsappNumber === cleanNumber);
    }

    getPlankaUserId(whatsappNumber: string): string | null {
        const cleanNumber = whatsappNumber.split('@')[0];
        const user = this.whitelist.find(u => u.whatsappNumber === cleanNumber);
        return user ? user.plankaUserId : null;
    }

    getWhatsAppNumber(plankaUserId: string): string | null {
        const user = this.whitelist.find(u => u.plankaUserId === plankaUserId);
        return user ? `${user.whatsappNumber}@s.whatsapp.net` : null;
    }
}
