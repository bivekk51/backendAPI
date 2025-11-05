const request = require('supertest');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup/testDb');
const createTestApp = require('../setup/testApp');

const app = createTestApp();

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('User API Integration Tests', () => {
  describe('POST /api/v1/users/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.email).toBe('john@example.com');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({
          name: 'John Doe',
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      await request(app).post('/api/v1/users/register').send(userData);

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/users/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/users/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
