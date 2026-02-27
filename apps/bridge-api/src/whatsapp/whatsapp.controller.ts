import { Controller, Get, Post, Delete, Body, Res, Logger, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { PlankaService } from '../planka/planka.service';
import { NotifyMemberDto } from './notify-member.dto';
import * as QRCode from 'qrcode';

@Controller('whatsapp')
export class WhatsAppController {
    private readonly logger = new Logger(WhatsAppController.name);

    constructor(
        private readonly whatsappService: WhatsAppService,
        private readonly plankaService: PlankaService,
    ) { }

    @Get('qr')
    async getQRCode(@Res() res: Response) {
        const qr = this.whatsappService.qrCode;

        if (!qr) {
            return res.status(200).send(`
                <html>
                    <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #f0f2f5;">
                        <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
                            <h2 style="color: #128c7e;">WhatsApp Conectado</h2>
                            <p>O WhatsApp já está conectado e pronto para uso.</p>
                            <button onclick="window.close()" style="background: #128c7e; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Fechar Janela</button>
                        </div>
                    </body>
                </html>
            `);
        }

        try {
            const qrImageUrl = await QRCode.toDataURL(qr);
            return res.send(`
                <html>
                    <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #f0f2f5;">
                        <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
                            <h2 style="color: #128c7e;">Conectar WhatsApp</h2>
                            <p>Escaneie o código abaixo com o seu WhatsApp.</p>
                            <img src="${qrImageUrl}" style="width: 300px; height: 300px; margin: 20px 0;" />
                            <p style="font-size: 0.9rem; color: #666;">O QR Code expira rapidamente. Se falhar, recarregue a página.</p>
                            <script>
                                // Auto-reload page every 30 seconds to refresh QR if it expires
                                setTimeout(() => window.location.reload(), 30000);
                            </script>
                        </div>
                    </body>
                </html>
            `);
        } catch (err) {
            this.logger.error('Failed to generate QR image', err);
            return res.status(500).send('Erro ao gerar QR Code');
        }
    }

    @Get('qr-data')
    async getQRData() {
        if (this.whatsappService.connected) {
            return { connected: true, qr: null };
        }

        const qr = this.whatsappService.qrCode;
        if (!qr) {
            return { connected: false, qr: null };
        }

        try {
            const qrImageUrl = await QRCode.toDataURL(qr);
            return { connected: false, qr: qrImageUrl };
        } catch (err) {
            return { connected: false, qr: null, error: 'Failed to generate QR' };
        }
    }

    @Get('contacts')
    getContacts() {
        return this.whatsappService.getContacts();
    }

    @Get('debug')
    getDebug() {
        return {
            contactCount: this.whatsappService.getContacts().length,
            connected: this.whatsappService.connected,
            hasQr: !!this.whatsappService.qrCode
        };
    }

    @Post('notify-member')
    @HttpCode(200)
    async notifyMember(@Body() dto: NotifyMemberDto) {
        const role = dto.role || 'editor';
        const displayName = dto.contactName || dto.phone;
        this.logger.log(`Enrollment: phone="${dto.phone}", name="${displayName}", board="${dto.boardName}", role="${role}"`);

        try {
            // 1. Ensure user exists in Planka (create if new)
            const waUser = await this.plankaService.getOrCreateUser(dto.phone, displayName);
            this.logger.log(`User resolved: id=${waUser.id}, username=${waUser.username}`);

            // 2. Fetch Board info to get projectId (needed for admin promotion)
            const boardInfo = await this.plankaService.getBoardInfo(dto.boardId);
            const projectId = boardInfo.projectId;
            this.logger.log(`Board info: projectId=${projectId}`);

            // 3. Promote to Project Manager if role is 'admin'
            if (role === 'admin') {
                if (!projectId) {
                    this.logger.error(`Cannot promote to admin: projectId is undefined for board ${dto.boardId}`);
                } else {
                    this.logger.log(`Promoting ${dto.phone} to Project Manager in project ${projectId}`);
                    await this.plankaService.addProjectManager(projectId, waUser.id);
                }
            }

            // 4. Add to Board (409 = already member, handled gracefully)
            const boardRole = role === 'admin' ? 'editor' : role;
            await this.plankaService.addBoardMembership(dto.boardId, waUser.id, boardRole);
            this.logger.log(`Board membership set: role=${boardRole}`);

            // 5. Send welcome message
            const message = this.whatsappService.buildWelcomeMessage(dto.boardName, dto.inviterName, role);
            await this.whatsappService.sendText(dto.phone, message);

            return { status: 'enrolled_and_notified', role };
        } catch (error: any) {
            this.logger.error(`Enrollment failed for ${dto.phone}: ${error?.message}`);
            // Always send welcome message even on partial failure
            try {
                const message = this.whatsappService.buildWelcomeMessage(dto.boardName, dto.inviterName, role);
                await this.whatsappService.sendText(dto.phone, message);
            } catch { }
            return { status: 'partial_success', error: error?.message };
        }
    }

    @Post('sync-user')
    async syncUser(@Body() body: { phone: string, name: string }) {
        return this.plankaService.getOrCreateUser(body.phone, body.name);
    }

    @Post('restart')
    @HttpCode(200)
    async restart() {
        return this.whatsappService.forceReconnect();
    }

    @Delete('session')
    @HttpCode(200)
    async disconnect() {
        return this.whatsappService.disconnect();
    }
}
