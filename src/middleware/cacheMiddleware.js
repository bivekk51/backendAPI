const redisClient = require('../config/redis');

/**
 * Cache middleware for HTTP responses
 * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
 * @param {function} keyGenerator - Function to generate cache key from req
 */
const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      let cacheKey;
      if (keyGenerator && typeof keyGenerator === 'function') {
        cacheKey = keyGenerator(req);
      } else {
        // Default key generation
        const baseKey = req.originalUrl || req.url;
        const queryString = Object.keys(req.query).length > 0 
          ? JSON.stringify(req.query) 
          : '';
        cacheKey = `route:${baseKey}:${queryString}`;
      }

      // Try to get cached data
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        return res.status(200).json(cachedData);
      }

      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Cache the response asynchronously
          redisClient.set(cacheKey, data, ttl).catch(err => {
            console.error('Cache set error:', err);
          });
        }
        
        // Set cache headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        
        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Cache middleware specifically for event lists
 */
const cacheEventList = (ttl = 300) => {
  return cacheMiddleware(ttl, (req) => {
    const filters = [];
    if (req.query.date) filters.push(`date:${req.query.date}`);
    if (req.query.location) filters.push(`location:${req.query.location}`);
    if (req.query.category) filters.push(`category:${req.query.category}`);
    
    const filterKey = filters.length > 0 ? filters.join('|') : 'all';
    return `events:list:${filterKey}`;
  });
};

/**
 * Cache middleware specifically for individual events
 */
const cacheEvent = (ttl = 1800) => {
  return cacheMiddleware(ttl, (req) => {
    return `event:${req.params.id}`;
  });
};

/**
 * Cache middleware for user profile data
 */
const cacheUserProfile = (ttl = 3600) => {
  return cacheMiddleware(ttl, (req) => {
    return `user:profile:${req.user._id}`;
  });
};

/**
 * Cache middleware for event availability
 */
const cacheEventAvailability = (ttl = 60) => {
  return cacheMiddleware(ttl, (req) => {
    return `availability:${req.params.id}`;
  });
};

/**
 * Invalidate cache patterns
 */
const invalidateCache = {
  // Invalidate all event-related caches
  events: async () => {
    try {
      await Promise.all([
        redisClient.delPattern('events:*'),
        redisClient.delPattern('event:*'),
        redisClient.delPattern('availability:*'),
        redisClient.delPattern('route:/api/v1/events*')
      ]);
    } catch (error) {
      console.error('Error invalidating event caches:', error);
    }
  },

  // Invalidate specific event cache
  event: async (eventId) => {
    try {
      await Promise.all([
        redisClient.del(`event:${eventId}`),
        redisClient.del(`availability:${eventId}`),
        redisClient.delPattern('events:*'), // Invalidate lists that might contain this event
        redisClient.delPattern('route:/api/v1/events*')
      ]);
    } catch (error) {
      console.error('Error invalidating event cache:', error);
    }
  },

  // Invalidate user cache
  user: async (userId) => {
    try {
      await Promise.all([
        redisClient.del(`user:${userId}`),
        redisClient.del(`user:profile:${userId}`),
        redisClient.delPattern(`route:/api/v1/users/${userId}*`)
      ]);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  },

  // Invalidate booking-related caches
  booking: async (eventId) => {
    try {
      await Promise.all([
        redisClient.del(`availability:${eventId}`),
        redisClient.del(`event:${eventId}`),
        redisClient.delPattern('events:*') // Event lists might show availability
      ]);
    } catch (error) {
      console.error('Error invalidating booking cache:', error);
    }
  }
};

/**
 * Rate limiting middleware
 */
const rateLimitMiddleware = (limit = 100, window = 900, keyGenerator = null) => {
  return async (req, res, next) => {
    try {
      let rateLimitKey;
      if (keyGenerator && typeof keyGenerator === 'function') {
        rateLimitKey = keyGenerator(req);
      } else {
        // Default: limit by IP address
        const ip = req.ip || req.connection.remoteAddress;
        rateLimitKey = `rate_limit:${ip}`;
      }

      const result = await redisClient.rateLimit(rateLimitKey, limit, window);
      
      // Set rate limit headers
      res.set('X-RateLimit-Limit', limit);
      res.set('X-RateLimit-Remaining', result.remaining);
      res.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Continue without rate limiting on error
      next();
    }
  };
};

/**
 * Rate limit specifically for booking endpoints
 */
const bookingRateLimit = rateLimitMiddleware(10, 60, (req) => {
  const userId = req.user ? req.user._id : req.ip;
  return `booking_rate_limit:${userId}`;
});

/**
 * Rate limit for authentication endpoints
 */
const authRateLimit = rateLimitMiddleware(5, 300, (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  return `auth_rate_limit:${ip}`;
});

module.exports = {
  cacheMiddleware,
  cacheEventList,
  cacheEvent,
  cacheUserProfile,
  cacheEventAvailability,
  invalidateCache,
  rateLimitMiddleware,
  bookingRateLimit,
  authRateLimit
};