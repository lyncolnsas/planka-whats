import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotCommand } from '@planka/shared-types';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { PlankaService } from '../planka/planka.service';

@Processor('planka-tasks')
export class TasksProcessor extends WorkerHost {
    private readonly logger = new Logger(TasksProcessor.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly whatsappService: WhatsAppService,
        private readonly plankaService: PlankaService,
    ) {
        super();
    }

    async process(job: Job<BotCommand>): Promise<any> {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);

        if (job.name === 'create-task') {
            const command = job.data;

            try {
                this.logger.log(`Creating card on Planka: ${command.payload.title}`);

                const boardId = this.configService.get<string>('BOARD_ID');
                const listId = this.configService.get<string>('LIST_ID');
                const authorId = (command.payload as any).plankaUserId;

                if (!boardId || !listId) {
                    throw new Error('BOARD_ID or LIST_ID not configured in .env');
                }

                const card = await this.plankaService.createCard(
                    boardId,
                    listId,
                    command.payload.title,
                    `Created via WhatsApp from ${command.rawMessage.from}`,
                    authorId
                );

                this.logger.log(`Successfully created task on Planka: ${command.payload.title} (ID: ${card.item.id})`);

                // Handle media attachment if present
                if (command.rawMessage.media) {
                    this.logger.log(`Downloading media for card ${card.item.id}...`);

                    try {
                        const { buffer, ext } = await this.whatsappService.downloadMedia(command.rawMessage.media);
                        const fileName = `whatsapp_media_${Date.now()}.${ext}`;

                        this.logger.log(`Uploading attachment ${fileName} to card ${card.item.id}...`);
                        await this.plankaService.uploadAttachment(card.item.id, buffer, fileName);
                        this.logger.log(`Successfully uploaded attachment to card ${card.item.id}`);
                    } catch (mediaError: any) {
                        const message = mediaError instanceof Error ? mediaError.message : String(mediaError);
                        this.logger.error(`Failed to attach media: ${message}`);
                        // Don't fail the whole job if only the attachment fails, just log it.
                    }
                }

                // Notify user of success
                await this.whatsappService.sendText(
                    command.rawMessage.from,
                    `✅ *Tarefa confirmada no Planka!* ${command.rawMessage.media ? '\n📸 _Imagem anexada com sucesso._' : ''}\n\n📌 _${command.payload.title}_`
                );

                return { success: true };
            } catch (error: any) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to process task creation for ${command.payload.title}: ${message}`);
                throw error;
            }
        }

        if (job.name === 'list-tasks') {
            const command = job.data;
            try {
                this.logger.log(`Fetching tasks for ${command.payload.filter}`);

                const boardId = this.configService.get<string>('BOARD_ID')!;
                if (!boardId) throw new Error('BOARD_ID not configured');

                const cards = await this.plankaService.getCards(boardId);

                const message = [
                    '📅 *Suas tarefas recentes:*',
                    '',
                    ...cards.slice(-5).map((c: any) => `• ${c.name}`),
                    '',
                    '_Mostrando os últimos 5 itens._'
                ].join('\n');

                await this.whatsappService.sendText(command.rawMessage.from, message);
                return { success: true };
            } catch (error: any) {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to list tasks: ${message}`);
                throw error;
            }
        }
    }

    @OnWorkerEvent('failed')
    async onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`);

        if (job.attemptsMade >= (job.opts.attempts || 1)) {
            // Notify user of final failure after all retries
            const command = job.data as BotCommand;
            await this.whatsappService.sendText(
                command.rawMessage.from,
                `❌ *Não conseguimos salvar sua tarefa:* _${command.payload.title}_\n\nO sistema tentou várias vezes mas o servidor do Planka está inacessível. Por favor, tente novamente mais tarde.`
            );
        }
    }
}
