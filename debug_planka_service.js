"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PlankaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlankaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const form_data_1 = require("form-data");
let PlankaService = PlankaService_1 = class PlankaService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(PlankaService_1.name);
        this.token = null;
        const baseURL = this.configService.get('PLANKA_URL');
        this.http = axios_1.default.create({
            baseURL: `${baseURL}/api`,
        });
    }
    async onModuleInit() {
        await this.authenticate();
    }
    async authenticate() {
        try {
            const email = this.configService.get('USER_EMAIL');
            const password = this.configService.get('USER_PASSWORD');
            this.logger.log(`Authenticating with Planka as ${email}...`);
            const response = await this.http.post('/access-tokens', {
                emailOrUsername: email,
                password,
            });
            this.token = response.data.item;
            this.logger.log('Authenticated successfully with Planka');
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                this.logger.warn('Authentication failed. Attempting to register user...');
                try {
                    await this.register();
                    return this.authenticate();
                }
                catch (regError) {
                    this.logger.error('Registration failed/skipped during recovery.');
                }
            }
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Planka authentication failed: ${message}`);
            if (axios_1.default.isAxiosError(error) && error.response) {
                this.logger.error(`Error details: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }
    async register() {
        const email = this.configService.get('USER_EMAIL');
        const password = this.configService.get('USER_PASSWORD');
        const username = email.split('@')[0];
        try {
            this.logger.log(`Attempting to register user ${email}...`);
            await this.http.post('/users', {
                email,
                username,
                password,
                name: username,
            });
            this.logger.log('User registered successfully');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (axios_1.default.isAxiosError(error) && error.response?.status === 409) {
                this.logger.warn('User already exists (Conflict). Cannot register.');
            }
            else {
                this.logger.error(`Failed to register user: ${message}`);
            }
            throw error;
        }
    }
    getAuthHeaders() {
        return {
            Authorization: `Bearer ${this.token}`,
        };
    }
    async createCard(boardId, listId, name, description, authorId) {
        try {
            if (!this.token)
                await this.authenticate();
            const response = await this.http.post('/cards', {
                boardId,
                listId,
                name,
                description,
                authorId,
            }, {
                headers: this.getAuthHeaders(),
            });
            return response.data;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to create card on Planka: ${message}`);
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                this.logger.warn('Token expired, retrying authentication...');
                await this.authenticate();
                return this.createCard(boardId, listId, name, description);
            }
            throw error;
        }
    }
    async getCards(boardId) {
        try {
            if (!this.token)
                await this.authenticate();
            const response = await this.http.get(`/boards/${boardId}/cards`, {
                headers: this.getAuthHeaders(),
            });
            return response.data.items;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to fetch cards for board ${boardId}: ${message}`);
            if (axios_1.default.isAxiosError(error) && error.response?.status === 401) {
                await this.authenticate();
                return this.getCards(boardId);
            }
            throw error;
        }
    }
    async getLists(boardId) {
        try {
            if (!this.token)
                await this.authenticate();
            const response = await this.http.get(`/boards/${boardId}/lists`, {
                headers: this.getAuthHeaders(),
            });
            return response.data.items;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to fetch lists for board ${boardId}: ${message}`);
            throw error;
        }
    }
    async uploadAttachment(cardId, fileBuffer, fileName) {
        try {
            if (!this.token)
                await this.authenticate();
            const form = new form_data_1.default();
            form.append('file', fileBuffer, {
                filename: fileName,
            });
            const response = await this.http.post(`/cards/${cardId}/attachments`, form, {
                headers: {
                    ...this.getAuthHeaders(),
                    ...form.getHeaders(),
                },
            });
            return response.data;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to upload attachment to card ${cardId}: ${message}`);
            throw error;
        }
    }
};
exports.PlankaService = PlankaService;
exports.PlankaService = PlankaService = PlankaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PlankaService);
//# sourceMappingURL=planka.service.js.map