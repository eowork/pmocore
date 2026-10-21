import { Transform } from 'class-transformer';

/**
 * Parse a boolean that arrived as a query-string parameter.
 *
 * A query string has no types: `?flag=false` reaches the pipe as the non-empty string
 * `"false"`. Both `@Type(() => Boolean)` and the global pipe's `enableImplicitConversion`
 * turn that into `true`, so a filter written the obvious way can never be set to false.
 *
 * The raw value is read off `obj` rather than taken from `value`, because by the time a
 * transform runs the implicit conversion has already happened and the original string is
 * gone — `({ value }) => value === 'true'` is reading a boolean, not the text that was sent.
 *
 * Anything that is not one of the four recognised forms is passed through untouched so that
 * `@IsBoolean()` rejects it, rather than being quietly coerced to a filter nobody asked for.
 */
export function BooleanQuery(): PropertyDecorator {
  return Transform(({ obj, key }) => {
    const raw: unknown = (obj as Record<string, unknown>)[key];
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return raw;
  });
}
