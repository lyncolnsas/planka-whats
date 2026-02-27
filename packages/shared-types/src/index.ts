export interface PlankaTask {
    id: string;
    title: string;
    description?: string;
    listId: string;
    boardId: string;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    isCompleted: boolean;
}

export interface WhatsAppMessage {
    id: string;
    from: string;
    text: string;
    timestamp: number;
    media?: {
        mediaKey: string;
        directPath: string;
        url: string;
        mimetype: string;
    };
}

export interface BotCommand {
    type: 'CREATE_TASK' | 'LIST_TASKS' | 'COMPLETE_TASK' | 'HELP' | 'UNKNOWN' | 'CREATE_BOARD';
    payload: any;
    rawMessage: WhatsAppMessage;
}

export interface WhatsAppContact {
    id: string;
    name?: string;
    notify?: string;
    imgUrl?: string;
}
