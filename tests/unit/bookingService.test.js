const mockingoose = require('mockingoose');
const mongoose = require('mongoose');
const { createTestUser, createTestEvent, createTestBooking } = require('../setup/testHelpers');
const {
  createBooking,
  confirmBooking,
  cancelBooking,
  getUserBookings,
  getBookingById,
} = require('../../src/services/bookingService');
const Event = require('../../src/models/Event');
const Ticket = require('../../src/models/Ticket');
const { NotFoundError, AuthorizationError, ConflictError, ValidationError } = require('../../src/utils/errors');

mongoose.startSession = jest.fn().mockResolvedValue({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
});

beforeEach(() => {
  mockingoose.resetAll();
  jest.clearAllMocks();
});

afterEach(() => {
  mockingoose.resetAll();
});

describe.skip('Booking Service - Requires real DB for transactions', () => {
  let user, event;

  beforeEach(async () => {
    const testUser = await createTestUser('user');
    user = testUser.user;
    event = await createTestEvent({ createdBy: user._id });
  });

  describe('createBooking', () => {
    it('should create booking successfully with transaction', async () => {
      const booking = await createBooking(event._id, user._id, 5);

      expect(booking.quantity).toBe(5);
      expect(booking.status).toBe('pending');
      expect(booking).toHaveProperty('holdExpiry');
      expect(booking.totalPrice).toBe(event.price * 5);

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.availableTickets).toBe(95);
    });

    it('should throw ConflictError when not enough tickets', async () => {
      await expect(createBooking(event._id, user._id, 101)).rejects.toThrow(ConflictError);
      await expect(createBooking(event._id, user._id, 101)).rejects.toThrow('tickets available');
    });

    it('should throw NotFoundError for non-existent event', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await expect(createBooking(fakeId, user._id, 1)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid quantity', async () => {
      await expect(createBooking(event._id, user._id, 0)).rejects.toThrow(ValidationError);
      await expect(createBooking(event._id, user._id, -5)).rejects.toThrow(ValidationError);
    });

    it('should rollback on failure', async () => {
      const originalTickets = event.availableTickets;

      try {
        await createBooking(event._id, user._id, 101);
      } catch (error) {
        const updatedEvent = await Event.findById(event._id);
        expect(updatedEvent.availableTickets).toBe(originalTickets);
      }
    });
  });

  describe('confirmBooking', () => {
    let booking;

    beforeEach(async () => {
      booking = await createBooking(event._id, user._id, 2);
    });

    it('should confirm pending booking successfully', async () => {
      const confirmed = await confirmBooking(booking._id, user._id);

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.holdExpiry).toBeUndefined();
    });

    it('should throw AuthorizationError for different user', async () => {
      const anotherUser = await createTestUser('user');

      await expect(confirmBooking(booking._id, anotherUser.user._id)).rejects.toThrow(AuthorizationError);
    });

    it('should throw ConflictError for non-pending booking', async () => {
      await confirmBooking(booking._id, user._id);

      await expect(confirmBooking(booking._id, user._id)).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError for expired hold', async () => {
      const expired = await createTestBooking({
        event: event._id,
        user: user._id,
        quantity: 1,
        totalPrice: 50,
        status: 'pending',
        holdExpiry: new Date(Date.now() - 1000),
      });

      await expect(confirmBooking(expired._id, user._id)).rejects.toThrow(ConflictError);
      await expect(confirmBooking(expired._id, user._id)).rejects.toThrow('expired');
    });

    it('should throw NotFoundError for non-existent booking', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await expect(confirmBooking(fakeId, user._id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('cancelBooking', () => {
    let booking;

    beforeEach(async () => {
      booking = await createBooking(event._id, user._id, 3);
    });

    it('should cancel booking and restore tickets', async () => {
      const initialTickets = await Event.findById(event._id).then(e => e.availableTickets);

      const cancelled = await cancelBooking(booking._id, user._id);

      expect(cancelled.status).toBe('cancelled');

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.availableTickets).toBe(initialTickets + 3);
    });

    it('should throw AuthorizationError for different user', async () => {
      const anotherUser = await createTestUser('user');

      await expect(cancelBooking(booking._id, anotherUser.user._id)).rejects.toThrow(AuthorizationError);
    });

    it('should throw ConflictError for already cancelled booking', async () => {
      await cancelBooking(booking._id, user._id);

      await expect(cancelBooking(booking._id, user._id)).rejects.toThrow(ConflictError);
      await expect(cancelBooking(booking._id, user._id)).rejects.toThrow('already cancelled');
    });

    it('should throw NotFoundError for non-existent booking', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await expect(cancelBooking(fakeId, user._id)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserBookings', () => {
    beforeEach(async () => {
      await createBooking(event._id, user._id, 2);
      await createBooking(event._id, user._id, 3);
    });

    it('should get all bookings for user', async () => {
      const bookings = await getUserBookings(user._id);

      expect(bookings).toHaveLength(2);
      expect(bookings[0].user.toString()).toBe(user._id.toString());
    });

    it('should return empty array for user with no bookings', async () => {
      const anotherUser = await createTestUser('user');
      const bookings = await getUserBookings(anotherUser.user._id);

      expect(bookings).toHaveLength(0);
    });

    it('should throw ValidationError when userId is missing', async () => {
      await expect(getUserBookings(null)).rejects.toThrow(ValidationError);
    });
  });

  describe('getBookingById', () => {
    let booking;

    beforeEach(async () => {
      booking = await createBooking(event._id, user._id, 2);
    });

    it('should get booking by ID for owner', async () => {
      const retrieved = await getBookingById(booking._id, user._id);

      expect(retrieved._id.toString()).toBe(booking._id.toString());
      expect(retrieved.quantity).toBe(2);
    });

    it('should throw AuthorizationError for different user', async () => {
      const anotherUser = await createTestUser('user');

      await expect(getBookingById(booking._id, anotherUser.user._id)).rejects.toThrow(AuthorizationError);
    });

    it('should throw NotFoundError for non-existent booking', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await expect(getBookingById(fakeId, user._id)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for invalid ID format', async () => {
      await expect(getBookingById('invalid-id', user._id)).rejects.toThrow(ValidationError);
    });
  });
});
