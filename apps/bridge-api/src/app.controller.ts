import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PlankaTask } from '@planka/shared-types';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('test-types')
    testTypes(): Partial<PlankaTask> {
        return {
            title: 'Validating Monorepo Types',
            isCompleted: true,
        };
    }
}
