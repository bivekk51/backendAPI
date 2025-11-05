const request = require('supertest');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup/testDb');
const { createTestUser, createTestEvent } = require('../setup/testHelpers');
const createTestApp = require('../setup/testApp');

const app = createTestApp();
const Event = require('../../src/models/Event');

beforeAll(async () => {
  await connectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('Booking API Integration Tests', () => {
  let userToken, user, event, eventId;

  beforeEach(async () => {
    const testUser = await createTestUser('user');
    user = testUser.user;
    userToken = testUser.token;
    event = await createTestEvent(Event, user._id);
    eventId = event._id.toString();
  });

  describe('POST /api/v1/bookings', () => {
    it('should create booking successfully', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: eventId,
          quantity: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(5);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data).toHaveProperty('holdExpiry');

      const updatedEvent = await Event.findById(eventId);
      expect(updatedEvent.availableTickets).toBe(95);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .send({
          eventId: eventId,
          quantity: 5,
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: eventId,
          quantity: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for quantity exceeding limit', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: eventId,
          quantity: 150,
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for insufficient tickets', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: eventId,
          quantity: 101,
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('tickets available');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: '507f1f77bcf86cd799439011',
          quantity: 5,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/bookings/:id/confirm', () => {
    let bookingId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: eventId,
          quantity: 3,
        });
      bookingId = response.body.data._id;
    });

    it('should confirm booking successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('confirmed');
      expect(response.body.data.holdExpiry).toBeUndefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/confirm`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for different user', async () => {
      const anotherUser = await createTestUser('user');

      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${anotherUser.token}`);

      expect(response.status).toBe(403);
    });

    it('should return 409 for already confirmed booking', async () => {
      await request(app)
        .post(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`);

      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(409);
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .post('/api/v1/bookings/507f1f77bcf86cd799439011/confirm')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/bookings/:id/cancel', () => {
    let bookingId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventId: eventId,
          quantity: 4,
        });
      bookingId = response.body.data._id;
    });

    it('should cancel booking and restore tickets', async () => {
      const beforeEvent = await Event.findById(eventId);
      const beforeTickets = beforeEvent.availableTickets;

      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');

      const afterEvent = await Event.findById(eventId);
      expect(afterEvent.availableTickets).toBe(beforeTickets + 4);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for different user', async () => {
      const anotherUser = await createTestUser('user');

      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${anotherUser.token}`);

      expect(response.status).toBe(403);
    });

    it('should return 409 for already cancelled booking', async () => {
      await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      const response = await request(app)
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/v1/bookings', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId: eventId, quantity: 2 });

      await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId: eventId, quantity: 3 });
    });

    it('should get all user bookings', async () => {
      const response = await request(app)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/bookings');

      expect(response.status).toBe(401);
    });

    it('should return empty array for user with no bookings', async () => {
      const anotherUser = await createTestUser('user');

      const response = await request(app)
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${anotherUser.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/bookings/:id', () => {
    let bookingId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventId: eventId, quantity: 2 });
      bookingId = response.body.data._id;
    });

    it('should get booking by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(bookingId);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get(`/api/v1/bookings/${bookingId}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for different user', async () => {
      const anotherUser = await createTestUser('user');

      const response = await request(app)
        .get(`/api/v1/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${anotherUser.token}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/v1/bookings/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });
});
