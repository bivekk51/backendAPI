const {
  createBooking,
  confirmBooking,
  cancelBooking,
  getUserBookings,
  getBookingById,
} = require('../services/bookingService');
const { createBookingSchema } = require('../validators/bookingValidator');
const { asyncHandler } = require('../middleware/errorMiddleware');

const create = asyncHandler(async (req, res) => {
  const validatedData = createBookingSchema.parse(req.body);
  const booking = await createBooking(validatedData.eventId, req.user._id, validatedData.quantity);
  res.status(201).json({
    success: true,
    data: booking,
  });
});

const confirm = asyncHandler(async (req, res) => {
  const booking = await confirmBooking(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    data: booking,
  });
});

const cancel = asyncHandler(async (req, res) => {
  const booking = await cancelBooking(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    data: booking,
  });
});

const getUserBookingsList = asyncHandler(async (req, res) => {
  const bookings = await getUserBookings(req.user._id);
  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings,
  });
});

const getById = asyncHandler(async (req, res) => {
  const booking = await getBookingById(req.params.id, req.user._id);
  res.status(200).json({
    success: true,
    data: booking,
  });
});

module.exports = { create, confirm, cancel, getUserBookingsList, getById };
