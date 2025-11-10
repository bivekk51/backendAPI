const Event = require('../models/Event');
const redisClient = require('../config/redis');
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

    // Invalidate event list caches after creating new event
    await redisClient.invalidateEventLists();

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
    // Generate cache key based on filters
    const filterKeys = [];
    if (filters.date) filterKeys.push(`date:${filters.date}`);
    if (filters.location) filterKeys.push(`location:${filters.location.toLowerCase()}`);
    if (filters.category) filterKeys.push(`category:${filters.category}`);
    
    const cacheKey = filterKeys.length > 0 ? filterKeys.join('|') : 'all';
    
    // Try to get from cache first
    const cachedEvents = await redisClient.getCachedEventList(cacheKey);
    if (cachedEvents) {
      return cachedEvents;
    }

    // Build query
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
    
    // Cache the results for 5 minutes
    await redisClient.cacheEventList(cacheKey, events, 300);
    
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

    // Try to get from cache first
    const cachedEvent = await redisClient.getCachedEvent(eventId);
    if (cachedEvent) {
      return cachedEvent;
    }

    const event = await Event.findById(eventId).populate('createdBy', 'name email');
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Cache the event for 30 minutes
    await redisClient.cacheEvent(eventId, event, 1800);
    
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
    
    // Invalidate cache after update
    await Promise.all([
      redisClient.invalidateEvent(eventId),
      redisClient.invalidateEventLists(),
      redisClient.invalidateEventAvailability(eventId)
    ]);
    
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
    
    // Invalidate cache after deletion
    await Promise.all([
      redisClient.invalidateEvent(eventId),
      redisClient.invalidateEventLists(),
      redisClient.invalidateEventAvailability(eventId)
    ]);
    
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

    // Try to get availability from cache first
    const cachedAvailability = await redisClient.getCachedEventAvailability(eventId);
    if (cachedAvailability) {
      return cachedAvailability.availableTickets >= requestedQuantity;
    }

    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Cache availability for 1 minute (short TTL due to frequent updates)
    await redisClient.cacheEventAvailability(eventId, { 
      availableTickets: event.availableTickets,
      totalTickets: event.totalTickets 
    }, 60);

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
