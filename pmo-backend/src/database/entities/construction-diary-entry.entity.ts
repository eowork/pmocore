import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ConstructionProject } from './construction-project.entity';
import {
  ConstructionDiaryEntryRepository
} from '../../construction-projects/repository/construction-diary-entry.repository';

@Entity({
  tableName: 'construction_diary_entries',
  repository: () => ConstructionDiaryEntryRepository,
})
export class ConstructionDiaryEntry {
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

  @Property({ columnType: 'date' })
  entryDate!: string;

  @Property({ nullable: true, length: 255 })
  title?: string;

  @Property({ columnType: 'text' })
  content!: string;

  @Property({ nullable: true, columnType: 'uuid' })
  authorId?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({
    defaultRaw: 'NOW()',
    onUpdate: () => new Date(),
    columnType: 'timestamptz',
  })
  updatedAt: Date = new Date();
}
