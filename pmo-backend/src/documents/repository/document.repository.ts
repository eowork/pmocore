import { EntityRepository } from '@mikro-orm/core';
import { Document } from '../../database/entities';

export class DocumentRepository extends EntityRepository<Document> {}
