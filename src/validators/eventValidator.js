const { z } = require('zod');

const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters').max(200, 'Event name must not exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must not exceed 2000 characters'),
  date: z.string().datetime('Invalid date format').or(z.date()),
  location: z.string().min(3, 'Location must be at least 3 characters').max(200, 'Location must not exceed 200 characters'),
  totalTickets: z.number().int().min(1, 'Total tickets must be at least 1').max(1000000, 'Total tickets exceeds maximum'),
  price: z.number().min(0, 'Price cannot be negative').max(1000000, 'Price exceeds maximum'),
});

const updateEventSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
  date: z.string().datetime().or(z.date()).optional(),
  location: z.string().min(3).max(200).optional(),
  totalTickets: z.number().int().min(1).max(1000000).optional(),
  price: z.number().min(0).max(1000000).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

const eventQuerySchema = z.object({
  date: z.string().optional(),
  location: z.string().optional(),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  eventQuerySchema,
};
