import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlankaService } from '../planka/planka.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

/**
 * Snapshot de um card para comparar mudanças entre polls
 */
interface CardSnapshot {
    id: string;
    name: string;
    listId: string;
    listName: string;
    memberIds: string[];
    boardId: string;
    boardName: string;
}

@Injectable()
export class CardEventsService implements OnModuleInit {
    private readonly logger = new Logger(CardEventsService.name);

    // Estado anterior dos cards: cardId → snapshot
    private previousCards = new Map<string, CardSnapshot>();
    // Membros anteriores por card: cardId → Set<userId>
    private previousMembers = new Map<string, Set<string>>();

    // Cache de usuários Planka: plankaUserId → { username, name }
    // Evita buscar na API a cada notificação
    private plankaUsersCache = new Map<string, { username: string; name: string }>();

    private initialized = false;

    constructor(
        private readonly plankaService: PlankaService,
        private readonly whatsappService: WhatsAppService,
    ) { }

    async onModuleInit() {
        // Aguarda 12s para o WhatsApp conectar antes de fazer o primeiro snapshot
        setTimeout(() => this.buildInitialSnapshot(), 12_000);
    }

    /**
     * Constrói o snapshot inicial sem enviar notificações.
     * Chamado uma única vez na inicialização.
     */
    private async buildInitialSnapshot() {
        try {
            this.logger.log('[CardEvents] Building initial snapshot...');
            const allBoardData = await this.getAllBoardsData();

            for (const { board, cards, lists, memberships, users } of allBoardData) {
                // Popula o cache de usuários com os dados que vieram neste board
                this.cacheUsers(users);

                for (const card of cards) {
                    const list = lists.find((l: any) => l.id === card.listId);
                    const cardMembers = memberships
                        .filter((m: any) => m.cardId === card.id)
                        .map((m: any) => m.userId);

                    this.previousCards.set(card.id, {
                        id: card.id,
                        name: card.name,
                        listId: card.listId,
                        listName: list?.name || 'Unknown',
                        memberIds: cardMembers,
                        boardId: board.id,
                        boardName: board.name,
                    });

                    this.previousMembers.set(card.id, new Set(cardMembers));
                }
            }

            this.initialized = true;
            this.logger.log(`[CardEvents] Snapshot done: ${this.previousCards.size} cards / ${this.plankaUsersCache.size} users indexed.`);
        } catch (e: any) {
            this.logger.error(`[CardEvents] Failed to build initial snapshot: ${e.message}`);
            // Retry em 30s
            setTimeout(() => this.buildInitialSnapshot(), 30_000);
        }
    }

    /**
     * Poll a cada 2 minutos para detectar mudanças.
     */
    @Cron('*/2 * * * *')
    async checkCardEvents() {
        if (!this.initialized) return;

        try {
            const allBoardData = await this.getAllBoardsData();
            const currentCardIds = new Set<string>();

            for (const { board, cards, lists, memberships, users } of allBoardData) {
                // Atualiza cache de usuários com dados frescos
                this.cacheUsers(users);

                for (const card of cards) {
                    currentCardIds.add(card.id);
                    const list = lists.find((l: any) => l.id === card.listId);
                    const listName = list?.name || 'Unknown';

                    const cardMembers = memberships
                        .filter((m: any) => m.cardId === card.id)
                        .map((m: any) => m.userId as string);

                    const prevSnapshot = this.previousCards.get(card.id);
                    const prevMembers = this.previousMembers.get(card.id) || new Set<string>();

                    if (!prevSnapshot) {
                        // ✅ EVENTO: Card novo criado
                        for (const userId of cardMembers) {
                            await this.notifyMember(userId, this.buildNewCardMessage(card.name, listName, board.name));
                        }
                    } else {
                        // ✅ EVENTO: Card movido para outra lista
                        if (prevSnapshot.listId !== card.listId) {
                            const allMembers = new Set([...Array.from(prevMembers), ...cardMembers]);
                            for (const userId of allMembers) {
                                await this.notifyMember(userId, this.buildMovedMessage(card.name, prevSnapshot.listName, listName, board.name));
                            }
                        }

                        // ✅ EVENTO: Novo membro adicionado ao card
                        for (const userId of cardMembers) {
                            if (!prevMembers.has(userId)) {
                                await this.notifyMember(userId, this.buildAddedToCardMessage(card.name, listName, board.name));
                            }
                        }
                    }

                    // Atualiza snapshot
                    this.previousCards.set(card.id, {
                        id: card.id,
                        name: card.name,
                        listId: card.listId,
                        listName,
                        memberIds: cardMembers,
                        boardId: board.id,
                        boardName: board.name,
                    });
                    this.previousMembers.set(card.id, new Set(cardMembers));
                }
            }

            // ✅ EVENTO: Card deletado
            for (const [cardId, snapshot] of this.previousCards.entries()) {
                if (!currentCardIds.has(cardId)) {
                    const prevMembers = this.previousMembers.get(cardId) || new Set<string>();
                    for (const userId of prevMembers) {
                        await this.notifyMember(userId, this.buildDeletedMessage(snapshot.name, snapshot.listName, snapshot.boardName));
                    }
                    this.previousCards.delete(cardId);
                    this.previousMembers.delete(cardId);
                }
            }

        } catch (e: any) {
            this.logger.error(`[CardEvents] Error during poll: ${e.message}`);
        }
    }

