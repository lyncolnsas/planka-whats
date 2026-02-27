import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CardEventsService } from './card-events.service';
import { PlankaModule } from '../planka/planka.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
        PlankaModule,
        WhatsAppModule,
        UsersModule, // Mantido para o CronService de vencimento
    ],
    providers: [CronService, CardEventsService],
    exports: [CronService, CardEventsService],
})
export class NotificationsModule { }
