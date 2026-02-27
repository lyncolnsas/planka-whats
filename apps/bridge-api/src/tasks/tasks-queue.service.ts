import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotCommand } from '@planka/shared-types';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { PlankaService } from '../planka/planka.service';

/**
 * TasksQueueService — Direct async processor (no Redis/BullMQ dependency).
 * Jobs are processed immediately in the background using setImmediate to
 * avoid blocking the event loop. Retry logic is built in.
 */
@Injectable()
export class TasksQueueService {
    private readonly logger = new Logger(TasksQueueService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly whatsappService: WhatsAppService,
        private readonly plankaService: PlankaService,
    ) { }

    async addPlankaTaskJob(command: BotCommand) {
        const jobName = command.type.toLowerCase().replace('_', '-');
        this.logger.log(`Scheduling inline job [${jobName}]: ${JSON.stringify(command.payload)}`);

        // Fire-and-forget with retry
        setImmediate(() => this.executeWithRetry(jobName, command, 3));
    }

    private async executeWithRetry(jobName: string, command: BotCommand, maxRetries: number, attempt = 1) {
        try {
            if (jobName === 'create-task') {
                await this.processCreateTask(command);
            } else if (jobName === 'list-tasks') {
                await this.processListTasks(command);
            }
        } catch (error: any) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Job [${jobName}] attempt ${attempt}/${maxRetries} failed: ${msg}`);

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s backoff
                setTimeout(() => this.executeWithRetry(jobName, command, maxRetries, attempt + 1), delay);
            } else {
                this.logger.error(`Job [${jobName}] exhausted all retries.`);
                try {
                    await this.whatsappService.sendText(
                        command.rawMessage.from,
                        `❌ *Não conseguimos salvar sua tarefa:* _${command.payload.title}_\n\nO sistema tentou várias vezes mas falhou. Tente novamente mais tarde.`
                    );
                } catch { }
            }
        }
    }

    private async processCreateTask(command: BotCommand) {
        const boardId = (command.payload as any).boardId || this.configService.get<string>('BOARD_ID');
        const listId = (command.payload as any).listId || this.configService.get<string>('LIST_ID');
        const authorId = (command.payload as any).plankaUserId;
        const dueDate = (command.payload as any).parsedDueDate;
        const cardType = (command.payload as any).cardType || 'story';
        const rawTasks = (command.payload as any).rawTasks;
        const rawMembers = (command.payload as any).rawMembers;
        const rawLabels = (command.payload as any).rawLabels;
        const rawStopwatch = (command.payload as any).rawStopwatch;
        const rawCustomFields = (command.payload as any).rawCustomFields;

        if (!boardId || !listId) throw new Error('BOARD_ID or LIST_ID not configured');

        this.logger.log(`Creating Planka card: "${command.payload.title}"`);

        // Fallback for custom fields (Append to description before creating)
        let finalDescription = command.payload.description || '';
        if (rawCustomFields) {
            finalDescription += `\n\n📄 *Campo Personalizado:*\n${rawCustomFields}`;
        }
        const descriptionToSend = finalDescription.trim() ? finalDescription.trim() : undefined;

        const card = await this.plankaService.createCard(
            boardId,
            listId,
            command.payload.title,
            descriptionToSend,
            authorId,
            dueDate,
            cardType
        );

        if (card && card.item && card.item.id) {
            const cardId = card.item.id;

            // Optional: get board entities strictly only if we have memberships or labels to process
            let boardEntities: any = null;
            if (rawMembers || rawLabels) {
                try {
                    boardEntities = await this.plankaService.getBoardEntities(boardId);
                } catch (e) { /* ignore */ }
            }

            // --- Members ---
            if (rawMembers && boardEntities?.users) {
                try {
                    const memberNames = rawMembers.split(/[\n,]+/).map((n: string) => n.trim().toLowerCase());
                    for (const mName of memberNames) {
                        if (!mName) continue;
                        const userMatch = boardEntities.users.find((u: any) =>
                            u.name?.toLowerCase().includes(mName) ||
                            u.username?.toLowerCase().includes(mName) ||
                            u.email?.toLowerCase().includes(mName)
                        );
                        if (userMatch) {
                            await this.plankaService.addCardMembership(cardId, userMatch.id);
                        }
                    }
                } catch (e: any) { this.logger.error(`Failed to attach members: ${e.message}`); }
            }

            // --- Labels ---
            if (rawLabels && boardEntities?.labels) {
                try {
                    const labelNames = rawLabels.split(/[\n,]+/).map((n: string) => n.trim().toLowerCase());
                    for (const lName of labelNames) {
                        if (!lName) continue;
                        const labelMatch = boardEntities.labels.find((l: any) =>
                            l.name?.toLowerCase().includes(lName)
                        );
                        if (labelMatch) {
                            await this.plankaService.addCardLabel(cardId, labelMatch.id);
                        }
                    }
                } catch (e: any) { this.logger.error(`Failed to attach labels: ${e.message}`); }
            }

            // --- Stopwatch ---
            if (rawStopwatch) {
                try {
                    await this.plankaService.updateCardStopwatch(cardId);
                } catch (e: any) { this.logger.error(`Failed to attach stopwatch: ${e.message}`); }
            }

            // TaskLists / Checklists
            if (rawTasks && typeof rawTasks === 'string') {
                try {
                    const taskLines = rawTasks.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
                    if (taskLines.length > 0) {
                        const taskList = await this.plankaService.createTaskList(cardId, 'Tarefas do Whatsapp');
                        if (taskList && taskList.id) {
                            for (const line of taskLines) {
                                await this.plankaService.createTask(taskList.id, line);
                            }
                        }
                    }
                } catch (e: any) {
                    this.logger.error(`Failed to create tasklist for card: ${e.message}`);
                }
            }

            // Handle media attachment
            if (command.rawMessage.media) {
                try {
                    const mediaRes = await this.whatsappService.downloadMedia(command.rawMessage.media);
                    if (mediaRes && mediaRes.buffer) {
                        await this.plankaService.uploadAttachment(cardId, mediaRes.buffer, `whatsapp_${Date.now()}.${mediaRes.ext}`);
                        this.logger.log(`Media attached to card ${cardId}`);
                    }
                } catch (e: any) {
                    this.logger.error(`Media attach failed: ${e.message}`);
                }
            }
        }

        await this.whatsappService.sendText(
            command.rawMessage.from,
            `✅ *Tarefa confirmada no Planka!* ${command.rawMessage.media ? '\n📸 _Imagem anexada._' : ''}\n\n📌 _${command.payload.title}_`
        );
    }

    private async processListTasks(command: BotCommand) {
        const userId = (command.payload as any).plankaUserId;
        if (!userId) throw new Error('No Planka user ID provided for listing tasks');

        const tasks = await this.plankaService.getUserTasks(userId);

        if (!tasks || tasks.length === 0) {
            await this.whatsappService.sendText(command.rawMessage.from, '📅 *Sua Agenda está vazia!*\n\nNenhum cartão foi encontrado nos quadros aos quais você tem acesso.');
            return;
        }

        let messageParts = ['📅 *Agenda Completa dos Quadros:*', ''];

        // Group tasks by Project > Board
        const groupedByProject: { [key: string]: any[] } = {};
        for (const t of tasks) {
            const key = `*${t.projectName}* (${t.boardName})`;
            if (!groupedByProject[key]) groupedByProject[key] = [];
            groupedByProject[key].push(t);
        }

        for (const projKey of Object.keys(groupedByProject)) {
            messageParts.push(`🏢 ${projKey}`);
            const projTasks = groupedByProject[projKey];

            // Group further by List
            const listGroups: { [listName: string]: { position: number, tasks: any[] } } = {};
            for (const t of projTasks) {
                if (!listGroups[t.listName]) listGroups[t.listName] = { position: t.listPosition, tasks: [] };
                listGroups[t.listName].tasks.push(t);
            }

            const sortedListNames = Object.keys(listGroups).sort((a, b) => listGroups[a].position - listGroups[b].position);

            for (const listName of sortedListNames) {
                messageParts.push(` 🗂️ _${listName}_`);
                const sortedTasks = listGroups[listName].tasks.sort((a, b) => (a.cardPosition || 0) - (b.cardPosition || 0));
                for (const t of sortedTasks) {
                    messageParts.push(` • ${t.card.name}`);
                }
            }
            messageParts.push(''); // blank line between projects
        }

        await this.whatsappService.sendText(command.rawMessage.from, messageParts.join('\n').trim());
    }
}
