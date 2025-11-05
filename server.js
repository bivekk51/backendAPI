require('dotenv').config();
const express = require('express');
const connectDB = require('./src/config/db');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorMiddleware');

const app = express();

connectDB();

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

const PORT = process.env.PORT || 5000;

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

module.exports = { app, server };
