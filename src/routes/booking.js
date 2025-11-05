const express = require('express');
const { create, confirm, cancel, getUserBookingsList, getById } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, create);
router.post('/:id/confirm', protect, confirm);
router.post('/:id/cancel', protect, cancel);
router.get('/', protect, getUserBookingsList);
router.get('/:id', protect, getById);

module.exports = router;
