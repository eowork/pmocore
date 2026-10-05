import 'dotenv/config';
import { Options, ReflectMetadataProvider } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

// Production (Docker/compiled JS): ReflectMetadataProvider reads decorator metadata baked
// in by the TypeScript compiler (emitDecoratorMetadata: true) — no ts-morph, no TS sources needed.
// Development: TsMorphMetadataProvider reads .ts sources directly, so explicit @Property types
// are optional.
const isProduction = process.env.NODE_ENV === 'production';

const config: Options<PostgreSqlDriver> = {
  driver: PostgreSqlDriver,
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5432,
  dbName: process.env.DATABASE_NAME || 'pmo_dashboard',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  // Entities live in multiple locations (database/entities, activity-logs/, contractor-auth/entities/),
  // so the glob spans the whole tree — NestJS autoLoadEntities sees all 56 via forFeature, but the
  // standalone migrate.js relies on this glob alone. A narrower path would make createSchema() skip
  // activity_logs and the contractor tables on a fresh deploy.
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  metadataProvider: isProduction
    ? ReflectMetadataProvider
    : TsMorphMetadataProvider,
  migrations: {
    tableName: 'mikro_orm_migrations',
    // Runtime image ships only ./dist; migrations are compiled to dist/database/mikro-migrations.
    // pathTs keeps dev (ts-node) reading the source .ts migrations.
    path: './dist/database/mikro-migrations',
    pathTs: './src/database/mikro-migrations',
    glob: '!(*.d).{js,ts}',
    // Never generate destructive statements. The immediate reason is the module_type enum:
    // no entity column maps to it (user_module_assignments.module is plain text), so the
    // differ wants to DROP TYPE it — but it is the parameter type of the SQL function
    // user_has_module_access(uuid, module_type), which permission-resolver.service.ts calls
    // on every module access check. Postgres would refuse the drop because of that
    // dependency, so the statement served only to make every generated migration fail.
    //
    // The general reason is the same one that keeps this schema free of foreign keys: this
    // database predates the entity definitions and holds objects the ORM does not model.
    // A drop this tool infers is far more likely to be a gap in the mapping than a real
    // intention, so drops are written by hand, in their own migration, deliberately.
    safe: true,
  },
  filters: {
    notDeleted: { cond: { deletedAt: null }, default: false },
  },
  pool: { min: 2, max: 10 },
  debug: process.env.NODE_ENV === 'development',
};

export default config;
