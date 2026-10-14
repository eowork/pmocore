import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConstructionProjectsController } from './construction-projects.controller';
import { PublicConstructionController } from './public-construction.controller';
import { ConstructionProjectsService } from './construction-projects.service';
import { MilestoneController } from './controller/milestone.controller';
import { TimelineDiaryEntryController } from './controller/timeline-diary-entry.controller';
import { MovController } from './controller/mov.controller';
import { DiaryEntryController } from './controller/diary-entry.controller';
import { RevisionOrderController } from './controller/revision-order.controller';
import { ProgressReportController } from './controller/progress-report.controller';
import { GalleryController } from './controller/gallery.controller';
import { DocumentTypeController } from './controller/document-type.controller';
import { DocumentChecklistController } from './controller/document-checklist.controller';
import { ConstructionAccessService } from './service/construction-access.service';
import { MilestoneService } from './service/milestone.service';
import { TimelineDiaryEntryService } from './service/timeline-diary-entry.service';
import { MovService } from './service/mov.service';
import { DiaryEntryService } from './service/diary-entry.service';
import { RevisionOrderService } from './service/revision-order.service';
import { ProgressReportService } from './service/progress-report.service';
import { GalleryService } from './service/gallery.service';
import { DocumentTypeService } from './service/document-type.service';
import { DocumentChecklistService } from './service/document-checklist.service';
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
  // Sub-resource controllers are listed first so their multi-segment routes are matched
  // before the ':id' routes on ConstructionProjectsController.
  controllers: [
    MilestoneController,
    TimelineDiaryEntryController,
    MovController,
    DiaryEntryController,
    RevisionOrderController,
    ProgressReportController,
    GalleryController,
    DocumentTypeController,
    DocumentChecklistController,
    ConstructionProjectsController,
    PublicConstructionController,
  ],
  providers: [
    ConstructionProjectsService,
    ConstructionAccessService,
    MilestoneService,
    TimelineDiaryEntryService,
    MovService,
    DiaryEntryService,
    RevisionOrderService,
    ProgressReportService,
    GalleryService,
    DocumentTypeService,
    DocumentChecklistService,
  ],
  exports: [ConstructionProjectsService, ConstructionAccessService],
})
export class ConstructionProjectsModule {}
