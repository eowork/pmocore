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
  metadataProvider: isProduction ? ReflectMetadataProvider : TsMorphMetadataProvider,
  migrations: {
    tableName: 'mikro_orm_migrations',
    // Runtime image ships only ./dist; migrations are compiled to dist/database/mikro-migrations.
    // pathTs keeps dev (ts-node) reading the source .ts migrations.
    path: './dist/database/mikro-migrations',
    pathTs: './src/database/mikro-migrations',
    glob: '!(*.d).{js,ts}',
  },
  filters: {
    notDeleted: { cond: { deletedAt: null }, default: false },
  },
  pool: { min: 2, max: 10 },
  debug: process.env.NODE_ENV === 'development',
};

export default config;
