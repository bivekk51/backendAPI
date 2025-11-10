const redisClient = require('../config/redis');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');

class CacheCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Cache cleanup service is already running');
      return;
    }

    console.log('Starting cache cleanup service...');
    this.isRunning = true;

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, 5 * 60 * 1000);

    // Run initial cleanup
    this.performCleanup();
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('Cache cleanup service stopped');
  }

  async performCleanup() {
    try {
      console.log(' Running cache cleanup...');

      await Promise.all([
        this.cleanupExpiredBookingHolds(),
        this.cleanupExpiredRateLimits()
      ]);

      console.log(' Cache cleanup completed');
    } catch (error) {
      console.error(' Cache cleanup error:', error);
    }
  }

  async cleanupExpiredBookingHolds() {
    try {
      // Find and cleanup expired booking holds
      const expiredTickets = await Ticket.find({
        status: 'pending',
        holdExpiry: { $lt: new Date() }
      });

      if (expiredTickets.length === 0) {
        return;
      }

      console.log(`Found ${expiredTickets.length} expired ticket holds`);

      // Process expired tickets
      for (const ticket of expiredTickets) {
        try {
          // Return tickets to available pool
          await Event.findByIdAndUpdate(
            ticket.event,
            { $inc: { availableTickets: ticket.quantity } }
          );

          // Update ticket status
          ticket.status = 'expired';
          ticket.holdExpiry = undefined;
          await ticket.save();

          // Invalidate related caches
          await Promise.all([
            redisClient.invalidateEventAvailability(ticket.event),
            redisClient.invalidateEvent(ticket.event)
          ]);

          console.log(`✅ Released ${ticket.quantity} tickets for event ${ticket.event}`);
        } catch (error) {
          console.error(`Error cleaning up ticket ${ticket._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in cleanupExpiredBookingHolds:', error);
    }
  }

  async cleanupExpiredRateLimits() {
    try {
      // This would require custom logic based on your Redis key patterns
      // For now, Redis handles TTL automatically
      console.log('Rate limit cleanup handled by Redis TTL');
    } catch (error) {
      console.error('Error in cleanupExpiredRateLimits:', error);
    }
  }

  // Manual cache invalidation methods
  async invalidateUserCaches(userId) {
    try {
      await Promise.all([
        redisClient.invalidateUser(userId),
        redisClient.delPattern(`user:${userId}:*`),
        redisClient.delPattern(`*user:${userId}*`)
      ]);
      console.log(`Invalidated all caches for user ${userId}`);
    } catch (error) {
      console.error('Error invalidating user caches:', error);
    }
  }

  async invalidateEventCaches(eventId) {
    try {
      await Promise.all([
        redisClient.invalidateEvent(eventId),
        redisClient.invalidateEventAvailability(eventId),
        redisClient.invalidateEventLists()
      ]);
      console.log(`Invalidated all caches for event ${eventId}`);
    } catch (error) {
      console.error('Error invalidating event caches:', error);
    }
  }

  async clearAllCaches() {
    try {
      if (!redisClient.isConnected) {
        console.log('Redis not connected, skipping cache clear');
        return;
      }

      await redisClient.client.flushAll();
      console.log('🗑️ All caches cleared');
    } catch (error) {
      console.error('Error clearing all caches:', error);
    }
  }

  // Cache warming methods
  async warmPopularEventCaches() {
    try {
      // Get popular events (you might want to track this in your app)
      const popularEvents = await Event.find()
        .sort({ createdAt: -1 }) // or by some popularity metric
        .limit(10)
        .populate('createdBy', 'name email');

      for (const event of popularEvents) {
        await redisClient.cacheEvent(event._id, event, 1800);
      }

      console.log(`🔥 Warmed cache for ${popularEvents.length} popular events`);
    } catch (error) {
      console.error('Error warming event caches:', error);
    }
  }

  // Health check method
  async getHealthStatus() {
    try {
      const redisConnected = redisClient.isConnected;
      const cleanupRunning = this.isRunning;

      return {
        redis: {
          connected: redisConnected,
          status: redisConnected ? 'healthy' : 'disconnected'
        },
        cleanup: {
          running: cleanupRunning,
          status: cleanupRunning ? 'active' : 'stopped'
        },
        lastCleanup: new Date().toISOString()
      };
    } catch (error) {
      return {
        redis: { connected: false, status: 'error' },
        cleanup: { running: false, status: 'error' },
        error: error.message
      };
    }
  }
}

// Create singleton instance
const cacheCleanupService = new CacheCleanupService();

module.exports = cacheCleanupService;