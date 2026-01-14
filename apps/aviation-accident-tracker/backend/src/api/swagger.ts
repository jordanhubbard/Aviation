/**
 * OpenAPI/Swagger Configuration for Aviation Accident Tracker API
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aviation Accident Tracker API',
      version: '0.1.0',
      description: 'API for tracking and analyzing aviation accidents and incidents from year 2000 onward. Provides data from multiple trusted sources with full provenance tracking.',
      contact: {
        name: 'Aviation Team',
        url: 'https://github.com/jordanhubbard/Aviation',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
      {
        url: 'https://aviation-accident-tracker.example.com',
        description: 'Production server',
      },
    ],
    components: {
      schemas: {
        Event: {
          type: 'object',
          required: ['id', 'date_z', 'category'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique event identifier',
              example: 'ASN_2024-01-15_N12345',
            },
            date_z: {
              type: 'string',
              format: 'date-time',
              description: 'Event date/time in UTC (Zulu time)',
              example: '2024-01-15T14:30:00Z',
            },
            registration: {
              type: 'string',
              nullable: true,
              description: 'Aircraft registration number',
              example: 'N12345',
            },
            aircraft_type: {
              type: 'string',
              nullable: true,
              description: 'Aircraft type/model',
              example: 'Cessna 172',
            },
            operator: {
              type: 'string',
              nullable: true,
              description: 'Operating company or individual',
              example: 'ABC Flight School',
            },
            airport_icao: {
              type: 'string',
              nullable: true,
              description: 'Airport ICAO code',
              example: 'KSFO',
            },
            airport_name: {
              type: 'string',
              nullable: true,
              description: 'Airport full name',
              example: 'San Francisco International Airport',
            },
            location: {
              type: 'string',
              nullable: true,
              description: 'Event location description',
              example: 'Near San Francisco, CA',
            },
            country: {
              type: 'string',
              nullable: true,
              description: 'Country code (ISO 3166-1 alpha-2)',
              example: 'US',
            },
            region: {
              type: 'string',
              nullable: true,
              description: 'Geographic region',
              example: 'North America',
            },
            latitude: {
              type: 'number',
              format: 'double',
              nullable: true,
              description: 'Latitude coordinate',
              example: 37.6213,
              minimum: -90,
              maximum: 90,
            },
            longitude: {
              type: 'number',
              format: 'double',
              nullable: true,
              description: 'Longitude coordinate',
              example: -122.3790,
              minimum: -180,
              maximum: 180,
            },
            category: {
              type: 'string',
              enum: ['GA', 'Commercial', 'Unknown'],
              description: 'Flight category: GA (General Aviation), Commercial, or Unknown',
              example: 'GA',
            },
            narrative: {
              type: 'string',
              nullable: true,
              description: 'Full event narrative',
              example: 'Aircraft experienced engine failure during climb...',
            },
            narrative_summary: {
              type: 'string',
              nullable: true,
              description: 'Brief summary of the event',
              example: 'Engine failure during climb',
            },
            fatalities: {
              type: 'integer',
              nullable: true,
              description: 'Number of fatalities',
              example: 0,
              minimum: 0,
            },
            injuries: {
              type: 'integer',
              nullable: true,
              description: 'Number of injuries',
              example: 2,
              minimum: 0,
            },
            damage: {
              type: 'string',
              nullable: true,
              description: 'Aircraft damage assessment',
              example: 'Substantial',
            },
          },
        },
        EventWithSources: {
          allOf: [
            { $ref: '#/components/schemas/Event' },
            {
              type: 'object',
              properties: {
                sources: {
                  type: 'array',
                  description: 'Provenance sources for this event',
                  items: { $ref: '#/components/schemas/Source' },
                },
              },
            },
          ],
        },
        Source: {
          type: 'object',
          required: ['source_name', 'source_url', 'fetched_at_z'],
          properties: {
            source_name: {
              type: 'string',
              description: 'Source name (ASN, AVHerald, etc.)',
              example: 'ASN',
            },
            source_url: {
              type: 'string',
              format: 'uri',
              description: 'Source URL',
              example: 'https://aviation-safety.net/database/record.php?id=20240115-0',
            },
            fetched_at_z: {
              type: 'string',
              format: 'date-time',
              description: 'When the data was fetched (UTC)',
              example: '2024-01-16T00:00:00Z',
            },
            checksum: {
              type: 'string',
              nullable: true,
              description: 'Content checksum (for change detection)',
              example: 'abc123def456',
            },
          },
        },
        EventList: {
          type: 'object',
          required: ['events', 'total', 'limit', 'offset'],
          properties: {
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/Event' },
            },
            total: {
              type: 'integer',
              description: 'Total number of events matching the filter',
              example: 150,
            },
            limit: {
              type: 'integer',
              description: 'Number of events per page',
              example: 50,
            },
            offset: {
              type: 'integer',
              description: 'Offset for pagination',
              example: 0,
            },
          },
        },
        Airport: {
          type: 'object',
          properties: {
            icao: {
              type: 'string',
              description: 'ICAO airport code',
              example: 'KSFO',
            },
            iata: {
              type: 'string',
              nullable: true,
              description: 'IATA airport code',
              example: 'SFO',
            },
            name: {
              type: 'string',
              description: 'Airport name',
              example: 'San Francisco International Airport',
            },
            city: {
              type: 'string',
              nullable: true,
              description: 'City',
              example: 'San Francisco',
            },
            country: {
              type: 'string',
              nullable: true,
              description: 'Country',
              example: 'United States',
            },
            latitude: {
              type: 'number',
              format: 'double',
              nullable: true,
              description: 'Latitude',
              example: 37.6213,
            },
            longitude: {
              type: 'number',
              format: 'double',
              nullable: true,
              description: 'Longitude',
              example: -122.3790,
            },
          },
        },
        FilterOptions: {
          type: 'object',
          properties: {
            countries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Available countries',
              example: ['US', 'CA', 'MX'],
            },
            regions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Available regions',
              example: ['North America', 'Europe'],
            },
          },
        },
        IngestionRequest: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              enum: ['ASN', 'AVHerald'],
              description: 'Source to ingest from (omit for all sources)',
              example: 'ASN',
            },
            windowDays: {
              type: 'integer',
              minimum: 1,
              maximum: 365,
              description: 'Number of days to look back (default: 40)',
              example: 40,
            },
          },
        },
        IngestionResult: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['completed', 'failed'],
              example: 'completed',
            },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: {
                    type: 'string',
                    example: 'ASN',
                  },
                  fetched: {
                    type: 'integer',
                    example: 150,
                  },
                  inserted: {
                    type: 'integer',
                    example: 15,
                  },
                  updated: {
                    type: 'integer',
                    example: 5,
                  },
                  skipped: {
                    type: 'integer',
                    example: 130,
                  },
                  errors: {
                    type: 'integer',
                    example: 0,
                  },
                },
              },
            },
          },
        },
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
              example: 'Not found',
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Event ASN_2024-01-01_N12345 not found',
            },
          },
        },
        Health: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              example: 'healthy',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T12:00:00Z',
            },
            uptime: {
              type: 'number',
              description: 'Uptime in seconds',
              example: 3600,
            },
            database: {
              type: 'string',
              enum: ['ok', 'error'],
              example: 'ok',
            },
            version: {
              type: 'string',
              example: '0.1.0',
            },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token for ingestion endpoint',
        },
      },
    },
    tags: [
      {
        name: 'Events',
        description: 'Aviation accident and incident events',
      },
      {
        name: 'Airports',
        description: 'Airport search',
      },
      {
        name: 'Filters',
        description: 'Filter options',
      },
      {
        name: 'Ingestion',
        description: 'Data ingestion management (requires authentication)',
      },
      {
        name: 'Health',
        description: 'Service health',
      },
    ],
  },
  apis: ['./src/api/routes.ts'], // Path to API routes with JSDoc comments
};

export const swaggerSpec = swaggerJsdoc(options);
