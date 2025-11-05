const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { NotFoundError, AuthorizationError, ValidationError, ConflictError } = require('../utils/errors');

const HOLD_DURATION_MS = 10 * 60 * 1000;

const createBooking = async (eventId, userId, quantity) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!eventId || !userId || !quantity) {
      throw new ValidationError('Event ID, User ID, and quantity are required');
    }

    if (quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0');
    }

    const event = await Event.findById(eventId).session(session);
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.availableTickets < quantity) {
      throw new ConflictError(`Only ${event.availableTickets} tickets available`);
    }

    event.availableTickets -= quantity;
    await event.save({ session });

    const holdExpiry = new Date(Date.now() + HOLD_DURATION_MS);
    const totalPrice = event.price * quantity;

    const ticket = await Ticket.create(
      [
        {
          event: eventId,
          user: userId,
          quantity,
          totalPrice,
          status: 'pending',
          holdExpiry,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    
    return await Ticket.findById(ticket[0]._id)
      .populate('event', 'name date location price')
      .populate('user', 'name email');
  } catch (error) {
    await session.abortTransaction();
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid event ID format');
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const confirmBooking = async (ticketId, userId) => {
  try {
    if (!ticketId || !userId) {
      throw new ValidationError('Booking ID and User ID are required');
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      throw new NotFoundError('Booking not found');
    }

    if (ticket.user.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to confirm this booking');
    }

    if (ticket.status !== 'pending') {
      throw new ConflictError('Booking cannot be confirmed. Current status: ' + ticket.status);
    }

    if (new Date() > ticket.holdExpiry) {
      throw new ConflictError('Booking hold has expired');
    }

    ticket.status = 'confirmed';
    ticket.holdExpiry = undefined;
    await ticket.save();

    return await Ticket.findById(ticketId)
      .populate('event', 'name date location price')
      .populate('user', 'name email');
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid booking ID format');
    }
    throw error;
  }
};

const cancelBooking = async (ticketId, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!ticketId || !userId) {
      throw new ValidationError('Booking ID and User ID are required');
    }

    const ticket = await Ticket.findById(ticketId).session(session);

    if (!ticket) {
      throw new NotFoundError('Booking not found');
    }

    if (ticket.user.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to cancel this booking');
    }

    if (ticket.status === 'cancelled') {
      throw new ConflictError('Booking already cancelled');
    }

    const event = await Event.findById(ticket.event).session(session);
    if (!event) {
      throw new NotFoundError('Associated event not found');
    }

    event.availableTickets += ticket.quantity;
    await event.save({ session });

    ticket.status = 'cancelled';
    await ticket.save({ session });

    await session.commitTransaction();
    
    return await Ticket.findById(ticketId)
      .populate('event', 'name date location price')
      .populate('user', 'name email');
  } catch (error) {
    await session.abortTransaction();
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid booking ID format');
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const getUserBookings = async (userId) => {
  try {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const bookings = await Ticket.find({ user: userId })
      .populate('event', 'name date location price')
      .sort({ createdAt: -1 });
    
    return bookings;
  } catch (error) {
    throw error;
  }
};

const getBookingById = async (ticketId, userId) => {
  try {
    if (!ticketId || !userId) {
      throw new ValidationError('Booking ID and User ID are required');
    }

    const ticket = await Ticket.findById(ticketId)
      .populate('event', 'name date location price')
      .populate('user', 'name email');

    if (!ticket) {
      throw new NotFoundError('Booking not found');
    }

    if (ticket.user._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to view this booking');
    }

    return ticket;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid booking ID format');
    }
    throw error;
  }
};

const releaseExpiredHolds = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const expiredTickets = await Ticket.find({
      status: 'pending',
      holdExpiry: { $lt: new Date() },
    }).session(session);

    for (const ticket of expiredTickets) {
      const event = await Event.findById(ticket.event).session(session);
      if (event) {
        event.availableTickets += ticket.quantity;
        await event.save({ session });
      }

      ticket.status = 'cancelled';
      await ticket.save({ session });
    }

    await session.commitTransaction();
    return { released: expiredTickets.length };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  createBooking,
  confirmBooking,
  cancelBooking,
  getUserBookings,
  getBookingById,
  releaseExpiredHolds,
};
