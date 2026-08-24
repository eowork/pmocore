import { PartialType } from '@nestjs/mapped-types';
import { CreateRevisionOrderDto } from './create-revision-order.dto';

export class UpdateRevisionOrderDto extends PartialType(
  CreateRevisionOrderDto,
) {}
