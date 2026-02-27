import { Module, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { CommandParserService } from './command-parser.service';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { TasksQueueService } from '../tasks/tasks-queue.service';
import { WhatsAppMessage, BotCommand } from '@planka/shared-types';
import { PlankaService } from '../planka/planka.service';

@Module({
    imports: [
        forwardRef(() => TasksModule),
        UsersModule,
    ],
    controllers: [WhatsAppController],
    providers: [WhatsAppService, CommandParserService],
    exports: [WhatsAppService, CommandParserService],
})
export class WhatsAppModule implements OnModuleInit {
    private readonly logger = new Logger(WhatsAppModule.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly whatsappService: WhatsAppService,
        private readonly commandParser: CommandParserService,
        private readonly usersService: UsersService,
        private readonly plankaService: PlankaService,
        @Inject(forwardRef(() => TasksQueueService))
        private readonly tasksQueue: TasksQueueService,
    ) { }

    onModuleInit() {
        this.whatsappService.messageUpsert$.subscribe(async (msg) => {
            try {
                await this.handleIncomingMessage(msg);
            } catch (error: any) {
                this.logger.error(`Error handling incoming message: ${error.message}`);
            }
        });
    }

    private readonly addWizardState = new Map<string, {
        step: number;
        boardOptions?: any[];
        boardId?: string;
        listId?: string;
        title?: string;
        description?: string;
        members?: string;
        labels?: string;
        dueDate?: string;
        stopwatch?: string;
        tasks?: string;
        attachment?: string;
        customFields?: string;
        cardType?: string;
        plankaUserId: string;
    }>();

    private readonly addBoardWizardState = new Map<string, {
        name: string;
        plankaUserId: string;
        projectOptions: any[];
    }>();

    private async handleIncomingMessage(msg: any) {
        const text = this.whatsappService.getMessageText(msg.message)?.trim();
        // Allow media without text to bypass "if (!text)"
        if (!text && !msg.message?.imageMessage && !msg.message?.documentMessage && !msg.message?.audioMessage && !msg.message?.videoMessage) return;

        let from = msg.key.remoteJid;

        // Se for um @lid mas vier com a propriedade secreta da Baileys para o número real alternativo:
        if (from?.endsWith('@lid') && msg.key?.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
            from = msg.key.remoteJidAlt;
        }

        // Only process direct messages from real phone numbers.
        // Ignore: @g.us (groups), @lid (without alt), @broadcast, null, etc.
        if (!from || (!from.endsWith('@s.whatsapp.net') && !from.endsWith('@c.us'))) {
            return;
        }

        const safeText = text || '';
        this.logger.log(`[CMD] from=${from} text="${safeText.substring(0, 60)}"`);

        const message: WhatsAppMessage = {
            id: msg.key.id,
            from: from!,
            text: safeText,
            timestamp: msg.messageTimestamp,
        };

        if (msg.message?.imageMessage || msg.message?.documentMessage || msg.message?.audioMessage || msg.message?.videoMessage) {
            (message as any).media = msg.message;
        }

        // --- EXCEPTION FLOW: ACTIVE WIZARD ---
        const wizard = this.addWizardState.get(from);
        const boardWizard = this.addBoardWizardState.get(from);
        const command = this.commandParser.parse(message);

        // Se o usuário mandar #cancelar a qualquer momento
        if (safeText.toLowerCase() === '#cancelar' && (wizard || boardWizard)) {
            this.addWizardState.delete(from);
            this.addBoardWizardState.delete(from);
            await this.whatsappService.sendText(from, '❌ *Operação cancelada.*');
            return;
        }

        let plankaUserId = this.usersService.getPlankaUserId(from!);

        if (!plankaUserId) {
            // Extract phone number: "5511999999999@s.whatsapp.net" → "5511999999999"
            const cleanNumber = from!.split('@')[0];
            try {
                // Try to find or create Planka user for this WhatsApp number
                const contact = this.whatsappService.getContactName(from!);
                const displayName = contact || cleanNumber;
                const waUser = await this.plankaService.getOrCreateUser(cleanNumber, displayName);
                plankaUserId = waUser.id;
            } catch (err: any) {
                this.logger.error(`Failed to sync WA user for ${from}: ${err.message}`);
                return;
            }
        }

        if (!plankaUserId) {
            if (safeText.startsWith('#')) {
                await this.whatsappService.sendText(from!, '❌ *Acesso Negado.*\nSeu número não está vinculado a um usuário no Planka.');
            }
            return;
        }

        // --- HANDLE WIZARD STATE ---
        if (boardWizard) {
            const optionIndex = parseInt(safeText.trim()) - 1;
            if (!isNaN(optionIndex) && boardWizard.projectOptions && optionIndex >= 0 && optionIndex < boardWizard.projectOptions.length) {
                const selectedProject = boardWizard.projectOptions[optionIndex];

                await this.whatsappService.sendText(from, '⏳ *Criando quadro...*');
                try {
                    const board = await this.plankaService.createBoard(selectedProject.id, boardWizard.name);
                    // Cria as três colunas padrão de um kanban típico
                    await this.plankaService.createList(board.id, 'Brainstorm / Pauta', 65535);
                    await this.plankaService.createList(board.id, 'Backlog', 131070);
                    await this.plankaService.createList(board.id, 'Em Produção', 196605);
                    await this.plankaService.createList(board.id, 'Finalizado', 262140);
                    await this.whatsappService.sendText(from, `✅ *Quadro "${boardWizard.name}" criado com sucesso!*\n🏢 Projeto: ${selectedProject.name}`);
                } catch (e: any) {
                    this.logger.error(`Create board failed: ${e.message}`);
                    await this.whatsappService.sendText(from, '❌ *Falha ao criar quadro.*');
                }
                this.addBoardWizardState.delete(from);
            } else {
                await this.whatsappService.sendText(from, '❌ *Opção inválida.*\nDigite apenas o *número* correspondente ao projeto desejado.');
            }
            return;
        }

        if (wizard) {
            const isSaveEarly = safeText.toLowerCase() === 'salvar' || safeText.toLowerCase() === '#salvar';
            const isSkip = safeText.toLowerCase() === 'pular' || safeText.toLowerCase() === '#pular';

            if (!isSaveEarly) {
                if (wizard.step === 0) {
                    const optionIndex = parseInt(safeText.trim()) - 1;
                    if (!isNaN(optionIndex) && wizard.boardOptions && optionIndex >= 0 && optionIndex < wizard.boardOptions.length) {
                        const selectedBoard = wizard.boardOptions[optionIndex];
                        wizard.boardId = selectedBoard.id;
                        wizard.listId = selectedBoard.listId;

                        wizard.step = 50;
                        const msg = [
                            '🏷️ *Que tipo de Cartão você deseja criar?*',
                            '',
                            'Responda com o número correspondente:',
                            '*1* - 🗂️ *Projeto* (Para grandes tarefas que podem carregar histórias menores, mais focado em metas longas)',
                            '*2* - 📜 *História* (O cartão padrão do Planka! Para uma tarefa comum a ser concluída)',
                            '*3* - 📝 *Nota* (Para informações soltas, avisos, rascunhos sem necessidade de status/conclusão explícita)'
                        ].join('\n');
                        await this.whatsappService.sendText(from, msg);
                        return;
                    } else {
                        await this.whatsappService.sendText(from, '❌ *Opção inválida.*\nDigite apenas o *número* correspondente ao projeto desejado.');
                        return;
                    }
                } else if (wizard.step === 50) {
                    const sel = safeText.trim();
                    if (sel === '1') wizard.cardType = 'project';
                    else if (sel === '2') wizard.cardType = 'story';
                    else if (sel === '3') wizard.cardType = 'note';
                    else {
                        await this.whatsappService.sendText(from, '❌ *Opção inválida.*\nEnvie 1, 2 ou 3 apenas.');
                        return;
                    }

                    wizard.step = 100;
                    const titleToUse = wizard.title || '---';
                    const msgText = [
                        '📝 *Criação de Cartão Completa*',
                        `1️⃣ Nome: ${titleToUse}`,
                        '2️⃣ Descrição: ---',
                        '3️⃣ Membros: ---',
                        '4️⃣ Rótulos: ---',
                        '5️⃣ Vencimento: ---',
                        '6️⃣ Horario lembrete: ---',
                        '7️⃣ Tarefas: ---',
                        '8️⃣ Anexo: ---',
                        '9️⃣ Campo Pers.: ---',
                        '',
                        '👉 *Copie a mensagem acima, preencha os campos obrigatórios (1️⃣, 5️⃣ e 6️⃣) e envie para criar o seu card!*'
                    ].join('\n');
                    await this.whatsappService.sendText(from, msgText);
                    return;
                } else if (wizard.step === 100) {
                    const extractField = (text: string, current: string, next: string | null) => {
                        const start = text.indexOf(current);
                        if (start === -1) return '';
                        const textPastStart = text.substring(start + current.length);
                        let end = -1;
                        if (next) end = textPastStart.indexOf(next);
                        const val = (next !== null && end !== -1) ? textPastStart.substring(0, end) : textPastStart;
                        const trimmed = val.trim();
                        if (trimmed === '---') return '';
                        return trimmed;
                    };

                    wizard.title = extractField(safeText, '1️⃣ Nome:', '2️⃣') || wizard.title;
                    wizard.description = extractField(safeText, '2️⃣ Descrição:', '3️⃣');
                    wizard.members = extractField(safeText, '3️⃣ Membros:', '4️⃣');
                    wizard.labels = extractField(safeText, '4️⃣ Rótulos:', '5️⃣');

                    const dt = extractField(safeText, '5️⃣ Vencimento:', '6️⃣');
                    const tm = extractField(safeText, '6️⃣ Horario lembrete:', '7️⃣');

                    if (!dt || !tm) {
                        await this.whatsappService.sendText(from, '❌ *Preencha data e hora!*\nOs campos 5️⃣ Vencimento e 6️⃣ Horário lembrete são obrigatórios. Por favor, reenvie o modelo preenchido.');
                        return;
                    }

                    wizard.dueDate = `${dt} às ${tm}`;

                    wizard.tasks = extractField(safeText, '7️⃣ Tarefas:', '8️⃣');

                    wizard.attachment = extractField(safeText, '8️⃣ Anexo:', '9️⃣');
                    if ((message as any).media) wizard.attachment = '*Anexo Recebido*';

                    wizard.customFields = extractField(safeText, '9️⃣ Campo Pers.:', '👉');

                    if (!wizard.title) {
                        await this.whatsappService.sendText(from, '❌ *O Nome (1️⃣) é obrigatório!* Por favor, reenvie o modelo preenchido.');
                        return;
                    }

                    wizard.step = 999; // Finish!
                }
            }

            if (isSaveEarly || wizard.step === 999) {
                // Finalizar e salvar!
                await this.whatsappService.sendText(from, '⏳ *Salvando seu cartão no Planka...*');

                // Mantém na descrição somente as Tasks antigas (para fallback) e a própria descrição.
                let finalDesc = wizard.description || '';
                if (wizard.tasks) finalDesc += `\n\n📋 *Tarefas Originais:*\n${wizard.tasks}`;

                // Parse Date
                // Parse Date and Time together
                let parsedDueDate: string | undefined = undefined;
                if (wizard.dueDate) {
                    const d = wizard.dueDate.toLowerCase().trim();
                    const now = new Date();

                    // Regex para identificar hora: ex: "15:30", "15h", "às 15"
                    // CORRIGIDO: grupo de horas exige ao menos 1 dígito (removido alternativo vazio)
                    const timeMatch = d.match(/(?:às|as|-)?\s*(\d{1,2})(?::|h)(\d{2})?/i);
                    let hours = 12; // default noon
                    let minutes = 0;
                    if (timeMatch) {
                        const h = parseInt(timeMatch[1], 10);
                        const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                        if (!isNaN(h) && h >= 0 && h <= 23) hours = h;
                        if (!isNaN(m) && m >= 0 && m <= 59) minutes = m;
                    }

                    let candidateDate: Date | null = null;

                    if (d.startsWith('hoje')) {
                        now.setHours(hours, minutes, 0, 0);
                        candidateDate = now;
                    } else if (d.startsWith('amanhã') || d.startsWith('amanha')) {
                        now.setDate(now.getDate() + 1);
                        now.setHours(hours, minutes, 0, 0);
                        candidateDate = now;
                    } else {
                        // Ex: 15/07/2026 ou 15/07
                        const dateMatch = d.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
                        if (dateMatch) {
                            const day = parseInt(dateMatch[1], 10);
                            const month = parseInt(dateMatch[2], 10) - 1;
                            let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
                            if (year < 100) year += 2000;
                            const resDate = new Date(year, month, day, hours, minutes, 0);
                            if (!isNaN(resDate.getTime())) {
                                candidateDate = resDate;
                            }
                        }
                    }

                    // ✅ VALIDAÇÃO FINAL: só atribui se a data for válida
                    if (candidateDate && !isNaN(candidateDate.getTime())) {
                        parsedDueDate = candidateDate.toISOString();
                    }
                } // fim do if (wizard.dueDate)

                const createCmd: BotCommand = {
                    type: 'CREATE_TASK',
                    payload: {
                        title: wizard.title,
                        description: finalDesc,
                        plankaUserId,
                        boardId: wizard.boardId,
                        listId: wizard.listId,
                        parsedDueDate,
                        cardType: wizard.cardType,
                        rawTasks: wizard.tasks,
                        rawMembers: wizard.members,
                        rawLabels: wizard.labels,
                        rawStopwatch: wizard.stopwatch,
                        rawCustomFields: wizard.customFields
                    },
                    rawMessage: message
                };

                this.addWizardState.delete(from);
                await this.tasksQueue.addPlankaTaskJob(createCmd);
                return;
            }

            // O status line e wizard step 1..9 não existem mais no novo fluxo
            return;
        }

        // --- NORMAL COMMAND PASS ---
        this.logger.log(`[CMD] type=${command.type}`);

        if (command.type === 'HELP') {
            this.logger.log(`[CMD] Sending HELP to ${from}`);
            await this.whatsappService.sendText(from!, this.commandParser.getHelpMessage());
            return;
        }

        if (command.payload) {
            (command.payload as any).plankaUserId = plankaUserId;
        }

        switch (command.type as any) {
            case 'UNKNOWN':
                if (message.text.startsWith('#')) {
                    await this.whatsappService.sendText(from!, this.commandParser.getUnknownCommandMessage());
                }
                break;
            case 'CREATE_TASK': {
                const boards = await this.plankaService.getUserAccessibleBoards(plankaUserId);

                if (boards.length === 0) {
                    await this.whatsappService.sendText(from!, '⚠️ *Erro:* Você não tem permissão para adicionar cartões em nenhum quadro.');
                    break;
                }

                const titleInput = command.payload.title;

                if (boards.length > 0) { // Sempre força a escolha do quadro se possuir pelo menos 1 (a pedido do usuário)
                    // Iniciar seleção no passo 0
                    this.addWizardState.set(from!, {
                        step: 0,
                        plankaUserId,
                        boardOptions: boards,
                        title: titleInput
                    });

                    let msg = '📋 *Qual quadro recebe essa tarefa?*\nResponda com o número do quadro:\n\n';
                    boards.forEach((b: any, index: number) => {
                        msg += `*${index + 1}* - ${b.projectName} (${b.name})\n`;
                    });
                    await this.whatsappService.sendText(from!, msg);
                    break;
                }

                // Fallback (teoricamente não chegamos aqui pq a checagem === 0 existe acima)
                const singleBoard = boards[0];

                const titleToUse = titleInput ? titleInput.trim() : '---';
                this.addWizardState.set(from!, {
                    step: 50,
                    title: titleInput ? titleInput.trim() : undefined,
                    plankaUserId,
                    boardId: singleBoard.id,
                    listId: singleBoard.listId
                });

                const msg = [
                    '🏷️ *Que tipo de Cartão você deseja criar?*',
                    '',
                    'Responda com o número correspondente:',
                    '*1* - 🗂️ *Projeto* (Para grandes tarefas que podem carregar histórias menores, mais focado em metas longas)',
                    '*2* - 📜 *História* (O cartão padrão do Planka! Para uma tarefa comum a ser concluída)',
                    '*3* - 📝 *Nota* (Para informações soltas, avisos, rascunhos sem necessidade de status/conclusão explícita)'
                ].join('\n');

                await this.whatsappService.sendText(from!, msg);
                break;
            }
            case 'CREATE_BOARD': {
                const projects = await this.plankaService.getUserAccessibleProjects(plankaUserId);

                if (projects.length === 0) {
                    await this.whatsappService.sendText(from!, '⚠️ *Erro:* Você não gerencia nenhum projeto no qual possa criar quadros.');
                    break;
                }

                const boardName = command.payload.name;
                if (!boardName) {
                    await this.whatsappService.sendText(from!, '❌ *Falta o nome!* \nPara criar um quadro você deve informar o nome do quadro.\nExemplo: `#addquadro Evento Fim de Ano`');
                    break;
                }

                if (projects.length === 1) {
                    // Se a pessoa tiver literalmente apenas UM projeto disponível pra isso, nem pergunta e cria direto
                    const selectedProject = projects[0];
                    await this.whatsappService.sendText(from!, '⏳ *Criando seu novo quadro...*');
                    try {
                        const board = await this.plankaService.createBoard(selectedProject.id, boardName);
                        // Cria listas base padrão
                        await this.plankaService.createList(board.id, 'Brainstorm / Pauta', 65535);
                        await this.plankaService.createList(board.id, 'Backlog', 131070);
                        await this.plankaService.createList(board.id, 'Em Produção', 196605);
                        await this.plankaService.createList(board.id, 'Finalizado', 262140);
                        await this.whatsappService.sendText(from!, `✅ *Quadro "${boardName}" criado com sucesso!*\n🏢 Projeto Vinculado: ${selectedProject.name}`);
                    } catch (e) {
                        await this.whatsappService.sendText(from!, '❌ *Falha ao criar o quadro.* Verifique permissões internas no Planka.');
                    }
                    break;
                }

                // Caso tenha multiplos projetos, inicia o wizard no terminal de seleçao 0
                this.addBoardWizardState.set(from!, {
                    name: boardName,
                    plankaUserId,
                    projectOptions: projects,
                });

                let msg = `🏗️ *Onde o Quadro "${boardName}" deve ser criado?*\nResponda apenas com o número correspondente ao projeto desejado:\n\n`;
                projects.forEach((p: any, index: number) => {
                    msg += `*${index + 1}* - ${p.name}\n`;
                });
                await this.whatsappService.sendText(from!, msg);
                break;
            }
            case 'LIST_TASKS':
                await this.tasksQueue.addPlankaTaskJob(command);
                break;
            case 'SHOW_IP': {
                const baseUrl = this.configService.get<string>('BASE_URL') || 'URL não configurada';
                await this.whatsappService.sendText(from!, `🌐 *Endereço de Acesso:* \n${baseUrl}`);
                break;
            }
        }
    }
}
