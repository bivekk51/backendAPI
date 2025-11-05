const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const mockingoose = require('mockingoose');
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const EventModel = require('../../src/models/Event');
const TicketModel = require('../../src/models/Ticket');

const createObjectId = () => new mongoose.Types.ObjectId();

const createTestUser = async (role = 'user') => {
  const userData = {
    name: role === 'admin' ? 'Admin User' : 'Test User',
    email: role === 'admin' ? `admin${Date.now()}@test.com` : `user${Date.now()}@test.com`,
    password: 'password123',
    role,
  };

  const createdUser = await User.create(userData);
  const user = {
    _id: createdUser._id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
  };

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret-key-for-jwt-token-generation', { expiresIn: '30d' });

  return { user, token };
};

const createTestEvent = async (overrides = {}) => {
  const eventData = {
    name: 'Test Concert',
    description: 'A test concert event',
    date: new Date(Date.now() + 86400000),
    location: 'Test Venue',
    totalTickets: 100,
    price: 50,
    createdBy: overrides.createdBy || createObjectId(),
    ...overrides,
  };

  const event = await EventModel.create(eventData);
  return event;
};

const createTestBooking = async (overrides = {}) => {
  const bookingData = {
    event: overrides.event || createObjectId(),
    user: overrides.user || createObjectId(),
    quantity: overrides.quantity || 2,
    totalPrice: overrides.totalPrice || 100,
    status: overrides.status || 'pending',
    holdExpiry: overrides.holdExpiry || new Date(Date.now() + 600000),
    ...overrides,
  };

  const booking = await TicketModel.create(bookingData);
  return booking;
};

module.exports = {
  createTestUser,
  createTestEvent,
  createTestBooking,
  createObjectId,
};
