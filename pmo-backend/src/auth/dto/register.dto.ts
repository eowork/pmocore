import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Juan Dela Cruz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  full_name!: string;

  @ApiProperty({ example: 'juan@csu.edu.ph' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  confirm_password!: string;

  @ApiProperty({ required: false, example: 'Office of the Campus Director' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  department?: string;

  @ApiProperty({ required: false, example: 'Administrative Officer' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  position?: string;

  @ApiProperty({ required: false, example: '+63 912 345 6789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({
    required: false,
    example: 'CSU_PERSONNEL',
    description:
      'CSU_PERSONNEL | CONTRACTOR | SUPPLIER | CONSULTANT | EXTERNAL_STAKEHOLDER | OTHERS',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  user_type?: string;

  @ApiProperty({
    required: false,
    description: 'Required when user_type is OTHERS',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  user_type_other?: string;
}
