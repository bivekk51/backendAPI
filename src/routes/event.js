const express = require('express');
const { create, getAll, getById, update, remove } = require('../controllers/eventController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { cacheEventList, cacheEvent, rateLimitMiddleware } = require('../middleware/cacheMiddleware');

const router = express.Router();

// Apply general rate limiting to all event routes
router.use(rateLimitMiddleware(200, 900)); // 200 requests per 15 minutes

router.post('/', protect, adminOnly, create);
router.get('/', cacheEventList(300), getAll); // Cache event lists for 5 minutes
router.get('/:id', cacheEvent(1800), getById); // Cache individual events for 30 minutes
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;
