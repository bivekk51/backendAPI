const express = require('express');
const routes = require('../../src/routes');
const { errorHandler, notFoundHandler } = require('../../src/middleware/errorMiddleware');

const createTestApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'TIX-HUB API is running' 
    });
  });

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = createTestApp;
