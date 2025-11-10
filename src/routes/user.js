const express = require('express');
const { register, login } = require('../controllers/userController');
const { authRateLimit } = require('../middleware/cacheMiddleware');

const router = express.Router();

// Apply strict rate limiting to authentication routes
router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);

module.exports = router;
