const express = require('express');
const { create, getAll, getById, update, remove } = require('../controllers/eventController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, adminOnly, create);
router.get('/', getAll);
router.get('/:id', getById);
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;
