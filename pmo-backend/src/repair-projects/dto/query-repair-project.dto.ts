import { IsOptional, IsEnum, IsUUID, IsBoolean } from 'class-validator';
import { BooleanQuery, PaginationDto } from '../../common/dto';
import { RepairStatus, UrgencyLevel, Campus } from '../../common/enums';

export class QueryRepairProjectDto extends PaginationDto {
  @IsOptional()
  @IsEnum(RepairStatus)
  status?: RepairStatus;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgency?: UrgencyLevel;

  @IsOptional()
  @BooleanQuery()
  @IsBoolean()
  is_emergency?: boolean;

  @IsOptional()
  @IsEnum(Campus)
  campus?: Campus;

  @IsOptional()
  @IsUUID()
  repair_type_id?: string;
}
