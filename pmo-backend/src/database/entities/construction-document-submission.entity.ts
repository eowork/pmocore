import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';

@Entity({ tableName: 'construction_document_submissions' })
export class ConstructionDocumentSubmission {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ type: 'uuid', columnType: 'uuid' })
  checklistItemId!: string;

  @Property({ type: 'uuid', columnType: 'uuid' })
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

  @Property({ type: 'uuid', columnType: 'uuid' })
  documentId!: string;

  @Property({ type: 'integer' })
  version!: number;

  @Property({ type: 'uuid', columnType: 'uuid' })
  submittedBy!: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  submittedAt: Date = new Date();

  @Property({ nullable: true, columnType: 'text' })
  submissionNotes?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();
}
