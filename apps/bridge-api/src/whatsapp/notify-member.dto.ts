export class NotifyMemberDto {
    phone!: string;        // e.g. "5511999999999"
    contactName?: string;  // Real WhatsApp contact name (e.g. "João Silva")
    boardName!: string;
    inviterName!: string;
    boardId!: string;
    role?: string;
}
