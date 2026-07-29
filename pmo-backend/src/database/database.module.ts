import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';
import { DATABASE_POOL } from './database.constants';
import { numberFromConfig } from '../common/config.util';

const databasePoolFactory = {
  provide: DATABASE_POOL,
  useFactory: async (configService: ConfigService) => {
    const logger = new Logger('DatabasePool');

    const pool = new Pool({
      host: configService.get<string>('DATABASE_HOST', 'localhost'),
      port: numberFromConfig(configService, 'DATABASE_PORT', 5432),
      database: configService.get<string>('DATABASE_NAME', 'pmo_dashboard'),
      user: configService.get<string>('DATABASE_USER', 'postgres'),
      password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
      max: 10, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection on startup
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as server_time');
      client.release();
      logger.log('Database connected successfully');
      logger.log(`Server time: ${result.rows[0].server_time}`);
    } catch (error) {
      logger.error('Database connection failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }

    return pool;
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [databasePoolFactory, DatabaseService],
  exports: [DATABASE_POOL, DatabaseService],
})
export class DatabaseModule {}

// DATABASE_POOL is exported from database.constants
