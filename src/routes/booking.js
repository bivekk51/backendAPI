const express = require('express');
const { create, confirm, cancel, getUserBookingsList, getById } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const { bookingRateLimit, cacheMiddleware } = require('../middleware/cacheMiddleware');

const router = express.Router();

// Apply booking-specific rate limiting
router.post('/', protect, bookingRateLimit, create);
router.post('/:id/confirm', protect, bookingRateLimit, confirm);
router.post('/:id/cancel', protect, bookingRateLimit, cancel);

// Cache user booking lists for 2 minutes
router.get('/', protect, cacheMiddleware(120, (req) => `user:${req.user._id}:bookings`), getUserBookingsList);

// Cache individual booking details for 5 minutes
router.get('/:id', protect, cacheMiddleware(300, (req) => `booking:${req.params.id}`), getById);

module.exports = router;
