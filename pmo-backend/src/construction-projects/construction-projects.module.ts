import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConstructionProjectsController } from './construction-projects.controller';
import { PublicConstructionController } from './public-construction.controller';
import { ConstructionProjectsService } from './construction-projects.service';
import { UploadsModule } from '../uploads';
import { ActivityLogModule } from '../activity-logs/activity-log.module';
import {
  ConstructionProject,
  ConstructionMilestone,
  ConstructionTimelineEntry,
  ConstructionRevisionOrder,
  ConstructionProgressReport,
  ConstructionDocumentType,
  ConstructionDocumentChecklist,
  ConstructionDocumentSubmission,
  ConstructionDocumentFolder,
  ConstructionDiaryEntry,
  ConstructionGallery,
  ConstructionMovEntry,
  RecordAssignment,
  Project,
  Document,
  UserModuleAssignment,
  UserPermissionOverride,
} from '../database/entities';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      ConstructionProject,
      ConstructionMilestone,
      ConstructionTimelineEntry,
      ConstructionRevisionOrder,
      ConstructionProgressReport,
      ConstructionDocumentType,
      ConstructionDocumentChecklist,
      ConstructionDocumentSubmission,
      ConstructionDocumentFolder,
      ConstructionDiaryEntry,
      ConstructionGallery,
      ConstructionMovEntry,
      RecordAssignment,
      Project,
      Document,
      UserModuleAssignment,
      UserPermissionOverride,
    ]),
    UploadsModule,
    ActivityLogModule,
  ],
  controllers: [ConstructionProjectsController, PublicConstructionController],
  providers: [ConstructionProjectsService],
  exports: [ConstructionProjectsService],
})
export class ConstructionProjectsModule {}
