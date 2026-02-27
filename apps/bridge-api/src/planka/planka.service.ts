import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

@Injectable()
export class PlankaService implements OnModuleInit {
    private readonly logger = new Logger(PlankaService.name);
    private http: AxiosInstance;
    private token: string | null = null;

    constructor(private readonly configService: ConfigService) {
        const baseURL = this.configService.get<string>('PLANKA_URL')!;
        this.http = axios.create({
            baseURL: `${baseURL}/api`,
        });
    }

    async onModuleInit() {
        try {
            await this.authenticate();
        } catch (error: any) {
            this.logger.error(`[onModuleInit] Auth failure: ${error?.message}`);
        }
    }

    async authenticate() {
        try {
            const username = this.configService.get<string>('USER_EMAIL')!;
            const password = this.configService.get<string>('USER_PASSWORD')!;
            const response = await this.http.post('/access-tokens', { emailOrUsername: username, password });
            this.token = response.data.item;
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 403 && error?.response?.data?.pendingToken) {
                const pendingToken = error.response.data.pendingToken;
                const termsResponse = await this.http.get('/terms');
                const signature = termsResponse.data.item.signature;
                const acceptResponse = await this.http.post('/access-tokens/accept-terms', { pendingToken, signature });
                this.token = acceptResponse.data.item;
                return;
            }
            throw error;
        }
    }

    private getAuthHeaders() {
        return { Authorization: `Bearer ${this.token}` };
    }

    async getOrCreateUser(phone: string, name: string): Promise<any> {
        const username = `wa_${phone}`;
        const email = `${username}@whatsapp.planka`;
        const password = `WA_PWD_${phone}`;
        try {
            if (!this.token) await this.authenticate();
            const response = await this.http.post(
                '/users',
                // Planka requires `role` field. 'boardUser' = regular user (no system admin).
                // Project Manager promotion is done separately via addProjectManager().
                { email, username, password, name, role: 'boardUser' },
                { headers: this.getAuthHeaders() }
            );
            return response.data.item;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 409) {
                // User already exists — find and return them
                const usersResponse = await this.http.get('/users', { headers: this.getAuthHeaders() });
                const user = usersResponse.data.items.find((u: any) => u.username === username);
                if (user) return user;
            }
            const status = axios.isAxiosError(error) ? error.response?.status : null;
            const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error.message;
            this.logger.error(`getOrCreateUser failed for ${phone}: HTTP ${status} — ${detail}`);
            throw error;
        }
    }

    async createCard(boardId: string, listId: string, name: string, description?: string, authorId?: string, dueDate?: string, cardType: string = 'story'): Promise<any> {
        try {
            if (!this.token) await this.authenticate();
            // Correto Endpoint Planka > v1.x: (type and position are required)
            const payload: any = { boardId, name, type: cardType, position: 65535 };
            if (description) payload.description = description;
            if (authorId) payload.authorId = authorId;
            if (dueDate) payload.dueDate = dueDate;

            const response = await this.http.post(`/lists/${listId}/cards`, payload, { headers: this.getAuthHeaders() });
            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                await this.authenticate();
                return this.createCard(boardId, listId, name, description, authorId, dueDate, cardType);
            }
            const status = axios.isAxiosError(error) ? error.response?.status : null;
            const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error.message;
            this.logger.error(`createCard failed: HTTP ${status} — ${detail}`);
            throw error;
        }
    }

    async createTaskList(cardId: string, name: string): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.post(`/cards/${cardId}/task-lists`, { name, position: 65535 }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async createTask(taskListId: string, name: string): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.post(`/task-lists/${taskListId}/tasks`, { name, position: 65535, isCompleted: false }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async addCardMembership(cardId: string, userId: string): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.post(`/cards/${cardId}/card-memberships`, { userId }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async addCardLabel(cardId: string, labelId: string): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.post(`/cards/${cardId}/card-labels`, { labelId }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async updateCardStopwatch(cardId: string): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.patch(`/cards/${cardId}`, {
            stopwatch: { total: 0, startedAt: new Date().toISOString() }
        }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async getBoardEntities(boardId: string) {
        if (!this.token) await this.authenticate();
        const response = await this.http.get(`/boards/${boardId}`, { headers: this.getAuthHeaders() });
        const inc = response.data?.included || {};
        return {
            users: inc.users || [],
            labels: inc.labels || [],
        };
    }

    async getCards(boardId: string) {
        if (!this.token) await this.authenticate();
        // Na v1.x+, cartões vêm embutidos na resposta de Board
        const response = await this.http.get(`/boards/${boardId}`, { headers: this.getAuthHeaders() });
        return response.data?.included?.cards || [];
    }

    async getCardsAndLists(boardId: string) {
        if (!this.token) await this.authenticate();
        // Na v1.x+, cartões vêm embutidos na resposta de Board (dentro de included.cards e included.lists)
        const response = await this.http.get(`/boards/${boardId}`, { headers: this.getAuthHeaders() });
        const cards = response.data?.included?.cards || [];
        const lists = response.data?.included?.lists || [];
        return { cards, lists };
    }

    async uploadAttachment(cardId: string, fileBuffer: Buffer, fileName: string) {
        if (!this.token) await this.authenticate();
        const form = new FormData();
        form.append('file', fileBuffer, { filename: fileName });
        const response = await this.http.post(`/cards/${cardId}/attachments`, form, { headers: { ...this.getAuthHeaders(), ...form.getHeaders() } });
        return response.data;
    }

    async getBoardInfo(boardId: string) {
        if (!this.token) await this.authenticate();
        const response = await this.http.get(`/boards/${boardId}`, { headers: this.getAuthHeaders() });
        // Planka API: { item: { id, projectId, ... }, included: { ... } }
        return response.data.item ?? response.data;
    }

    async getUserRoleInBoard(boardId: string, userId: string): Promise<'admin' | 'editor' | 'viewer' | null> {
        try {
            if (!this.token) await this.authenticate();
            // IMPORTANT: getBoardInfo returns only `item`. We need the full response
            // which includes `included.boardMemberships` and `included.users`.
            const response = await this.http.get(`/boards/${boardId}`, { headers: this.getAuthHeaders() });
            const included = response.data.included;
            const item = response.data.item;

            if (!included) {
                this.logger.error(`getUserRoleInBoard: no 'included' in response for board ${boardId}`);
                return null;
            }

            // Check if the user is a Project Manager (system-level admin for this project)
            const projectManagers = included.projectManagers || [];
            const isProjectManager = projectManagers.some((pm: any) => pm.userId === userId);
            if (isProjectManager) return 'admin';

            // Check board membership role
            const memberships = included.boardMemberships || [];
            const membership = memberships.find((m: any) => m.userId === userId);
            if (membership) return membership.role as 'editor' | 'viewer';

            return null;
        } catch (e: any) {
            this.logger.error(`getUserRoleInBoard failed for board=${boardId} user=${userId}: ${e?.message}`);
            return null;
        }
    }

    async getUserAccessibleBoards(userId: string): Promise<{ id: string, name: string, listId: string, projectName: string }[]> {
        if (!this.token) await this.authenticate();
        const projectsRes = await this.http.get('/projects', { headers: this.getAuthHeaders() });
        const projects = projectsRes.data?.items || [];
        const boards = projectsRes.data?.included?.boards || [];

        const accessibleBoards: any[] = [];

        await Promise.all(boards.map(async (board: any) => {
            try {
                const response = await this.http.get(`/boards/${board.id}`, { headers: this.getAuthHeaders() });
                const included = response.data.included;
                if (!included) return;

                // Check membership
                const projectManagers = included.projectManagers || [];
                const isPM = projectManagers.some((pm: any) => pm.userId === userId);

                const memberships = included.boardMemberships || [];
                const isMember = memberships.some((m: any) => m.userId === userId);

                const hasAccess = isPM || isMember;
                if (!hasAccess) return;

                // Get first list
                const lists = included.lists || [];
                if (lists.length === 0) return;
                const activeLists = lists.sort((a: any, b: any) => a.position - b.position);
                const firstList = activeLists[0];

                const proj = projects.find((p: any) => p.id === board.projectId);

                accessibleBoards.push({
                    id: board.id,
                    name: board.name,
                    listId: firstList.id,
                    projectName: proj ? proj.name : 'Unknown Project'
                });
            } catch (e) { /* ignore board error */ }
        }));

        accessibleBoards.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.name.localeCompare(b.name));
        return accessibleBoards;
    }

    async getUserAccessibleProjects(userId: string): Promise<{ id: string, name: string }[]> {
        if (!this.token) await this.authenticate();
        const projectsRes = await this.http.get('/projects', { headers: this.getAuthHeaders() });
        const projects = projectsRes.data?.items || [];

        const accessibleProjects: any[] = [];

        await Promise.all(projects.map(async (proj: any) => {
            try {
                const response = await this.http.get(`/projects/${proj.id}`, { headers: this.getAuthHeaders() });
                const included = response.data.included;
                if (!included) return;

                const projectManagers = included.projectManagers || [];
                const isPM = projectManagers.some((pm: any) => pm.userId === userId);

                if (isPM) { // Pode criar quadros só se for gerente de projeto ou se a lógica do planka permitir
                    accessibleProjects.push({ id: proj.id, name: proj.name });
                }
            } catch (e) { /* ignore */ }
        }));

        return accessibleProjects;
    }

    async createBoard(projectId: string, name: string): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.post(`/projects/${projectId}/boards`, { name, type: 'kanban', position: 65535 }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async createList(boardId: string, name: string, position: number = 65535): Promise<any> {
        if (!this.token) await this.authenticate();
        const response = await this.http.post(`/boards/${boardId}/lists`, { name, position }, { headers: this.getAuthHeaders() });
        return response.data.item;
    }

    async getAllBoardsData(): Promise<Array<{ board: any; cards: any[]; lists: any[]; memberships: any[]; users: any[]; }>> {
        const result: any[] = [];
        try {
            if (!this.token) await this.authenticate();
            const headers = { Authorization: `Bearer ${this.token}` };
            const projectsRes = await this.http.get('/projects', { headers });
            const boards = projectsRes.data?.included?.boards || [];
            for (const board of boards) {
                try {
                    const boardRes = await this.http.get(`/boards/${board.id}`, { headers });
                    const included = boardRes.data?.included || {};
                    result.push({
                        board: boardRes.data?.item || board,
                        cards: included.cards || [],
                        lists: included.lists || [],
                        memberships: included.cardMemberships || [],
                        users: included.users || [],
                    });
                } catch (e) { /* ignore inaccessible */ }
            }
        } catch (e: any) {
            this.logger.error(`getAllBoardsData failed: ${e.message}`);
        }
        return result;
    }

    async getUserTasks(userId: string): Promise<any[]> {
        if (!this.token) await this.authenticate();
        const boards = await this.getUserAccessibleBoards(userId);
        const myTasks: any[] = [];

        await Promise.all(boards.map(async (b) => {
            try {
                const res = await this.http.get(`/boards/${b.id}`, { headers: this.getAuthHeaders() });
                const included = res.data.included;
                if (!included || !included.cards) return;

                const cards = included.cards || [];
                const lists = included.lists || [];

                for (const c of cards) {
                    const list = lists.find((l: any) => l.id === c.listId);
                    myTasks.push({
                        card: c,
                        listName: list ? list.name : 'Desconhecida',
                        listPosition: list ? list.position : 0,
                        cardPosition: c.position || 0,
                        boardName: b.name,
                        projectName: b.projectName
                    });
                }
            } catch (e) { /* ignore */ }
        }));

        return myTasks;
    }

    async addBoardMembership(boardId: string, userId: string, role: string = 'editor'): Promise<any> {
        try {
            if (!this.token) await this.authenticate();
            const response = await this.http.post(`/boards/${boardId}/memberships`, { role, userId }, { headers: this.getAuthHeaders() });
            return response.data.item;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 409) return null;
            throw error;
        }
    }

    async addProjectManager(projectId: string, userId: string): Promise<any> {
        try {
            if (!this.token) await this.authenticate();
            const response = await this.http.post(`/projects/${projectId}/project-managers`, { userId }, { headers: this.getAuthHeaders() });
            return response.data.item;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 409) return null;
            throw error;
        }
    }
}
