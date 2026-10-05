import { ConstructionDiaryEntry } from '../../database/entities';
import { EntityRepository } from '@mikro-orm/core';

export class ConstructionDiaryEntryRepository extends EntityRepository<ConstructionDiaryEntry> {}
