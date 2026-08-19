import { ConfigService } from '@nestjs/config';

/**
 * T-JWT-EXPIRY: read a numeric config value safely.
 *
 * Environment variables are ALWAYS strings, and `ConfigService.get<number>()` does NOT coerce —
 * the `<number>` is a compile-time cast only. Passing the resulting string to consumers that treat
 * strings differently from numbers causes subtle bugs (e.g. `jsonwebtoken` interprets the string
 * "28800" as 28800 milliseconds via the `ms` library, so an intended 8h token expires in ~29s).
 *
 * This helper returns a real, positive number, falling back when the value is missing, empty,
 * non-numeric, or non-positive.
 */
export function numberFromConfig(
  cs: ConfigService,
  key: string,
  fallback: number,
): number {
  const n = Number(cs.get(key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
