import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ACCESS_LEVEL_VALUES } from '../../common/enums';

export class DecideAccessRequestDto {
  @ApiProperty({ example: 'APPROVE', enum: ['APPROVE', 'DENY'] })
  @IsIn(['APPROVE', 'DENY'])
  @IsNotEmpty()
  decision!: 'APPROVE' | 'DENY';

  @ApiProperty({
    required: false,
    description:
      'Optional downgrade of the granted level (defaults to the requested level on approval).',
    enum: ACCESS_LEVEL_VALUES,
  })
  @IsOptional()
  @IsIn(ACCESS_LEVEL_VALUES)
  granted_level?: string;

  @ApiProperty({
    required: false,
    example:
      'Granted Viewer instead of Contributor pending supervisor confirmation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decision_note?: string;
}
