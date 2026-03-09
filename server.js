require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const userRoutes = require('./routes/auth');
const managerRoutes = require('./routes/manager');
const salesAgent = require('./routes/salesAgent');
const director = require('./routes/director');

const app = express();

// Allow frontend apps from other origins to call this API.
app.use(cors());
// Parse incoming JSON and form data.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve static files for frontend pages and assets.
app.use(express.static('public'));
app.use(express.static('views'));


// Register route groups.
app.use('/', userRoutes);
app.use('/', managerRoutes);
app.use('/', salesAgent);
app.use('/', director);

// Serve Swagger API documentation.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Connect to MongoDB and start the API server.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log(err));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
