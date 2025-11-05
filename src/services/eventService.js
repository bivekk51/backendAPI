const Event = require('../models/Event');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');

const createEvent = async (eventData, userId) => {
  try {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const event = await Event.create({
      ...eventData,
      createdBy: userId,
    });

    return event;
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new ValidationError(error.message);
    }
    throw error;
  }
};

const getAllEvents = async (filters = {}) => {
  try {
    const query = {};
    
    if (filters.date) {
      const filterDate = new Date(filters.date);
      if (isNaN(filterDate.getTime())) {
        throw new ValidationError('Invalid date format');
      }
      query.date = { $gte: filterDate };
    }
    
    if (filters.location) {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    const events = await Event.find(query).populate('createdBy', 'name email').sort({ date: 1 });
    return events;
  } catch (error) {
    throw error;
  }
};

const getEventById = async (eventId) => {
  try {
    if (!eventId) {
      throw new ValidationError('Event ID is required');
    }

    const event = await Event.findById(eventId).populate('createdBy', 'name email');
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    return event;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid event ID format');
    }
    throw error;
  }
};

const updateEvent = async (eventId, updateData, userId, userRole) => {
  try {
    if (!eventId || !userId) {
      throw new ValidationError('Event ID and User ID are required');
    }

    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (userRole !== 'admin' && event.createdBy.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to update this event');
    }

    Object.assign(event, updateData);
    await event.save();
    
    return event;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid event ID format');
    }
    if (error.name === 'ValidationError') {
      throw new ValidationError(error.message);
    }
    throw error;
  }
};

const deleteEvent = async (eventId, userId, userRole) => {
  try {
    if (!eventId || !userId) {
      throw new ValidationError('Event ID and User ID are required');
    }

    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (userRole !== 'admin' && event.createdBy.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to delete this event');
    }

    await Event.findByIdAndDelete(eventId);
    return { message: 'Event deleted successfully' };
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid event ID format');
    }
    throw error;
  }
};

const checkAvailability = async (eventId, requestedQuantity) => {
  try {
    if (!eventId) {
      throw new ValidationError('Event ID is required');
    }

    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return event.availableTickets >= requestedQuantity;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid event ID format');
    }
    throw error;
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  checkAvailability,
};
