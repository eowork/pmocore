import {
  Entity,
  Enum,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { UPRReport } from './me-report.entity';
import { ChallengeOpportunityType } from '../../upr-report/enums';

@Filter({ name: 'notDeleted', cond: { deleted: false }, default: true })
@Entity({ tableName: 'upr_challenges_opportunities' })
export class UprChallengesOpportunities {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => UPRReport, {
    deleteRule: 'cascade',
    fieldName: 'report_id',
  })
  report!: UPRReport;

  @Enum({
    items: () => ChallengeOpportunityType,
    nativeEnumName: 'challenge_opportunity_type_enum',
  })
  item_type!: ChallengeOpportunityType;

  @Property({ type: 'text' })
  description: string;

  @Property({ type: 'integer' })
  sort_order: number;
}
