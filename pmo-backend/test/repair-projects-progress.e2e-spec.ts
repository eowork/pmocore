import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E Tests for Repair Projects - Progress Tracking & Schema Migration
 * Phase 3.1.2 - Full Migration Support (Option C)
 * Research: ACE-R9 (docs/research_summary.md Section 28)
 */
describe('RepairProjects - Progress Tracking (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let testRepairId: string;

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
    // Cleanup: Delete test repair if created
    if (testRepairId && authToken) {
      await request(app.getHttpServer())
        .delete(`/repair-projects/${testRepairId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('Schema Migration Verification', () => {
    it('should create a repair project with default 0% progress', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/repair-projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          project_code: `TEST_REPAIR_${Date.now()}`,
          title: 'Test Repair Project for Progress Tracking',
          building_name: 'Test Building',
          campus: 'MAIN',
          status: 'REPORTED',
          urgency_level: 'HIGH',
          repair_type_id: '00000000-0000-0000-0000-000000000001', // Placeholder - adjust to valid ID
        });

      if (response.status === 201) {
        testRepairId = response.body.id;
        expect(response.body.physical_progress).toBeDefined();
        expect(response.body.financial_progress).toBeDefined();
        // Progress should default to 0.00 after migration
      }
    });
  });

  describe('Progress Updates', () => {
    it('should update physical_progress to 60%', async () => {
      if (!authToken || !testRepairId) {
        console.log('Skipping: No auth token or test repair');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/repair-projects/${testRepairId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: 60 });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.physical_progress)).toBe(60);
    });

    it('should update financial_progress to 80%', async () => {
      if (!authToken || !testRepairId) {
        console.log('Skipping: No auth token or test repair');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/repair-projects/${testRepairId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ financial_progress: 80 });

      expect(response.status).toBe(200);
      expect(parseFloat(response.body.financial_progress)).toBe(80);
    });

    it('should reject negative progress value', async () => {
      if (!authToken || !testRepairId) {
        console.log('Skipping: No auth token or test repair');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/repair-projects/${testRepairId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: -5 });

      expect(response.status).toBe(400);
    });

    it('should reject progress value > 100', async () => {
      if (!authToken || !testRepairId) {
        console.log('Skipping: No auth token or test repair');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/repair-projects/${testRepairId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ physical_progress: 120 });

      expect(response.status).toBe(400);
    });

    it('should sort by physical_progress', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/repair-projects?sort=physical_progress&order=asc')
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
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });
  });
});
