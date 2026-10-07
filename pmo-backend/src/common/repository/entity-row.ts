import type { EntityManager, EntityProperty } from '@mikro-orm/core';

/**
 * These endpoints have always answered with the database row as Postgres stores it: snake_case
 * keys, every column. The ORM hands back a hydrated entity with camelCase properties instead,
 * so the two helpers here convert between the two shapes.
 *
 * Both are driven by the ORM's own metadata rather than a hand-written column list. The tables
 * involved are wide — operation_indicators alone has 73 columns — and a hand-written map would
 * silently drop a column the day one is added to the entity.
 */

/** Scalar, persisted properties of an entity — the ones that are actual table columns. */
function columnProperties(
  em: EntityManager,
  entityName: string,
): EntityProperty[] {
  const meta = em.getMetadata().find(entityName);
  if (!meta) {
    throw new Error(`No metadata registered for entity ${entityName}`);
  }
  return Object.values(meta.properties).filter(
    (prop) =>
      prop.kind === 'scalar' &&
      prop.persist !== false &&
      !!prop.fieldNames?.[0],
  );
}

/**
 * The number of decimal places a numeric column is declared with, or null when the column is
 * not numeric. Postgres pads a numeric to its scale on the wire — numeric(12,4) comes back as
 * "10.0000", not "10" — and the ORM parses that into a plain number, so the padding has to be
 * put back for the response to look the way it always has.
 */
function numericScale(prop: EntityProperty): number | null {
  const columnType = prop.columnTypes?.[0] ?? '';
  const match = /^(?:numeric|decimal)\s*\(\s*\d+\s*,\s*(\d+)\s*\)/i.exec(
    columnType,
  );
  return match ? Number(match[1]) : null;
}

function isDateColumn(prop: EntityProperty): boolean {
  return (prop.columnTypes?.[0] ?? '').toLowerCase() === 'date';
}

/**
 * Serialise a hydrated entity into the snake_case column row `SELECT *` used to return.
 *
 * Timestamps stay as Date objects: the driver returned them as strings on the raw path, but
 * both serialise to a valid instant and every consumer parses rather than pattern-matches them.
 */
export function toRow<T extends object>(
  em: EntityManager,
  entityName: string,
  entity: T,
): Record<string, any> {
  const row: Record<string, any> = {};
  for (const prop of columnProperties(em, entityName)) {
    const value = (entity as Record<string, any>)[prop.name];
    row[prop.fieldNames[0]] = renderColumn(prop, value);
  }
  return row;
}

function renderColumn(prop: EntityProperty, value: unknown): any {
  if (value === undefined || value === null) return null;

  const scale = numericScale(prop);
  if (scale !== null) {
    return typeof value === 'number' ? value.toFixed(scale) : String(value);
  }

  if (isDateColumn(prop)) {
    // A DATE is a calendar day, not an instant. Rendering it as a full UTC timestamp would
    // shift the day for anyone east or west of UTC.
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  }

  return value;
}

/**
 * Columns that no request body may ever write, whatever the DTO happens to carry: identity,
 * ownership and the soft-delete markers. Everything else is writable only if it is a real
 * column on the entity, which is what stops an unexpected key from reaching the UPDATE.
 */
const NEVER_WRITABLE = new Set([
  'id',
  'operation_id',
  'created_by',
  'created_at',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
]);

export interface AssignColumnsResult {
  /** The snake_case column names that were actually written. */
  applied: string[];
  /** Keys present in the payload that are not writable columns, so were ignored. */
  ignored: string[];
}

/**
 * Copy a snake_case payload onto a hydrated entity, column by column.
 *
 * This replaces the `fields.map(f => \`${f} = ?\`)` SET clauses the service used to build: a key
 * that is not a column of this entity has nowhere to go and is reported as ignored instead of
 * being interpolated into SQL.
 */
export function assignColumns<T extends object>(
  em: EntityManager,
  entityName: string,
  entity: T,
  payload: Record<string, any>,
  skip: readonly string[] = [],
): AssignColumnsResult {
  const byColumn = new Map(
    columnProperties(em, entityName).map((prop) => [prop.fieldNames[0], prop]),
  );
  const skipped = new Set([...NEVER_WRITABLE, ...skip]);

  const applied: string[] = [];
  const ignored: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (skipped.has(key) || !byColumn.has(key)) {
      ignored.push(key);
      continue;
    }
    const prop = byColumn.get(key)!;
    (entity as Record<string, any>)[prop.name] = coerceColumn(prop, value);
    applied.push(key);
  }
  return { applied, ignored };
}

function coerceColumn(prop: EntityProperty, value: unknown): any {
  if (value === null) return null;
  if (isDateColumn(prop) || prop.runtimeType === 'Date') {
    return value instanceof Date ? value : new Date(String(value));
  }
  return value;
}
