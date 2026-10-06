import { PartialType } from '@nestjs/mapped-types';
import { CreateIndicatorQuarterlyDto } from './create-indicator.dto';

/**
 * PATCH body for quarterly indicator data.
 *
 * The route previously typed its body as `Partial<CreateIndicatorQuarterlyDto>`. A mapped
 * type erases to `Object` at runtime, so Nest's ValidationPipe skipped the body entirely:
 * nothing was whitelisted, nothing was range-checked, and every key sent by the client was
 * interpolated straight into the dynamic `SET` clause of the UPDATE. A real class restores
 * both the bounds checks and `forbidNonWhitelisted`, so only known columns can be written.
 */
export class UpdateIndicatorQuarterlyDto extends PartialType(
  CreateIndicatorQuarterlyDto,
) {}
