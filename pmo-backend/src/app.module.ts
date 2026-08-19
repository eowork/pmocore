import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import type { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { numberFromConfig } from './common/config.util';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UniversityOperationsModule } from './university-operations/university-operations.module';
import { ProjectsModule } from './projects/projects.module';
import { ConstructionProjectsModule } from './construction-projects/construction-projects.module';
import { RepairProjectsModule } from './repair-projects/repair-projects.module';
import { GadModule } from './gad/gad.module';
import { UsersModule } from './users/users.module';
import { UploadsModule } from './uploads/uploads.module';
import { DocumentsModule } from './documents/documents.module';
import { MediaModule } from './media/media.module';
import { ContractorsModule } from './contractors/contractors.module';
import { FundingSourcesModule } from './funding-sources/funding-sources.module';
import { DepartmentsModule } from './departments/departments.module';
import { RepairTypesModule } from './repair-types/repair-types.module';
import { ConstructionSubcategoriesModule } from './construction-subcategories/construction-subcategories.module';
import { SettingsModule } from './settings/settings.module';
import { CommonModule } from './common/common.module';
import { ActivityLogModule } from './activity-logs/activity-log.module';
import { ContractorAuthModule } from './contractor-auth/contractor-auth.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { HomepageModule } from './homepage/homepage.module';
import { JwtAuthGuard } from './auth/guards';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 15 }, // Phase FW-1: raised from 3 — dashboard fires up to 11 parallel calls
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    // MikroORM (Phase HY — phased migration alongside DatabaseService)
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MikroOrmModuleOptions => ({
        driver: PostgreSqlDriver,
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: numberFromConfig(configService, 'DATABASE_PORT', 5432),
        dbName: configService.get('DATABASE_NAME', 'pmo_dashboard'),
        user: configService.get('DATABASE_USER', 'postgres'),
        password: configService.get('DATABASE_PASSWORD', 'postgres'),
        autoLoadEntities: true,
        migrations: {
          tableName: 'mikro_orm_migrations',
          path: './dist/database/mikro-migrations',
        },
        filters: {
          notDeleted: { cond: { deletedAt: null }, default: false },
        },
        pool: { min: 2, max: 10 },
        debug: configService.get('NODE_ENV') === 'development',
      }),
    }),
    // Raw SQL pool (DatabaseService) — retained for all non-migrated services
    DatabaseModule,
    // Common services (shared across modules)
    CommonModule,
    // Authentication
    AuthModule,
    // Health check endpoint
    HealthModule,
    // Domain modules
    UniversityOperationsModule,
    ProjectsModule,
    ConstructionProjectsModule,
    RepairProjectsModule,
    GadModule,
    // User administration
    UsersModule,
    // File uploads
    UploadsModule,
    // Document attachments
    DocumentsModule,
    // Media attachments
    MediaModule,
    // Reference data
    ContractorsModule,
    FundingSourcesModule,
    DepartmentsModule,
    RepairTypesModule,
    ConstructionSubcategoriesModule,
    // System settings
    SettingsModule,
    // Activity logging (Phase JT-D)
    ActivityLogModule,
    // Contractor auth + invite system (Phase PB)
    ContractorAuthModule,
    // Self-service access requests (Phase BBBA)
    AccessRequestsModule,
    // CMS-backed public homepage content (T-HOME-CMS)
    HomepageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT guard (all routes protected by default)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
