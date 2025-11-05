const express = require('express');
const userRoutes = require('./user');
const eventRoutes = require('./event');
const bookingRoutes = require('./booking');

const router = express.Router();

router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/bookings', bookingRoutes);

module.exports = router;
