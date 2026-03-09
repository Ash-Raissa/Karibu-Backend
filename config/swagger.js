const swaggerJSDoc = require('swagger-jsdoc')

// Swagger setup used to generate live API docs from route annotations.
const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Karibu Groceries API',
      version: '1.0.0',
      description: 'API documentation for Karibu Groceries LTD'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and user account routes' },
      { name: 'Manager', description: 'Manager routes' },
      { name: 'Sales Agent', description: 'Sales agent routes' },
      { name: 'Director', description: 'Director reporting routes' }
    ]
  },
  apis: ['./routes/*.js']
}

const swaggerSpec = swaggerJSDoc(options)

// Export generated Swagger document.
module.exports = swaggerSpec
