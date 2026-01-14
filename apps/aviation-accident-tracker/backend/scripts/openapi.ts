import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aviation Accident Tracker API',
      version: '0.1.0',
      description: 'API for accidents/incidents ingestion and retrieval',
    },
  },
  apis: [path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/api/routes.ts')],
};

const spec = swaggerJsdoc(options);
const outPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist/openapi.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written to ${outPath}`);
