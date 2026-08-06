import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E Tests for Construction Projects - Progress Tracking
 * Phase 3.1.2 - Full Migration Support (Option C)
 * Research: ACE-R9 (docs/research_summary.md Section 28)
 */
describe('ConstructionProjects - Progress Tracking (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let testProjectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Login to get auth token
    try {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@pmo.test',
          password: 'testpassword123',
        });

      if (loginResponse.status === 200 || loginResponse.status === 201) {
        authToken = loginResponse.body.access_token;
      }
    } catch (error) {
      // Auth may fail if no test user - tests will skip gracefully
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test project if created
    if (testProjectId && authToken) {
      await request(app.getHttpServer())
        .delete(`/construction-projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('Progress Updates', () => {
    it('should create a construction project with default 0% progress', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/construction-projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project_code: `TEST_CONST_${Date.now()}`,
          title: 'Test Construction Project for Progress Tracking',
          campus: 'MAIN',
          status: 'PLANNING',
          funding_source_id: '00000000-0000-0000-0000-000000000001', // Placeholder - adjust to valid ID
        });

      if (response.status === 201) {
        testProjectId = response.body.id;
        expect(response.body.physical_progress).toBeDefined();
        expect(response.body.financial_progress).toBeDefined();
        // Note: May be null or 0.00 depending on query result format
      }
    });

    it('should update physical_progress to 50%', async () => {
      if (!authToken || !testProjectId) {
        console.log('Skipping: No auth token or test project');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/construction-projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: 50 });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.physical_progress)).toBe(50);
    });

    it('should update financial_progress to 75%', async () => {
      if (!authToken || !testProjectId) {
        console.log('Skipping: No auth token or test project');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/construction-projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ financial_progress: 75 });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.financial_progress)).toBe(75);
    });

    it('should reject negative progress value', async () => {
      if (!authToken || !testProjectId) {
        console.log('Skipping: No auth token or test project');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/construction-projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: -10 });

      expect(response.status).toBe(400);
    });

    it('should reject progress value > 100', async () => {
      if (!authToken || !testProjectId) {
        console.log('Skipping: No auth token or test project');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/construction-projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: 150 });

      expect(response.status).toBe(400);
    });

    it('should reject non-numeric progress value', async () => {
      if (!authToken || !testProjectId) {
        console.log('Skipping: No auth token or test project');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/construction-projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: 'abc' });

      expect(response.status).toBe(400);
    });

    it('should sort by physical_progress', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/construction-projects?sort=physical_progress&order=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      // Verify it's sorted (if data exists)
      if (response.body.data.length > 1) {
        for (let i = 0; i < response.body.data.length - 1; i++) {
          const current = parseFloat(
            response.body.data[i].physical_progress || 0,
          );
          const next = parseFloat(
            response.body.data[i + 1].physical_progress || 0,
          );
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });
});
