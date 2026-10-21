import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { BooleanQuery } from '../../common/dto';
import { SettingDataType } from '../../common/enums';

export class QuerySettingDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  order?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @BooleanQuery()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsEnum(SettingDataType)
  data_type?: SettingDataType;
}
