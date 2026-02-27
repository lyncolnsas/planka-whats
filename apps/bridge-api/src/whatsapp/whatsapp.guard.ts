import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class WhatsAppGuard implements CanActivate {
    private readonly logger = new Logger(WhatsAppGuard.name);

    constructor(private readonly usersService: UsersService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const payload = request.body;

        // We only guard message events
        if (payload.event !== 'messages.upsert') {
            return true;
        }

        const remoteJid = payload.data?.key?.remoteJid;
        if (!remoteJid) {
            return true;
        }

        if (!this.usersService.isAuthorized(remoteJid)) {
            this.logger.warn(`Unauthorized access attempt from: ${remoteJid}`);
            throw new UnauthorizedException('Número não autorizado para enviar comandos.');
        }

        return true;
    }
}
