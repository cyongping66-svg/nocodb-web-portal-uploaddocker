const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NocoDB Web Portal API',
      version: '1.0.0',
      description: 'RESTful API documentation for NocoDB Web Portal Backend',
    },
    servers: [
      {
        url: 'http://localhost:8000/api',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Table: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            columns: { type: 'array', items: { type: 'object' } },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Row: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            data: { type: 'object' },
            _createdAt: { type: 'string', format: 'date-time' },
            _updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs;
