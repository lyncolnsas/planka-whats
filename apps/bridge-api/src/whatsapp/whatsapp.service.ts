import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    AuthenticationState,
    downloadContentFromMessage,
    jidNormalizedUser,
    proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import * as qrcode from 'qrcode-terminal';
import * as path from 'path';
import * as fs from 'fs';
import { Subject } from 'rxjs';
import { WhatsAppContact } from '@planka/shared-types';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WhatsAppService.name);
    private sock: WASocket | null = null;
    private state: AuthenticationState | null = null;
    private saveCreds: () => Promise<void> = async () => { };
    private cachedVersion: any = null;

    private contacts: Map<string, WhatsAppContact> = new Map();
    private get CONTACTS_FILE(): string {
        const sessionBase = process.env.WA_SESSION_PATH
            ? path.dirname(process.env.WA_SESSION_PATH)
            : path.join(process.cwd(), 'data');
        return path.join(sessionBase, 'whatsapp-contacts.json');
    }

    public qrCode: string | null = null;
    public connected = false;

    public readonly messageUpsert$ = new Subject<any>();

    constructor(private readonly configService: ConfigService) { }

    async onModuleInit() {
        this.logger.log(`WhatsApp Service starting. Local Storage: ${this.CONTACTS_FILE}`);
        await this.connectToWhatsApp();
    }

    onModuleDestroy() {
        if (this.sock) {
            this.sock.ev.removeAllListeners('connection.update');
            this.sock.ev.removeAllListeners('creds.update');
        }
    }

    async connectToWhatsApp() {
        // Priority: ENV var (for Docker volume) → fallback to local path
        const sessionPath = process.env.WA_SESSION_PATH || path.join(process.cwd(), 'data', 'whatsapp-session');
        const dataDir = path.dirname(sessionPath);

        this.logger.log(`[WhatsApp] Session path: ${sessionPath}`);

        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        this.saveCreds = saveCreds;

        if (!this.cachedVersion) {
            try {
                const { version } = await fetchLatestBaileysVersion();
                this.cachedVersion = version;
            } catch (e) {
                this.cachedVersion = [2, 3000, 1015901307];
            }
        }

        this.sock = makeWASocket({
            version: this.cachedVersion,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            logger: pino({ level: 'silent' }),
            browser: ['Planka Bridge', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            syncFullHistory: true,
            markOnlineOnConnect: true,
            shouldSyncHistoryMessage: () => true,
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) this.qrCode = qr;

            if (connection === 'close') {
                this.qrCode = null;
                this.connected = false;
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    // IMPORTANT: Never rmdir the session folder itself — it's a Docker volume mount.
                    // Only delete files inside it to clear the session state.
                    try {
                        if (fs.existsSync(sessionPath)) {
                            for (const entry of fs.readdirSync(sessionPath)) {
                                try {
                                    fs.rmSync(path.join(sessionPath, entry), { recursive: true, force: true });
                                } catch (e) { /* ignore individual lock errors */ }
                            }
                        }
                    } catch (e) {
                        this.logger.error('Failed to clear session files on logout');
                    }
                }
                setTimeout(() => this.connectToWhatsApp(), 3000);
            } else if (connection === 'open') {
                this.qrCode = null;
                this.connected = true;
                this.logger.log('WhatsApp connection re-established.');
            }
        });

        this.sock.ev.on('messages.upsert', (m) => {
            this.logger.log(`[MSG_UPSERT] type=${m.type} count=${m.messages?.length}`);
            for (const msg of (m.messages || [])) {
                const from = msg.key?.remoteJid || 'unknown';
                const fromMe = msg.key?.fromMe;
                const text = msg.message ? this.getMessageText(msg.message) : '';
                this.logger.log(`[MSG] from=${from} fromMe=${fromMe} type=${m.type} text="${text?.substring(0, 50)}"`);

                // Process incoming: type='notify' (standard) or type='append' with fromMe=false (some clients)
                if ((m.type === 'notify' || m.type === 'append') && !fromMe) {
                    this.messageUpsert$.next(msg);
                }

                // Update contacts from incoming messages regardless of type
                if (from && (from.endsWith('@s.whatsapp.net') || from.endsWith('@c.us'))) {
                    if (msg.pushName) this.updateContacts([{ id: from, name: msg.pushName }]);
                }
            }
        });

        // LOAD BEFORE LISTENERS
        this.loadContacts();

        // CAPTURE ALL POSSIBLE CONTACT EVENTS
        this.sock.ev.on('contacts.set' as any, (payload: any) => {
            const list = payload?.contacts || [];
            this.logger.log(`[EVENT] contacts.set: ${list.length} units`);
            this.updateContacts(list);
        });

        this.sock.ev.on('contacts.upsert' as any, (contacts: any) => {
            this.logger.log(`[EVENT] contacts.upsert: ${contacts.length} units`);
            this.updateContacts(contacts);
        });

        this.sock.ev.on('contacts.update' as any, (updates: any) => {
            this.updateContacts(updates);
        });

        this.sock.ev.on('messaging-history.set' as any, (payload: any) => {
            const { contacts = [], chats = [], messages = [] } = payload;
            this.logger.log(`[HISTORY] Syncing: ${contacts.length} contacts, ${chats.length} chats.`);
            if (contacts.length > 0) this.updateContacts(contacts);
            if (chats.length > 0) this.updateContacts(chats.map(c => ({ id: c.id, name: c.name })));
            if (messages.length > 0) {
                const msgContacts = messages.map(m => ({ id: m.key.remoteJid, name: m.pushName })).filter(c => c.id);
                this.updateContacts(msgContacts);
            }
        });

        this.sock.ev.on('chats.set' as any, (chats: any) => {
            this.logger.log(`[EVENT] chats.set: ${chats.length} units`);
            this.updateContacts(chats.map(c => ({ id: c.id, name: c.name })));
        });

        this.sock.ev.on('chats.upsert' as any, (chats: any) => {
            this.updateContacts(chats.map(c => ({ id: c.id, name: c.name })));
        });
    }

    private updateContacts(newContacts: any[]) {
        if (!newContacts || !Array.isArray(newContacts)) return;

        let changed = false;
        for (const contact of newContacts) {
            const rawId = contact.id || contact.jid || contact.remoteJid;
            if (!rawId || typeof rawId !== 'string') continue;

            const id = jidNormalizedUser(rawId);
            if (!id.endsWith('@s.whatsapp.net') && !id.endsWith('@c.us')) continue;

            const existing = this.contacts.get(id);
            const name = (contact.name || contact.verifiedName || contact.notify || contact.pushName || contact.displayName || existing?.name || '') as string;

            // CRITICAL: NEVER delete or replace with empty. Only ADD or ENRICH name.
            if (!existing || (name && !existing.name) || (name && existing.name !== name)) {
                this.contacts.set(id, { id, name, notify: contact.notify || contact.pushName || existing?.notify || '' });
                changed = true;
            }
        }

        if (changed) {
            this.saveContacts();
            this.logger.log(`Database Growing: total ${this.contacts.size} contacts.`);
        }
    }

    private loadContacts() {
        // ALWAYS check for legacy location first to rescue data
        const legacy = path.join(process.cwd(), 'data', 'whatsapp-session', 'contacts.json');
        if (fs.existsSync(legacy) && !fs.existsSync(this.CONTACTS_FILE)) {
            try {
                fs.copyFileSync(legacy, this.CONTACTS_FILE);
                this.logger.log('Rescue operation: Contacts moved to permanent storage.');
            } catch (e) { }
        }

        if (fs.existsSync(this.CONTACTS_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.CONTACTS_FILE, 'utf-8'));
                this.contacts.clear();
                Object.entries(data).forEach(([id, c]: [string, any]) => this.contacts.set(id, c));
                this.logger.log(`LOADED FROM DISK: ${this.contacts.size} contacts.`);
            } catch (e) {
                this.logger.error('Failed to parse contacts file.');
            }
        }
    }

    private saveContacts() {
        try {
            const data = Object.fromEntries(this.contacts);
            fs.writeFileSync(this.CONTACTS_FILE, JSON.stringify(data, null, 2));
        } catch (e) { }
    }

    public getContacts(): WhatsAppContact[] {
        return Array.from(this.contacts.values());
    }

    public getContactName(jid: string): string | undefined {
        const contact = this.contacts.get(jid);
        return contact?.name || contact?.notify || undefined;
    }

    async sendText(to: string, text: string) {
        if (!this.sock) throw new Error('Bot offline');
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

        try {
            // Send typing presence
            await this.sock.sendPresenceUpdate('composing', jid);

            // Calculate delay: 1s base + 35ms per character. Cap at 6 seconds max latency.
            const typingDelay = Math.min(1000 + (text.length * 35), 6000);
            await new Promise(resolve => setTimeout(resolve, typingDelay));

            // Send "stop typing"
            await this.sock.sendPresenceUpdate('paused', jid);
        } catch (e: any) {
            this.logger.warn(`Failed to send presence to ${jid}: ${e.message}`);
        }

        await this.sock.sendMessage(jid, { text });
        return { status: 'sent' };
    }

    async disconnect() {
        if (this.sock) {
            try { await (this.sock as any).logout(); } catch (e) { }
            this.sock = null;
        }
        const sessionPath = process.env.WA_SESSION_PATH || path.join(process.cwd(), 'data', 'whatsapp-session');
        if (fs.existsSync(sessionPath)) {
            const entries = fs.readdirSync(sessionPath);
            for (const entry of entries) {
                if (entry !== 'contacts.json') fs.rmSync(path.join(sessionPath, entry), { recursive: true, force: true });
            }
        }
        this.connected = false;
        this.qrCode = null;
        return { status: 'disconnected' };
    }

    async forceReconnect() {
        if (this.sock) {
            try { this.sock.ws.close(); } catch (e) { }
            this.sock = null;
        }
        this.connected = false;
        this.qrCode = null;
        await this.connectToWhatsApp();
        return { status: 'reconnecting' };
    }

    async downloadMedia(message: any) {
        const type = Object.keys(message)[0];
        const media = message[type];
        // Áudio OGG as vezes não vem com mimetype definido cruamente, o Baileys tenta inferir no PTT.
        if (!media) throw new Error('No media');
        let mimtype = media.mimetype || '';

        let ext = 'jpg';
        if (type === 'imageMessage') ext = 'jpg';
        else if (type === 'videoMessage') ext = 'mp4';
        else if (type === 'audioMessage') ext = 'ogg'; // ou mp3/m4a
        else if (type === 'documentMessage') {
            if (mimtype.includes('pdf')) ext = 'pdf';
            else if (mimtype.includes('word')) ext = 'docx';
            else if (mimtype.includes('spreadsheet')) ext = 'xlsx';
            else ext = 'bin'; // arquivo arbitrário
        }

        const stream = await downloadContentFromMessage(media as any, type.replace('Message', '') as any);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        return { buffer, ext };
    }

    buildWelcomeMessage(boardName: string, inviterName: string, role: string = 'editor'): string {
        const roleText = role === 'admin' ? 'Administrador' : (role === 'viewer' ? 'Leitor (apenas visualizar)' : 'Editor (pode criar e mover tarefas)');

        return [
            `🎉 Olá! *${inviterName}* adicionou você ao quadro *"${boardName}"* no Planka!`,
            '',
            `Sua permissão é: *${roleText}*`,
            '',
            'Use os comandos:',
            '• *#ajuda* - Ver todos os comandos',
            '• *#tarefas* - Ver lista de tarefas',
            '• *#add [Título]* - Adicionar uma nova tarefa',
            '',
            'Qualquer dúvida, responda *#ajuda*. ✅',
        ].join('\n');
    }

    getMessageText(message: proto.IMessage): string {
        if (!message) return '';
        return message.conversation || message.extendedTextMessage?.text || message.imageMessage?.caption || '';
    }
}
