const request = require('supertest');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup/testDb');
const { createTestUser } = require('../setup/testHelpers');
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

describe('Event API Integration Tests', () => {
  let adminToken, userToken, eventId;

  beforeEach(async () => {
    const admin = await createTestUser('admin');
    const user = await createTestUser('user');
    adminToken = admin.token;
    userToken = user.token;
  });

  describe('POST /api/v1/events', () => {
    it('should create event with admin token', async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Concert',
          description: 'A great concert event',
          date: new Date(Date.now() + 86400000).toISOString(),
          location: 'Test Arena',
          totalTickets: 100,
          price: 50,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Concert');
      expect(response.body.data.availableTickets).toBe(100);
      eventId = response.body.data._id;
    });

    it('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Concert',
          description: 'A great concert',
          date: new Date().toISOString(),
          location: 'Test Arena',
          totalTickets: 100,
          price: 50,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .send({
          name: 'Test Concert',
          description: 'A great concert',
          date: new Date().toISOString(),
          location: 'Test Arena',
          totalTickets: 100,
          price: 50,
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Te',
          description: 'Short',
          totalTickets: -5,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/events', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Event 1',
          description: 'Description 1',
          date: new Date('2024-12-31').toISOString(),
          location: 'New York',
          totalTickets: 100,
          price: 50,
        });

      await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Event 2',
          description: 'Description 2',
          date: new Date('2025-01-15').toISOString(),
          location: 'Los Angeles',
          totalTickets: 200,
          price: 75,
        });
    });

    it('should get all events without authentication', async () => {
      const response = await request(app).get('/api/v1/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter events by location', async () => {
      const response = await request(app).get('/api/v1/events?location=New York');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].location).toBe('New York');
    });
  });

  describe('GET /api/v1/events/:id', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Event',
          description: 'Description',
          date: new Date().toISOString(),
          location: 'Test Location',
          totalTickets: 100,
          price: 50,
        });
      eventId = response.body.data._id;
    });

    it('should get event by ID', async () => {
      const response = await request(app).get(`/api/v1/events/${eventId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Event');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app).get('/api/v1/events/507f1f77bcf86cd799439011');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid ID', async () => {
      const response = await request(app).get('/api/v1/events/invalid-id');

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/events/:id', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Original Event',
          description: 'Original Description',
          date: new Date().toISOString(),
          location: 'Original Location',
          totalTickets: 100,
          price: 50,
        });
      eventId = response.body.data._id;
    });

    it('should update event with admin token', async () => {
      const response = await request(app)
        .put(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Event',
          price: 75,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Event');
      expect(response.body.data.price).toBe(75);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .put(`/api/v1/events/${eventId}`)
        .send({ name: 'Hacked' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/events/:id', () => {
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Event to Delete',
          description: 'Description',
          date: new Date().toISOString(),
          location: 'Location',
          totalTickets: 100,
          price: 50,
        });
      eventId = response.body.data._id;
    });

    it('should delete event with admin token', async () => {
      const response = await request(app)
        .delete(`/api/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const getResponse = await request(app).get(`/api/v1/events/${eventId}`);
      expect(getResponse.status).toBe(404);
    });
  });
});