    /**
     * Salva usuários no cache local.
     * Os usuários já vêm no 'included' de cada board response.
     */
    private cacheUsers(users: any[]) {
        for (const user of (users || [])) {
            if (user?.id && user?.username) {
                this.plankaUsersCache.set(user.id, {
                    username: user.username,
                    name: user.name || user.username,
                });
            }
        }
    }

    /**
     * Extrai o número de WhatsApp do username do Planka.
     *
     * Usuários criados pelo bot têm username no formato: wa_5511999887766
     * Esse padrão é criado em PlankaService.getOrCreateUser()
     *
     * Retorna o JID: "5511999887766@s.whatsapp.net"
     * ou null se o usuário não for do WhatsApp (usuário manual do Planka)
     */
    private getWhatsAppJid(plankaUserId: string): string | null {
        const user = this.plankaUsersCache.get(plankaUserId);
        if (!user) return null;

        const { username } = user;

        // Padrão: wa_NUMERO (ex: wa_5511999887766)
        if (username.startsWith('wa_')) {
            const phoneNumber = username.slice(3); // Remove "wa_"
            if (/^\d{10,15}$/.test(phoneNumber)) {
                return `${phoneNumber}@s.whatsapp.net`;
            }
        }

        return null; // Usuário criado manualmente no Planka, sem WhatsApp bot
    }

    /**
     * Busca todos os boards e retorna dados relevantes de cards, listas e membros.
     */
    private async getAllBoardsData(): Promise<Array<{
        board: any;
        cards: any[];
        lists: any[];
        memberships: any[];
        users: any[];
    }>> {
        const result: any[] = [];

        try {
            const http = (this.plankaService as any).http;
            if (!(this.plankaService as any).token) await this.plankaService.authenticate();
            const headers = { Authorization: `Bearer ${(this.plankaService as any).token}` };

            const projectsRes = await http.get('/projects', { headers });
            const boards = projectsRes.data?.included?.boards || [];

            for (const board of boards) {
                try {
                    const boardRes = await http.get(`/boards/${board.id}`, { headers });
                    const included = boardRes.data?.included || {};

                    result.push({
                        board: boardRes.data?.item || board,
                        cards: included.cards || [],
                        lists: included.lists || [],
                        memberships: included.cardMemberships || [],
                        users: included.users || [],
                    });
                } catch (e) {
                    // Ignora boards inacessíveis
                }
            }
        } catch (e: any) {
            this.logger.error(`[CardEvents] getAllBoardsData failed: ${e.message}`);
        }

        return result;
    }

    /**
     * Envia notificação WhatsApp ao membro.
     * O número é extraído automaticamente do username do Planka (wa_NUMERO).
     * Usuários criados manualmente no Planka sem prefixo "wa_" são ignorados silenciosamente.
     */
    private async notifyMember(plankaUserId: string, message: string) {
        try {
            const jid = this.getWhatsAppJid(plankaUserId);
            if (!jid) {
                // Usuário sem WhatsApp vinculado (criado manualmente) — ignora silenciosamente
                return;
            }

            if (!this.whatsappService.connected) {
                this.logger.warn(`[CardEvents] WhatsApp offline, skipping notification for ${plankaUserId}`);
                return;
            }

            await this.whatsappService.sendText(jid, message);
            this.logger.log(`[CardEvents] ✅ Notified ${jid} (Planka ID: ${plankaUserId})`);
        } catch (e: any) {
            this.logger.error(`[CardEvents] Failed to notify ${plankaUserId}: ${e.message}`);
        }
    }

    // ─── Templates de Mensagem ────────────────────────────────────────────────

    private buildNewCardMessage(cardName: string, listName: string, boardName: string): string {
        return [
            `🆕 *Nova tarefa atribuída a você!*`,
            ``,
            `📋 *Tarefa:* ${cardName}`,
            `📂 *Lista:* ${listName}`,
            `🗂️ *Quadro:* ${boardName}`,
            ``,
            `Use *#tarefas* para ver todas as suas tarefas.`,
        ].join('\n');
    }

    private buildAddedToCardMessage(cardName: string, listName: string, boardName: string): string {
        return [
            `👤 *Você foi adicionado(a) a uma tarefa!*`,
            ``,
            `📋 *Tarefa:* ${cardName}`,
            `📂 *Lista:* ${listName}`,
            `🗂️ *Quadro:* ${boardName}`,
            ``,
            `Use *#tarefas* para ver todas as suas tarefas.`,
        ].join('\n');
    }

    private buildMovedMessage(cardName: string, fromList: string, toList: string, boardName: string): string {
        return [
            `🔀 *Uma tarefa sua foi movida!*`,
            ``,
            `📋 *Tarefa:* ${cardName}`,
            `📤 *De:* ${fromList}`,
            `📥 *Para:* ${toList}`,
            `🗂️ *Quadro:* ${boardName}`,
        ].join('\n');
    }

    private buildDeletedMessage(cardName: string, listName: string, boardName: string): string {
        return [
            `🗑️ *Uma tarefa sua foi removida!*`,
            ``,
            `📋 *Tarefa:* ${cardName}`,
            `📂 *Era na lista:* ${listName}`,
            `🗂️ *Quadro:* ${boardName}`,
        ].join('\n');
    }
}
