const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    location: {
      type: String,
      required: [true, 'Event location is required'],
      trim: true,
    },
    totalTickets: {
      type: Number,
      required: [true, 'Total tickets is required'],
      min: [1, 'Total tickets must be at least 1'],
    },
    availableTickets: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: [true, 'Ticket price is required'],
      min: [0, 'Price cannot be negative'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.pre('save', function (next) {
  if (this.isNew) {
    this.availableTickets = this.totalTickets;
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);
