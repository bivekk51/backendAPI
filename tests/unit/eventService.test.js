const mongoose = require('mongoose');
const {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../../src/services/eventService');
const Event = require('../../src/models/Event');
const { NotFoundError, AuthorizationError, ValidationError } = require('../../src/utils/errors');

jest.mock('../../src/models/Event');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Event Service', () => {
  const adminUserId = new mongoose.Types.ObjectId();
  const regularUserId = new mongoose.Types.ObjectId();

  describe('createEvent', () => {
    it('should create event successfully', async () => {
      const eventData = {
        name: 'Test Concert',
        description: 'A great concert',
        date: new Date(Date.now() + 86400000),
        location: 'Test Venue',
        totalTickets: 100,
        price: 50,
      };

      const mockEvent = {
        _id: new mongoose.Types.ObjectId(),
        ...eventData,
        availableTickets: 100,
        createdBy: adminUserId,
      };

      Event.create.mockResolvedValue(mockEvent);

      const event = await createEvent(eventData, adminUserId);

      expect(Event.create).toHaveBeenCalledWith({
        ...eventData,
        createdBy: adminUserId,
      });
      expect(event.name).toBe(eventData.name);
      expect(event.totalTickets).toBe(100);
      expect(event.availableTickets).toBe(100);
    });

    it('should throw ValidationError when userId is missing', async () => {
      const eventData = {
        name: 'Test Concert',
        description: 'A great concert',
        date: new Date(),
        location: 'Test Arena',
        totalTickets: 100,
        price: 50,
      };

      await expect(createEvent(eventData, null)).rejects.toThrow(ValidationError);
    });
  });

  describe('getAllEvents', () => {
    it('should get all events without filters', async () => {
      const mockEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Event 1',
          location: 'New York',
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Event 2',
          location: 'Los Angeles',
        },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockEvents),
      };
      Event.find.mockReturnValue(mockQuery);

      const events = await getAllEvents();
      
      expect(Event.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalledWith('createdBy', 'name email');
      expect(mockQuery.sort).toHaveBeenCalledWith({ date: 1 });
      expect(events).toHaveLength(2);
    });

    it('should filter events by location', async () => {
      const mockEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Event 1',
          location: 'New York',
        },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockEvents),
      };

      Event.find.mockReturnValue(mockQuery);

      const events = await getAllEvents({ location: 'New York' });
      expect(events).toHaveLength(1);
      expect(events[0].location).toBe('New York');
    });

    it('should filter events by date', async () => {
      const mockEvents = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Event 2',
          date: new Date('2025-06-01'),
        },
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockEvents),
      };

      Event.find.mockReturnValue(mockQuery);

      const events = await getAllEvents({ date: '2025-01-01' });
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('Event 2');
    });
  });

  describe('getEventById', () => {
    it('should get event by valid ID', async () => {
      const mockEventId = new mongoose.Types.ObjectId();
      const mockEvent = {
        _id: mockEventId,
        name: 'Test Event',
        description: 'Description',
        location: 'Test Location',
        totalTickets: 100,
        availableTickets: 100,
        price: 50,
        createdBy: adminUserId,
      };

      const mockQuery = {
        populate: jest.fn().mockResolvedValue(mockEvent),
      };
      Event.findById.mockReturnValue(mockQuery);

      const event = await getEventById(mockEventId);
      
      expect(Event.findById).toHaveBeenCalledWith(mockEventId);
      expect(mockQuery.populate).toHaveBeenCalledWith('createdBy', 'name email');
      expect(event.name).toBe('Test Event');
    });

    it('should throw NotFoundError for non-existent ID', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const mockQuery = {
        populate: jest.fn().mockResolvedValue(null),
      };

      Event.findById.mockReturnValue(mockQuery);

      await expect(getEventById(fakeId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for invalid ID format', async () => {
      const mockQuery = {
        populate: jest.fn().mockResolvedValue(null),
      };

      Event.findById.mockReturnValue(mockQuery);

      await expect(getEventById('invalid-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateEvent', () => {
    let event;
    let eventId;

    beforeEach(() => {
      eventId = new mongoose.Types.ObjectId();
      event = {
        _id: eventId,
        name: 'Original Event',
        description: 'Original Description',
        date: new Date(),
        location: 'Original Location',
        totalTickets: 100,
        availableTickets: 100,
        price: 50,
        createdBy: regularUserId,
        save: jest.fn(),
      };
    });

    it('should allow creator to update their event', async () => {
      const updatedEvent = { ...event, name: 'Updated Event' };
      event.save.mockResolvedValue(updatedEvent);
      Event.findById.mockResolvedValue(event);

      const updated = await updateEvent(
        eventId,
        { name: 'Updated Event' },
        regularUserId,
        'user'
      );

      expect(Event.findById).toHaveBeenCalledWith(eventId);
      expect(event.save).toHaveBeenCalled();
      expect(event.name).toBe('Updated Event');
    });

    it('should allow admin to update any event', async () => {
      const updatedEvent = { ...event, name: 'Admin Updated' };
      event.save.mockResolvedValue(updatedEvent);
      Event.findById.mockResolvedValue(event);

      const updated = await updateEvent(
        eventId,
        { name: 'Admin Updated' },
        adminUserId,
        'admin'
      );

      expect(Event.findById).toHaveBeenCalledWith(eventId);
      expect(event.save).toHaveBeenCalled();
      expect(event.name).toBe('Admin Updated');
    });

    it('should throw AuthorizationError for non-creator non-admin', async () => {
      const anotherUserId = new mongoose.Types.ObjectId();
      Event.findById.mockResolvedValue(event);
      
      await expect(
        updateEvent(eventId, { name: 'Hack' }, anotherUserId, 'user')
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('deleteEvent', () => {
    let event;
    let eventId;

    beforeEach(() => {
      eventId = new mongoose.Types.ObjectId();
      event = {
        _id: eventId,
        name: 'Event to Delete',
        description: 'Description',
        date: new Date(),
        location: 'Location',
        totalTickets: 100,
        availableTickets: 100,
        price: 50,
        createdBy: regularUserId,
      };
    });

    it('should allow creator to delete their event', async () => {
      Event.findById.mockResolvedValue(event);
      Event.findByIdAndDelete.mockResolvedValue(event);

      await deleteEvent(eventId, regularUserId, 'user');
      
      expect(Event.findById).toHaveBeenCalledWith(eventId);
      expect(Event.findByIdAndDelete).toHaveBeenCalledWith(eventId);
    });

    it('should allow admin to delete any event', async () => {
      Event.findById.mockResolvedValue(event);
      Event.findByIdAndDelete.mockResolvedValue(event);

      await deleteEvent(eventId, adminUserId, 'admin');
      
      expect(Event.findById).toHaveBeenCalledWith(eventId);
      expect(Event.findByIdAndDelete).toHaveBeenCalledWith(eventId);
    });

    it('should throw AuthorizationError for unauthorized user', async () => {
      const anotherUserId = new mongoose.Types.ObjectId();
      Event.findById.mockResolvedValue(event);
      
      await expect(
        deleteEvent(eventId, anotherUserId, 'user')
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
