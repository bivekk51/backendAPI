require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/db');
const redisClient = require('./src/config/redis');
const cacheCleanupService = require('./src/services/cacheCleanupService');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorMiddleware');

const app = express();

// Initialize database and cache
const initializeServices = async () => {
  await connectDB();
  
  // Start cache cleanup service after a short delay
  setTimeout(() => {
    cacheCleanupService.start();
  }, 5000);
};

initializeServices();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'TIX-HUB API is running',
    cache: redisClient.isConnected ? 'Connected' : 'Disconnected'
  });
});

// Health check endpoint including cache status
app.get('/health', async (req, res) => {
  try {
    const cacheHealth = await cacheCleanupService.getHealthStatus();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'connected',
        cache: cacheHealth
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  
  // Stop cache cleanup service
  cacheCleanupService.stop();
  
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      
      // Close Redis connection
      await redisClient.disconnect();
      console.log('Redis connection closed.');
      
      process.exit(0);
    });
  } else {
    await redisClient.disconnect();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
