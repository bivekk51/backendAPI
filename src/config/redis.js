const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Create Redis client with configuration
      this.client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      // Handle connection events
      this.client.on('connect', () => {
        console.log(' Redis connecting...');
      });

      this.client.on('ready', () => {
        console.log(' Redis connection established successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error(' Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log(' Redis connection closed');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // Don't throw error - allow app to work without caching
      this.isConnected = false;
      return null;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
    }
  }

  // Generic cache methods
  async get(key) {
    if (!this.isConnected || !this.client) return null;
    
    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async delPattern(pattern) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async incr(key, ttl = 3600) {
    if (!this.isConnected || !this.client) return 0;
    
    try {
      const result = await this.client.incr(key);
      if (result === 1) {
        // Set TTL only on first increment
        await this.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      console.error('Redis INCR error:', error);
      return 0;
    }
  }

  // Cache for events
  async cacheEvent(eventId, eventData, ttl = 1800) {
    return await this.set(`event:${eventId}`, eventData, ttl);
  }

  async getCachedEvent(eventId) {
    return await this.get(`event:${eventId}`);
  }

  async invalidateEvent(eventId) {
    return await this.del(`event:${eventId}`);
  }

  // Cache for event lists
  async cacheEventList(filterKey, events, ttl = 300) {
    return await this.set(`events:${filterKey}`, events, ttl);
  }

  async getCachedEventList(filterKey) {
    return await this.get(`events:${filterKey}`);
  }

  async invalidateEventLists() {
    return await this.delPattern('events:*');
  }

  // Cache for user sessions
  async cacheUser(userId, userData, ttl = 3600) {
    return await this.set(`user:${userId}`, userData, ttl);
  }

  async getCachedUser(userId) {
    return await this.get(`user:${userId}`);
  }

  async invalidateUser(userId) {
    return await this.del(`user:${userId}`);
  }

  // Cache for booking availability
  async cacheEventAvailability(eventId, availabilityData, ttl = 60) {
    return await this.set(`availability:${eventId}`, availabilityData, ttl);
  }

  async getCachedEventAvailability(eventId) {
    return await this.get(`availability:${eventId}`);
  }

  async invalidateEventAvailability(eventId) {
    return await this.del(`availability:${eventId}`);
  }

  // Rate limiting
  async rateLimit(key, limit, window) {
    if (!this.isConnected || !this.client) return { allowed: true, remaining: limit };
    
    try {
      const current = await this.incr(key, window);
      const remaining = Math.max(0, limit - current);
      
      return {
        allowed: current <= limit,
        remaining,
        resetTime: Date.now() + (window * 1000)
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      return { allowed: true, remaining: limit };
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;