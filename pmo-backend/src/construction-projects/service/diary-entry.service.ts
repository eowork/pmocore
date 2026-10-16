import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  ConstructionDiaryEntry,
  ConstructionProject,
} from '../../database/entities';
import {
  ConstructionDiaryEntryRepository,
  DiaryEntryRow,
} from '../repository/construction-diary-entry.repository';
import { ConstructionProjectRepository } from '../repository/construction-project.repository';
import { ConstructionAccessService } from './construction-access.service';
import { ActivityAction } from '../../activity-logs/activity-log.entity';
import { JwtPayload } from '../../common/interfaces';
import { CreateDiaryEntryDto, UpdateDiaryEntryDto } from '../dto';

/**
 * Project diary (Phase KD-E). Split out of ConstructionProjectsService; the URLs and
 * behaviour are unchanged, including the diary's own "Project <id> not found" wording.
 */
@Injectable()
export class DiaryEntryService {
  constructor(
    @InjectRepository(ConstructionDiaryEntry)
    private readonly diaryRepo: ConstructionDiaryEntryRepository,
    @InjectRepository(ConstructionProject)
    private readonly cpRepo: ConstructionProjectRepository,
    private readonly access: ConstructionAccessService,
  ) {}

  findDiaryEntries(projectId: string): Promise<DiaryEntryRow[]> {
    return this.diaryRepo.findForProject(projectId);
  }

  async createDiaryEntry(
    projectId: string,
    dto: CreateDiaryEntryDto,
    user: JwtPayload,
  ): Promise<ConstructionDiaryEntry> {
    if (!(await this.cpRepo.existsActive(projectId)))
      throw new NotFoundException(`Project ${projectId} not found`);
    // Record-scope guard — the delete counterpart already had one.
    await this.access.assertProjectPermission(
      projectId,
      user.sub,
      user,
      'canCreate',
    );

    const entry = this.diaryRepo.create({
      projectId,
      entryDate: dto.entry_date,
      title: dto.title,
      content: dto.content,
      authorId: user.sub,
    });
    await this.diaryRepo.getEntityManager().persist(entry).flush();

    this.access.fireLog(user, ActivityAction.CREATE, entry.id, {
      entityType: 'diary_entry',
      projectId,
      entryDate: dto.entry_date,
    });
    return entry;
  }

  async updateDiaryEntry(
    projectId: string,
    entryId: string,
    dto: UpdateDiaryEntryDto,
    user: JwtPayload,
  ): Promise<ConstructionDiaryEntry> {
    const entry = await this.diaryRepo.findOne({ id: entryId, projectId });
    if (!entry) {
      throw new NotFoundException(
        `Diary entry ${entryId} not found for project ${projectId}`,
      );
    }
    // Record-scope guard — the delete counterpart already had one.
    await this.access.assertProjectPermission(
      projectId,
      user.sub,
      user,
      'canEdit',
    );
    const before = {
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
    };
    if (dto.entry_date !== undefined) entry.entryDate = dto.entry_date;
    if (dto.title !== undefined) entry.title = dto.title;
    if (dto.content !== undefined) entry.content = dto.content;
    await this.diaryRepo.getEntityManager().flush();

    const after = {
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
    };
    const changedFields = Object.keys(after).filter(
      (k) =>
        JSON.stringify((before as any)[k]) !==
        JSON.stringify((after as any)[k]),
    );
    this.access.fireLog(user, ActivityAction.UPDATE, entryId, {
      entityType: 'diary_entry',
      projectId,
      changedFields,
      previousValues: before,
      newValues: after,
    });
    return entry;
  }

  async removeDiaryEntry(
    projectId: string,
    entryId: string,
    user: JwtPayload,
  ): Promise<void> {
    await this.access.assertProjectPermission(
      projectId,
      user.sub,
      user,
      'canDelete',
    );
    const entry = await this.diaryRepo.findOne({ id: entryId, projectId });
    if (!entry) {
      throw new NotFoundException(
        `Diary entry ${entryId} not found for project ${projectId}`,
      );
    }
    const snapshot = {
      entryDate: entry.entryDate,
      title: entry.title,
      content: entry.content,
    };
    await this.diaryRepo.getEntityManager().remove(entry).flush();
    this.access.fireLog(user, ActivityAction.DELETE, entryId, {
      entityType: 'diary_entry',
      projectId,
      previousValues: snapshot,
    });
  }
}
