import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  ACCESS_LEVEL_VALUES,
  ACCESS_REQUEST_MODULE_VALUES,
} from '../../common/enums';

export class CreateAccessRequestDto {
  @ApiProperty({ example: 'coi', enum: ACCESS_REQUEST_MODULE_VALUES })
  @IsIn(ACCESS_REQUEST_MODULE_VALUES)
  @IsNotEmpty()
  requested_module!: string;

  @ApiProperty({ example: 'Contributor', enum: ACCESS_LEVEL_VALUES })
  @IsIn(ACCESS_LEVEL_VALUES)
  @IsNotEmpty()
  requested_level!: string;

  @ApiProperty({
    required: false,
    example: 'I handle infrastructure project encoding for my office.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  justification?: string;
}
