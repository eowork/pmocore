import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // KY-A1: Serve uploaded files as static assets at /uploads prefix.
  // SECURITY (T2): /uploads is unauthenticated, so restrict it to IMAGE types only
  // (gallery images render in <img> and public project pages show galleries by design).
  // Documents (PDF/DOCX/etc.) must NOT be reachable here — they are served exclusively
  // through the guarded streaming endpoint (.../documents/:docId/download, JWT + guards).
  // This closes the hole where any document was downloadable by direct /uploads URL.
  const configService = app.get(ConfigService);
  const uploadDir = configService.get<string>('UPLOAD_DIR', './uploads');
  const absoluteUploadDir = join(process.cwd(), uploadDir);
  const UPLOADS_IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    if (!UPLOADS_IMAGE_EXT.test(req.path)) {
      return res
        .status(403)
        .json({ statusCode: 403, message: 'Forbidden: documents are served via the authenticated download endpoint.' });
    }
    next();
  });
  app.useStaticAssets(absoluteUploadDir, { prefix: '/uploads' });

  // LLL-E3: Serve seeded document templates (public, no auth) at /templates prefix.
  // Files live in pmo-backend/public/templates/{type_code}.docx — see
  // Migration20260601010000_SeedDocumentTypeTemplateUrls which seeds template_url.
  app.useStaticAssets(join(process.cwd(), 'public', 'templates'), {
    prefix: '/templates',
  });

  // Restrict CORS to the known frontend origin. FRONTEND_URL defaults to localhost:3001
  // so dev behavior is unchanged. Set FRONTEND_URL in .env for production deployments.
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3001'),
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor for request/response logging
  app.useGlobalInterceptors(new LoggingInterceptor());

  // API prefix
  app.setGlobalPrefix('api', {
    exclude: ['health'], // Health check at root
  });

  // Swagger/OpenAPI — available in development only.
  // Production Docker sets NODE_ENV=production (forced in docker-compose.yml),
  // so /api/docs returns 404 in deployed environments.
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PMO Dashboard API')
      .setDescription(
        'Project Management Office REST API for managing construction projects, repairs, university operations, and administrative functions.',
      )
      .setVersion('2.8.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        'JWT-auth',
      )
      .addTag('Health', 'Health check endpoints')
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Users', 'User management (Admin only)')
      .addTag('Projects', 'Base project management')
      .addTag('Construction Projects', 'Construction project management')
      .addTag('Repair Projects', 'Repair project management')
      .addTag('University Operations', 'University operations management')
      .addTag('GAD Parity', 'Gender and Development parity data')
      .addTag('Reference: Contractors', 'Contractor reference data')
      .addTag('Reference: Funding Sources', 'Funding source reference data')
      .addTag('Reference: Departments', 'Department reference data')
      .addTag('Reference: Repair Types', 'Repair type reference data')
      .addTag(
        'Reference: Subcategories',
        'Construction subcategory reference data',
      )
      .addTag('System Settings', 'System configuration settings')
      .addTag('File Uploads', 'File upload management')
      .addTag('Documents', 'Document attachment management')
      .addTag('Media', 'Media attachment management')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`PMO Backend running on http://localhost:${port}`);
  logger.log(`Health check: http://localhost:${port}/health`);
  logger.log(`API base: http://localhost:${port}/api`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
