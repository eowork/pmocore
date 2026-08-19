import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDiaryEntryDto {
  @IsDateString()
  entry_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateDiaryEntryDto {
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
