import { EntityRepository } from '@mikro-orm/core';
import { QuarterlyReport } from '../../database/entities';

export class QuarterlyReportRepository extends EntityRepository<QuarterlyReport> {}
