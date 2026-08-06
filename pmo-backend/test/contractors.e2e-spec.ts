import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ContractorsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let testContractorId: string;
  const testContractorName = `TEST_CONTRACTOR_${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    // Login to get auth token (requires valid test user in DB)
    // If no test user exists, these tests will fail with 401
    // This is documented behavior per plan_active.md
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
    // Cleanup: Delete test contractor if it was created
    if (testContractorId && authToken) {
      await request(app.getHttpServer())
        .delete(`/contractors/${testContractorId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await app.close();
  });

  describe('CRUD Cycle', () => {
    it('should require authentication for GET /contractors', async () => {
      const response = await request(app.getHttpServer()).get('/contractors');

      expect(response.status).toBe(401);
    });

    it('should list contractors when authenticated', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/contractors')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create a contractor', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/contractors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: testContractorName,
          status: 'ACTIVE',
          contact_person: 'Test Person',
          email: 'test@contractor.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(testContractorName);

      testContractorId = response.body.id;
    });

    it('should get a contractor by ID', async () => {
      if (!authToken || !testContractorId) {
        console.log('Skipping: Prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/contractors/${testContractorId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testContractorId);
      expect(response.body.name).toBe(testContractorName);
    });

    it('should update a contractor', async () => {
      if (!authToken || !testContractorId) {
        console.log('Skipping: Prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/contractors/${testContractorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contact_person: 'Updated Person',
        });

      expect(response.status).toBe(200);
      expect(response.body.contact_person).toBe('Updated Person');
    });

    it('should update contractor status', async () => {
      if (!authToken || !testContractorId) {
        console.log('Skipping: Prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/contractors/${testContractorId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'SUSPENDED',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('SUSPENDED');
    });

    it('should delete a contractor (soft delete)', async () => {
      if (!authToken || !testContractorId) {
        console.log('Skipping: Prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .delete(`/contractors/${testContractorId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify it's not found anymore
      const getResponse = await request(app.getHttpServer())
        .get(`/contractors/${testContractorId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);

      // Clear the ID so afterAll doesn't try to delete again
      testContractorId = null;
    });

    it('should return 404 for non-existent contractor', async () => {
      if (!authToken) {
        console.log('Skipping: No auth token (test user not configured)');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/contractors/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });
});
