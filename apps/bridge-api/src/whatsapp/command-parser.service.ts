import { Injectable } from '@nestjs/common';
import { BotCommand, WhatsAppMessage } from '@planka/shared-types';

@Injectable()
export class CommandParserService {
    private readonly COMMAND_PREFIX = '#';

    parse(message: WhatsAppMessage): BotCommand {
        const text = message.text.trim();

        if (!text.startsWith(this.COMMAND_PREFIX)) {
            return {
                type: 'UNKNOWN',
                payload: null,
                rawMessage: message,
            };
        }

        const [rawCommand, ...args] = text.split(' ');
        const commandName = rawCommand.slice(1).toLowerCase();
        const fullArgs = args.join(' ').trim();

        if (commandName === '') {
            return {
                type: 'HELP',
                payload: null,
                rawMessage: message,
            };
        }

        switch (commandName) {
            case 'add':
                return {
                    type: 'CREATE_TASK',
                    payload: { title: fullArgs },
                    rawMessage: message,
                };
            case 'addquadro':
                return {
                    type: 'CREATE_BOARD',
                    payload: { name: fullArgs },
                    rawMessage: message,
                };
            case 'hoje':
                return {
                    type: 'LIST_TASKS',
                    payload: { filter: 'today' },
                    rawMessage: message,
                };
            case 'tarefas':
            case 'agenda':
                return {
                    type: 'LIST_TASKS',
                    payload: { filter: 'all' },
                    rawMessage: message,
                };
            case 'help':
            case 'ajuda':
                return {
                    type: 'HELP',
                    payload: null,
                    rawMessage: message,
                };
            default:
                return {
                    type: 'UNKNOWN',
                    payload: null,
                    rawMessage: message,
                };
        }
    }

    getHelpMessage(): string {
        return [
            '👋 *Olá! Eu sou o seu Assistente de Produtividade.*',
            '',
            'Aqui estão os comandos que entendo:',
            '',
            '✅ *#add [nome]* - Cria uma nova tarefa no seu Kanban (pergunta o quadro).',
            '🏗️ *#addquadro [nome]* - Cria um novo quadro num projeto.',
            '📋 *#agenda* - Mostra todas as tarefas de todos os quadros.',
            '❓ *#* ou *#ajuda* - Mostra esta lista de opções.',
            '',
            '💡 _Dica: Tente enviar apenas `#add` e siga o menu!_',
        ].join('\n');
    }

    getUnknownCommandMessage(): string {
        return [
            '❌ *Ops! Não entendi esse comando.*',
            '',
            'Tente um destes comandos principais:',
            '• *#add*',
            '• *#addquadro*',
            '• *#agenda*',
            '• *#*',
        ].join('\n');
    }
}
