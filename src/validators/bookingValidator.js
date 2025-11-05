const { z } = require('zod');

const createBookingSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Cannot book more than 100 tickets at once'),
});

module.exports = {
  createBookingSchema,
};
