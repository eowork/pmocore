import { EntityRepository } from '@mikro-orm/core';
import { FiscalYear } from '../../database/entities';

export class FiscalYearRepository extends EntityRepository<FiscalYear> {}
