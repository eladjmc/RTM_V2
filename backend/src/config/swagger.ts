import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RTM V2 API',
      version: '1.0.0',
      description: 'Read To Me V2 — Book/Chapter management with reading progress tracking',
    },
    servers: [
      {
        url: '/api',
        description: 'API base path',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Book: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '665a1b2c3d4e5f6a7b8c9d0e' },
            title: { type: 'string', example: 'The Great Gatsby' },
            author: { type: 'string', example: 'F. Scott Fitzgerald' },
            cover: { type: 'string', description: 'Base64 image or empty string' },
            lastReadChapter: { type: 'string', nullable: true, example: '665a1b2c3d4e5f6a7b8c9d0f' },
            lastReadPosition: {
              type: 'object',
              properties: {
                paragraphIndex: { type: 'number', example: 5 },
                wordIndex: { type: 'number', example: 12 },
              },
            },
            chapterCount: { type: 'number', example: 9 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        BookDetail: {
          type: 'object',
          properties: {
            book: { $ref: '#/components/schemas/Book' },
            lastChapter: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/Chapter' }],
            },
          },
        },
        Chapter: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '665a1b2c3d4e5f6a7b8c9d0f' },
            book: { type: 'string', example: '665a1b2c3d4e5f6a7b8c9d0e' },
            chapterNumber: { type: 'number', example: 1 },
            title: { type: 'string', example: 'Chapter 1' },
            content: { type: 'string', example: 'In my younger and more vulnerable years...' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ChapterSummary: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            chapterNumber: { type: 'number' },
            title: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'admin123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Not found' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
