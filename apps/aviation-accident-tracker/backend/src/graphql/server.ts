/**
 * Apollo GraphQL Server Setup
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import { EventRepository } from '../db/repository';
import { resolvers, GraphQLContext } from './resolvers';
import type { Express } from 'express';
import type { Server as HTTPServer } from 'http';
import DataLoader from 'dataloader';

/**
 * Load GraphQL schema from file
 */
function loadSchema(): string {
  return readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');
}

/**
 * Create DataLoaders for batch loading
 */
function createLoaders(repository: EventRepository) {
  // Batch load events by IDs
  const eventLoader = new DataLoader(async (ids: readonly number[]) => {
    const events = await Promise.all(
      ids.map(id => repository.getEventDetail(id).catch(() => null))
    );
    return events;
  });

  // Batch load event sources
  const sourcesLoader = new DataLoader(async (eventIds: readonly number[]) => {
    const sources = await Promise.all(
      eventIds.map(async (id) => {
        try {
          const event = await repository.getEventDetail(id);
          return event.sources || [];
        } catch {
          return [];
        }
      })
    );
    return sources;
  });

  return {
    eventLoader,
    sourcesLoader,
  };
}

/**
 * Create Apollo Server
 */
export async function createGraphQLServer(
  app: Express,
  httpServer: HTTPServer,
  repository: EventRepository
) {
  // Create executable schema
  const typeDefs = loadSchema();
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Set up subscription handling
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        return {
          repository,
          isAdmin: false, // Would check auth from connection params
        };
      },
    },
    wsServer
  );

  // Create Apollo Server with plugins
  const server = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      // Proper shutdown for HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      
      // Proper shutdown for WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
      
      // Custom plugin for logging
      {
        async requestDidStart() {
          return {
            async didEncounterErrors(requestContext) {
              console.error('GraphQL Errors:', requestContext.errors);
            },
          };
        },
      },
    ],
    
    // Query complexity limiting
    validationRules: [
      createComplexityLimitRule(1000, {
        scalarCost: 1,
        objectCost: 2,
        listFactor: 10,
        onCost: (cost: number) => {
          console.log(`GraphQL query cost: ${cost}`);
        },
      }),
    ],
    
    // Introspection and playground enabled in development
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  // Add GraphQL middleware to Express
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }: any) => {
        // Check authentication
        const apiKey = req.headers['x-api-key'] as string;
        const authHeader = req.headers['authorization'] as string;
        const adminToken = authHeader?.replace('Bearer ', '');
        
        const isAdmin = adminToken === (process.env.ADMIN_TOKEN || 'admin-secret-token');

        // Create context with loaders
        const loaders = createLoaders(repository);

        return {
          repository,
          apiKey,
          isAdmin,
          loaders,
        } as GraphQLContext & { loaders: ReturnType<typeof createLoaders> };
      },
    })
  );

  console.log('✅ GraphQL server ready at /graphql');
  console.log('✅ GraphQL subscriptions ready at ws://localhost:3002/graphql');

  return server;
}

/**
 * Example GraphQL queries for testing
 */
export const exampleQueries = {
  // Get health status
  health: `
    query Health {
      health {
        status
        timestamp
        version
        uptime
        database {
          connected
          totalEvents
        }
      }
    }
  `,

  // List recent events
  recentEvents: `
    query RecentEvents($first: Int = 10) {
      events(first: $first, sort: { field: DATE, direction: DESC }) {
        edges {
          node {
            id
            date
            category
            summary
            location
            aircraftType
            operator
            fatalities
            injuries
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  `,

  // Get single event with details
  eventDetail: `
    query EventDetail($id: ID!) {
      event(id: $id) {
        id
        date
        category
        summary
        description
        location
        country
        region
        airportIcao
        airportIata
        aircraftType
        registration
        operator
        phaseOfFlight
        fatalities
        injuries
        totalOnBoard
        weather
        cause
        sources {
          type
          url
          title
        }
        createdAt
        updatedAt
      }
    }
  `,

  // Get statistics
  statistics: `
    query Statistics($filter: EventFilter) {
      statistics(filter: $filter) {
        total
        byCategory {
          category
          count
          fatalities
          injuries
        }
        byCountry {
          country
          count
          fatalities
          injuries
        }
        period {
          from
          to
        }
      }
    }
  `,

  // Search events
  searchEvents: `
    query SearchEvents($query: String!, $limit: Int = 20) {
      searchEvents(query: $query, limit: $limit) {
        id
        date
        category
        summary
        location
        aircraftType
        operator
      }
    }
  `,

  // Subscribe to new events
  subscribeToEvents: `
    subscription OnEventAdded {
      eventAdded {
        id
        date
        category
        summary
        location
      }
    }
  `,

  // Trigger ingestion (admin only)
  triggerIngestion: `
    mutation TriggerIngestion($source: IngestionSource!) {
      triggerIngestion(source: $source) {
        success
        eventsIngested
        startedAt
        completedAt
        errors
      }
    }
  `,
};
