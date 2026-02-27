import { Module, Global } from '@nestjs/common';
import { PlankaService } from './planka.service';

@Global()
@Module({
    providers: [PlankaService],
    exports: [PlankaService],
})
export class PlankaModule { }
