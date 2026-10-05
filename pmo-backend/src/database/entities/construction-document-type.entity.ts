import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import {
  ConstructionDocumentTypeRepository
} from '../../construction-projects/repository/construction-document-type.repository';


/**
 * Phase KB-E: Reference table for CPES/infrastructure document types.
 * Seeded at migration time with 27 standard types across 6 groups.
 * Admin-extensible via the construction-document-types endpoints.
 */
@Entity({
  tableName: 'construction_document_types',
  repository: () => ConstructionDocumentTypeRepository,
})
export class ConstructionDocumentType {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 20 })
  groupCode!: string;

  @Property({ length: 100 })
  groupLabel!: string;

  @Property({ length: 50, unique: true })
  typeCode!: string;

  @Property({ length: 255 })
  typeLabel!: string;

  @Property({ type: 'boolean', default: true })
  isRequired: boolean = true;

  @Property({ type: 'integer', default: 0 })
  sortOrder: number = 0;

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({ nullable: true, columnType: 'text' })
  templateUrl?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();
}
