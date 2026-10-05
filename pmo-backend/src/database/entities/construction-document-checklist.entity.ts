import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';
import {
  ConstructionDocumentChecklistRepository
} from '../../construction-projects/repository/construction-document-checklist.repository';

/**
 * Phase KB-E: Per-project document checklist instances.
 * Lazy-initialized — rows are created on first GET checklist call,
 * pulling from `construction_document_types` reference.
 *
 * `linked_document_id` references `documents.id` (the actual uploaded file
 * in the existing flat documents table). Decoupled lifecycle: a checklist
 * item exists for compliance tracking even before any file is uploaded.
 */
@Entity({
  tableName: 'construction_document_checklist',
  repository: () => ConstructionDocumentChecklistRepository,
})
export class ConstructionDocumentChecklist {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  projectId!: string;

  // Read-only link back to the owning project, so queries can populate() the parent.
  //
  // persist: false — project_id stays owned by the projectId scalar above, which every
  //   existing write path sets. Two properties mapping one column collide on INSERT.
  // hidden: true — keeps the relation out of JSON, so endpoints returning this entity
  //   directly serialise exactly as they did before.
  // createForeignKeyConstraint: false — this database has no foreign keys; declaring a
  //   relation must not make the schema differ want to add one.
  @ManyToOne(() => ConstructionProject, {
    fieldName: 'project_id',
    persist: false,
    hidden: true,
    createForeignKeyConstraint: false,
  })
  project!: ConstructionProject;

  @Property({ columnType: 'uuid' })
  documentTypeId!: string;

  // The column is varchar(30) guarded by a CHECK constraint listing these five values
  // (construction_document_checklist_status_check). mikro-orm introspects such a column as an
  // enum, so declaring it as a plain string made every schema diff want to convert it back to
  // varchar — a statement that dropped a constraint under a name that does not exist here, so
  // the drift never cleared.
  @Enum({
    items: [
      'NOT_SUBMITTED',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
    ],
    columnType: 'varchar(30)',
    default: 'NOT_SUBMITTED',
  })
  submissionStatus: string = 'NOT_SUBMITTED';

  @Property({ nullable: true, columnType: 'uuid' })
  submittedBy?: string;

  @Property({ nullable: true, columnType: 'timestamptz' })
  submittedAt?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  reviewedBy?: string;

  @Property({ nullable: true, columnType: 'timestamptz' })
  reviewedAt?: Date;

  @Property({ nullable: true, columnType: 'text' })
  reviewNotes?: string;

  @Property({ type: 'integer', default: 0 })
  currentVersion: number = 0;

  @Property({ nullable: true, columnType: 'date' })
  expiryDate?: Date;

  @Property({ nullable: true, columnType: 'uuid' })
  linkedDocumentId?: string;

  @Property({ nullable: true, columnType: 'text' })
  remarks?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();
}
