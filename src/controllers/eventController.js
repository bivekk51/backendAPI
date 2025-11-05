const {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../services/eventService');
const { createEventSchema, updateEventSchema, eventQuerySchema } = require('../validators/eventValidator');
const { asyncHandler } = require('../middleware/errorMiddleware');

const create = asyncHandler(async (req, res) => {
  const validatedData = createEventSchema.parse(req.body);
  const event = await createEvent(validatedData, req.user._id);
  res.status(201).json({
    success: true,
    data: event,
  });
});

const getAll = asyncHandler(async (req, res) => {
  const validatedQuery = eventQuerySchema.parse(req.query);
  const events = await getAllEvents(validatedQuery);
  res.status(200).json({
    success: true,
    count: events.length,
    data: events,
  });
});

const getById = asyncHandler(async (req, res) => {
  const event = await getEventById(req.params.id);
  res.status(200).json({
    success: true,
    data: event,
  });
});

const update = asyncHandler(async (req, res) => {
  const validatedData = updateEventSchema.parse(req.body);
  const event = await updateEvent(
    req.params.id,
    validatedData,
    req.user._id,
    req.user.role
  );
  res.status(200).json({
    success: true,
    data: event,
  });
});

const remove = asyncHandler(async (req, res) => {
  const result = await deleteEvent(req.params.id, req.user._id, req.user.role);
  res.status(200).json({
    success: true,
    message: result.message,
  });
});

module.exports = { create, getAll, getById, update, remove };
