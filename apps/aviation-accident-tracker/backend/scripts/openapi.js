import fs from 'fs';
import path from 'path';
const spec = {
    openapi: '3.0.0',
    info: {
        title: 'Aviation Accident Tracker API',
        version: '0.1.0',
        description: 'API for accidents/incidents ingestion and retrieval',
    },
    servers: [{ url: '/' }],
    components: {
        schemas: {
            SourceAttribution: {
                type: 'object',
                properties: {
                    sourceName: { type: 'string', example: 'ASN' },
                    url: { type: 'string', format: 'uri' },
                    fetchedAt: { type: 'string', format: 'date-time' },
                    checksum: { type: 'string', nullable: true },
                },
                required: ['sourceName', 'url', 'fetchedAt'],
            },
            EventRecord: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'evt_20240101_N12345' },
                    dateZ: { type: 'string', format: 'date-time', description: 'UTC timestamp' },
                    registration: { type: 'string', example: 'N12345' },
                    aircraftType: { type: 'string', nullable: true, example: 'B738' },
                    operator: { type: 'string', nullable: true, example: 'Acme Airlines' },
                    category: { type: 'string', enum: ['general', 'commercial', 'unknown'] },
                    airportIcao: { type: 'string', nullable: true, example: 'KSFO' },
                    airportIata: { type: 'string', nullable: true, example: 'SFO' },
                    country: { type: 'string', nullable: true, example: 'US' },
                    region: { type: 'string', nullable: true, example: 'CA' },
                    lat: { type: 'number', format: 'float', nullable: true, example: 37.6188 },
                    lon: { type: 'number', format: 'float', nullable: true, example: -122.375 },
                    fatalities: { type: 'integer', nullable: true, example: 0 },
                    injuries: { type: 'integer', nullable: true, example: 2 },
                    summary: { type: 'string', nullable: true },
                    narrative: { type: 'string', nullable: true },
                    status: { type: 'string', nullable: true, example: 'preliminary' },
                    sources: { type: 'array', items: { $ref: '#/components/schemas/SourceAttribution' } },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
                required: ['id', 'dateZ', 'registration', 'category', 'sources', 'createdAt', 'updatedAt'],
            },
            ListEventsResponse: {
                type: 'object',
                properties: {
                    total: { type: 'integer', example: 120 },
                    data: { type: 'array', items: { $ref: '#/components/schemas/EventRecord' } },
                },
                required: ['total', 'data'],
            },
            AirportRecord: {
                type: 'object',
                properties: {
                    icao: { type: 'string', example: 'KSFO' },
                    iata: { type: 'string', nullable: true, example: 'SFO' },
                    name: { type: 'string', example: 'San Francisco International Airport' },
                    country: { type: 'string', example: 'US' },
                    region: { type: 'string', nullable: true, example: 'CA' },
                    lat: { type: 'number', format: 'float', example: 37.6188 },
                    lon: { type: 'number', format: 'float', example: -122.375 },
                },
                required: ['icao', 'name', 'country', 'lat', 'lon'],
            },
            FiltersOptions: {
                type: 'object',
                properties: {
                    countries: { type: 'array', items: { type: 'string' } },
                    regions: { type: 'array', items: { type: 'string' } },
                },
                required: ['countries', 'regions'],
            },
            HealthResponse: {
                type: 'object',
                properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    env: { type: 'string', example: 'development' },
                    ingestEnabled: { type: 'boolean', example: true },
                    ingestSchedule: { type: 'string', example: '0 */6 * * *' },
                    ingest: { type: 'object', nullable: true },
                },
                required: ['status'],
            },
        },
    },
    paths: {
        '/api/health': {
            get: {
                tags: ['Meta'],
                summary: 'Health probe for the API router',
                responses: {
                    200: {
                        description: 'Service is up',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/HealthResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/version': {
            get: {
                tags: ['Meta'],
                summary: 'Return API version',
                responses: {
                    200: {
                        description: 'Version info',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { version: { type: 'string', example: '0.1.0' } },
                                    required: ['version'],
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/events': {
            get: {
                tags: ['Events'],
                summary: 'List events with filters',
                parameters: [
                    { in: 'query', name: 'from', schema: { type: 'string', format: 'date-time' }, description: 'UTC lower bound' },
                    { in: 'query', name: 'to', schema: { type: 'string', format: 'date-time' }, description: 'UTC upper bound' },
                    { in: 'query', name: 'category', schema: { type: 'string', enum: ['general', 'commercial', 'unknown', 'all'] } },
                    { in: 'query', name: 'airport', schema: { type: 'string' }, description: 'ICAO or IATA code' },
                    { in: 'query', name: 'country', schema: { type: 'string' } },
                    { in: 'query', name: 'region', schema: { type: 'string' } },
                    { in: 'query', name: 'search', schema: { type: 'string' }, description: 'Full-text match' },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 200 }, default: 50 },
                    { in: 'query', name: 'offset', schema: { type: 'integer', minimum: 0 }, default: 0 },
                ],
                responses: {
                    200: {
                        description: 'Paginated events',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ListEventsResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/api/events/{id}': {
            get: {
                tags: ['Events'],
                summary: 'Get event by ID',
                parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
                responses: {
                    200: {
                        description: 'Event found',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/EventRecord' },
                            },
                        },
                    },
                    404: { description: 'Event not found' },
                },
            },
        },
        '/api/ingest/run': {
            post: {
                tags: ['Ingest'],
                summary: 'Manually trigger recent ingest',
                responses: {
                    200: {
                        description: 'Ingest executed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', example: 'ok' },
                                        result: { type: 'object' },
                                    },
                                    required: ['status'],
                                },
                            },
                        },
                    },
                    500: { description: 'Ingest failed' },
                },
            },
        },
        '/api/airports': {
            get: {
                tags: ['Geo'],
                summary: 'Search airports by ICAO/IATA/name/country/region',
                parameters: [
                    { in: 'query', name: 'search', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Matching airports',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/AirportRecord' } },
                            },
                        },
                    },
                },
            },
        },
        '/api/filters/options': {
            get: {
                tags: ['Geo'],
                summary: 'Retrieve filter option lists for countries and regions',
                responses: {
                    200: {
                        description: 'Filter values',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/FiltersOptions' },
                            },
                        },
                    },
                },
            },
        },
    },
};
const outPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist/openapi.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written to ${outPath}`);
