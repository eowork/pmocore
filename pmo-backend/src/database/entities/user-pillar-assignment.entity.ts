import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'user_pillar_assignments' })
export class UserPillarAssignment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ columnType: 'uuid' })
  userId!: string;

  // varchar(50) guarded by the chk_pillar_type CHECK constraint — see the note on
  // ConstructionDocumentChecklist.submissionStatus for why this must be declared as an enum.
  @Enum({
    items: [
      'HIGHER_EDUCATION',
      'ADVANCED_EDUCATION',
      'RESEARCH',
      'TECHNICAL_ADVISORY',
    ],
    columnType: 'varchar(50)',
  })
  pillarType!: string;

  @Property({ nullable: true, columnType: 'uuid' })
  assignedBy?: string;

  @Property({ defaultRaw: 'NOW()', columnType: 'timestamptz' })
  assignedAt: Date = new Date();
}
