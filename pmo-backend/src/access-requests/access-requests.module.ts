import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequest } from '../database/entities';
import { UsersModule } from '../users/users.module';
import { ActivityLogModule } from '../activity-logs/activity-log.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([AccessRequest]),
    UsersModule,
    ActivityLogModule,
  ],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService],
})
export class AccessRequestsModule {}
