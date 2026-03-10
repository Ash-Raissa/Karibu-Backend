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
// The earlier configuration was too restrictive and didn't handle preflight
// OPTIONS requests.  Render (and many CDNs) will send an OPTIONS request
// before POSTing JSON; if the CORS middleware doesn't answer that request
// the browser complains about missing headers.
//
// Here we explicitly allow the Netlify origin, enable common headers, and
// make sure every OPTIONS route is handled by CORS.  You can tighten this
// later, but the important part is that the middleware runs for every request.

app.use(cors({
  origin: "https://karibugroceriesltd.netlify.app",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// also respond to preflight across the board
app.options("*", cors({
  origin: "https://karibugroceriesltd.netlify.app"
}));

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
