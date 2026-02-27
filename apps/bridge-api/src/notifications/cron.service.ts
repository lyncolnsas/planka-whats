import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PlankaService } from '../planka/planka.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CronService {
    private readonly logger = new Logger(CronService.name);
    private notifiedCards = new Set<string>();

    constructor(
        private readonly configService: ConfigService,
        private readonly plankaService: PlankaService,
        private readonly whatsappService: WhatsAppService,
        private readonly usersService: UsersService,
    ) { }
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCron() {
        this.logger.log('Running proactive task check for all boards (5-min ticks)...');

        try {
            const allBoardsData = await this.plankaService.getAllBoardsData();
            const now = new Date();
            // Avisa quando faltar 3 horas (ou menos) para estourar o limite, ou até se basear estritamente na hora informada
            const threshold = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

            const currentValidCards = new Set<string>();

            for (const { board, cards, memberships, users } of allBoardsData) {
                // Mapeia usuários do board pra extrair o JID do prefixo "wa_"
                const userMap = new Map<string, string>();
                for (const u of users) {
                    if (u.username?.startsWith('wa_')) {
                        const phone = u.username.slice(3);
                        if (/^\d{10,15}$/.test(phone)) {
                            userMap.set(u.id, `${phone}@s.whatsapp.net`);
                        }
                    }
                }

                for (const card of cards) {
                    if (!card.dueDate) continue;

                    const dueDate = new Date(card.dueDate);

                    // Só mantemos rastreio do card se ele estiver dentro dessa janela perigosa
                    if (dueDate > now && dueDate <= threshold) {
                        currentValidCards.add(card.id);

                        if (this.notifiedCards.has(card.id)) continue;

                        this.logger.log(`[Lembrete] Task "${card.name}" in board "${board.name}" is expiring soon.`);

                        // Quem notificar? Todos os membros. Se ninguem, notifica o autor
                        const cardMembers = memberships
                            .filter((m: any) => m.cardId === card.id)
                            .map((m: any) => m.userId);

                        const targetUsers = cardMembers.length > 0 ? cardMembers : (card.authorId ? [card.authorId] : []);

                        for (const targetUserId of targetUsers) {
                            // Encontra o telefone diretamente via usersService mapping (a base real) ou mapeamento prefixado
                            let jid = userMap.get(targetUserId);
                            if (!jid) {
                                // Fallback para a base de Whitelist via usersService
                                const wppNum = this.usersService.getWhatsAppNumber(targetUserId);
                                if (wppNum) jid = wppNum;
                            }

                            if (jid) {
                                await this.whatsappService.sendText(
                                    jid,
                                    `⏰ *Lembrete de Atividade:*\nO cartão/tarefa *${card.name}* do quadro _${board.name}_ está programado(a) para às ${dueDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}, confira se precisa finalizar!`
                                );
                                this.logger.log(`Notification sent to ${jid} for card ${card.id}`);
                            }
                        }

                        // Marca como notificado local (na memória durante o Runtime)
                        this.notifiedCards.add(card.id);
                    }
                }
            }

            // Cleanup de memoria: removemos dos 'notifiedCards' aqueles que não estão mais na janela de treshold
            for (const cardId of this.notifiedCards) {
                if (!currentValidCards.has(cardId)) {
                    this.notifiedCards.delete(cardId);
                }
            }

        } catch (error: any) {
            this.logger.error(`Error in proactive check: ${error.message}`);
        }
    }
}
