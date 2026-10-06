import { EntityRepository } from '@mikro-orm/core';
import { OperationFinancial } from '../../database/entities';

export class OperationFinancialRepository extends EntityRepository<OperationFinancial> {}
