import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TasksQueueService } from './tasks-queue.service';
import { PlankaModule } from '../planka/planka.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

/**
 * TasksModule — No longer depends on BullMQ/Redis.
 * Processing is handled inline by TasksQueueService.
 */
@Module({
    imports: [
        ConfigModule,
        PlankaModule,
        forwardRef(() => WhatsAppModule),
    ],
    providers: [TasksQueueService],
    exports: [TasksQueueService],
})
export class TasksModule { }
