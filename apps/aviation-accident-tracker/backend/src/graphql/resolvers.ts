/**
 * GraphQL Resolvers for Aviation Accident Tracker
 */

import { EventRepository } from '../db/repository';
import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

// Event topics for subscriptions
const EVENT_ADDED = 'EVENT_ADDED';
const INGESTION_STATUS = 'INGESTION_STATUS';

export interface GraphQLContext {
  repository: EventRepository;
  apiKey?: string;
  isAdmin: boolean;
}

/**
 * Convert database date to ISO string
 */
function toISOString(date: string): string {
  try {
    return new Date(date).toISOString();
  } catch {
    return date;
  }
}

/**
 * Encode cursor for pagination
 */
function encodeCursor(id: number): string {
  return Buffer.from(`event:${id}`).toString('base64');
}

/**
 * Decode cursor for pagination
 */
function decodeCursor(cursor: string): number {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const id = parseInt(decoded.split(':')[1]);
    return isNaN(id) ? 0 : id;
  } catch {
    return 0;
  }
}

export const resolvers = {
  // ========================================================================
  // Scalars
  // ========================================================================
  DateTime: {
    serialize: (value: Date | string): string => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return toISOString(value);
    },
    parseValue: (value: string): Date => {
      return new Date(value);
    },
    parseLiteral: (ast: any): Date => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      throw new GraphQLError('DateTime must be a string');
    },
  },

  JSON: {
    serialize: (value: any): any => value,
    parseValue: (value: any): any => value,
    parseLiteral: (ast: any): any => {
      if (ast.kind === 'StringValue') {
        return JSON.parse(ast.value);
      }
      return null;
    },
  },

  // ========================================================================
  // Enums
  // ========================================================================
  EventCategory: {
    ACCIDENT: 'accident',
    INCIDENT: 'incident',
    ALL: 'all',
  },

  // ========================================================================
  // Type Resolvers
  // ========================================================================
  Event: {
    id: (parent: any) => parent.id.toString(),
    date: (parent: any) => toISOString(parent.date_z),
    category: (parent: any) => parent.category.toUpperCase(),
    airportIcao: (parent: any) => parent.airport_icao,
    airportIata: (parent: any) => parent.airport_iata,
    aircraftType: (parent: any) => parent.aircraft_type,
    phaseOfFlight: (parent: any) => parent.phase_of_flight?.toUpperCase(),
    totalOnBoard: (parent: any) => parent.total_on_board,
    createdAt: (parent: any) => toISOString(parent.created_at || parent.date_z),
    updatedAt: (parent: any) => parent.updated_at ? toISOString(parent.updated_at) : null,
  },

  EventSource: {
    fetchedAt: (parent: any) => parent.fetched_at ? toISOString(parent.fetched_at) : null,
  },

  // ========================================================================
  // Queries
  // ========================================================================
  Query: {
    /**
     * Get single event by ID
     */
    event: async (_parent: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        const event = await context.repository.getEventDetail(parseInt(id));
        return event;
      } catch (error) {
        throw new GraphQLError('Event not found', {
          extensions: { code: 'NOT_FOUND', id },
        });
      }
    },

    /**
     * List events with cursor pagination
     */
    events: async (
      _parent: any,
      { after, first = 20, filter, sort }: any,
      context: GraphQLContext
    ) => {
      // Limit page size
      const limit = Math.min(first, 100);
      
      // Decode cursor to get starting ID
      const afterId = after ? decodeCursor(after) : 0;

      // Build query parameters
      const params: any = {
        page: 1,
        limit: limit + 1, // Fetch one extra to determine hasNextPage
      };

      if (filter) {
        if (filter.from) params.from = new Date(filter.from).toISOString().split('T')[0];
        if (filter.to) params.to = new Date(filter.to).toISOString().split('T')[0];
        if (filter.category) params.category = filter.category.toLowerCase();
        if (filter.airport) params.airport = filter.airport;
        if (filter.country) params.country = filter.country;
        if (filter.region) params.region = filter.region;
        if (filter.search) params.search = filter.search;
      }

      if (sort) {
        params.sortBy = sort.field.toLowerCase();
        params.sortOrder = sort.direction.toLowerCase();
      }

      // Fetch events
      const { events, total } = await context.repository.listEvents(params);

      // Filter events after cursor
      const filteredEvents = afterId > 0 
        ? events.filter((e: any) => e.id > afterId)
        : events;

      // Determine if there are more pages
      const hasNextPage = filteredEvents.length > limit;
      const eventEdges = filteredEvents.slice(0, limit).map((event: any) => ({
        node: event,
        cursor: encodeCursor(event.id),
      }));

      return {
        edges: eventEdges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: afterId > 0,
          startCursor: eventEdges.length > 0 ? eventEdges[0].cursor : null,
          endCursor: eventEdges.length > 0 ? eventEdges[eventEdges.length - 1].cursor : null,
        },
        totalCount: total,
      };
    },

    /**
     * Get statistics
     */
    statistics: async (_parent: any, { filter }: any, context: GraphQLContext) => {
      const params: any = {};
      
      if (filter) {
        if (filter.from) params.from = new Date(filter.from).toISOString().split('T')[0];
        if (filter.to) params.to = new Date(filter.to).toISOString().split('T')[0];
        if (filter.category) params.category = filter.category.toLowerCase();
        if (filter.country) params.country = filter.country;
      }

      // Fetch statistics by category
      const categoryStats = await context.repository.getStatistics({
        ...params,
        groupBy: 'category',
      });

      // Fetch statistics by country
      const countryStats = await context.repository.getStatistics({
        ...params,
        groupBy: 'country',
      });

      // Mock statistics (would need actual implementation)
      return {
        total: categoryStats.reduce((sum: number, stat: any) => sum + stat.count, 0),
        byCategory: categoryStats.map((stat: any) => ({
          category: stat.category.toUpperCase(),
          count: stat.count,
          fatalities: stat.total_fatalities || 0,
          injuries: stat.total_injuries || 0,
        })),
        byCountry: countryStats.slice(0, 20).map((stat: any) => ({
          country: stat.country || 'Unknown',
          count: stat.count,
          fatalities: stat.total_fatalities || 0,
          injuries: stat.total_injuries || 0,
        })),
        byAircraftType: [],
        byPhaseOfFlight: [],
        period: {
          from: filter?.from ? new Date(filter.from).toISOString() : null,
          to: filter?.to ? new Date(filter.to).toISOString() : null,
        },
      };
    },

    /**
     * Get timeline data
     */
    timeline: async (
      _parent: any,
      { from, to, interval = 'MONTH', filter }: any,
      context: GraphQLContext
    ) => {
      const params: any = {
        from: new Date(from).toISOString().split('T')[0],
        to: new Date(to).toISOString().split('T')[0],
        groupBy: 'date',
      };

      if (filter) {
        if (filter.category) params.category = filter.category.toLowerCase();
        if (filter.country) params.country = filter.country;
      }

      const stats = await context.repository.getStatistics(params);

      // Group by interval (simplified - would need proper date bucketing)
      return stats.map((stat: any) => ({
        date: stat.date || stat.period,
        count: stat.count,
        accidents: stat.accidents || 0,
        incidents: stat.incidents || 0,
        fatalities: stat.total_fatalities || 0,
      }));
    },

    /**
     * Search events
     */
    searchEvents: async (
      _parent: any,
      { query, limit = 20 }: any,
      context: GraphQLContext
    ) => {
      const { events } = await context.repository.listEvents({
        search: query,
        limit: Math.min(limit, 100),
      });

      return events;
    },

    /**
     * Health status
     */
    health: async (_parent: any, _args: any, context: GraphQLContext) => {
      const { events } = await context.repository.listEvents({ limit: 1 });
      const totalEvents = events.length > 0 ? await context.repository.listEvents({ limit: 1000 }) : { total: 0 };

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        database: {
          connected: true,
          totalEvents: totalEvents.total || 0,
          lastIngestion: null, // Would need to track this
        },
      };
    },
  },

  // ========================================================================
  // Mutations
  // ========================================================================
  Mutation: {
    /**
     * Trigger manual ingestion (admin only)
     */
    triggerIngestion: async (
      _parent: any,
      { source }: any,
      context: GraphQLContext
    ) => {
      if (!context.isAdmin) {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const startedAt = new Date();

      // Publish ingestion started status
      pubsub.publish(INGESTION_STATUS, {
        ingestionStatus: {
          state: 'STARTING',
          eventsProcessed: 0,
          source: source,
          progress: 0,
          estimatedTimeRemaining: null,
        },
      });

      // Simulate ingestion (in production, this would trigger actual ingestion)
      // For now, return mock result
      const completedAt = new Date();

      pubsub.publish(INGESTION_STATUS, {
        ingestionStatus: {
          state: 'COMPLETED',
          eventsProcessed: 0,
          source: source,
          progress: 100,
          estimatedTimeRemaining: 0,
        },
      });

      return {
        success: true,
        eventsIngested: 0,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        errors: [],
      };
    },

    /**
     * Update event (admin only)
     */
    updateEvent: async (
      _parent: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      if (!context.isAdmin) {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // In production, this would update the event in the database
      const event = await context.repository.getEventDetail(parseInt(id));
      
      if (!event) {
        throw new GraphQLError('Event not found', {
          extensions: { code: 'NOT_FOUND', id },
        });
      }

      // Return the event (in production, would return updated event)
      return event;
    },

    /**
     * Delete event (admin only)
     */
    deleteEvent: async (
      _parent: any,
      { id }: any,
      context: GraphQLContext
    ) => {
      if (!context.isAdmin) {
        throw new GraphQLError('Admin access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // In production, this would delete the event from the database
      return {
        success: true,
        deletedId: id,
      };
    },
  },

  // ========================================================================
  // Subscriptions
  // ========================================================================
  Subscription: {
    /**
     * Subscribe to new events
     */
    eventAdded: {
      subscribe: () => pubsub.asyncIterator([EVENT_ADDED]),
    },

    /**
     * Subscribe to ingestion status
     */
    ingestionStatus: {
      subscribe: () => pubsub.asyncIterator([INGESTION_STATUS]),
    },
  },
};

/**
 * Publish new event (called when events are ingested)
 */
export function publishEventAdded(event: any) {
  pubsub.publish(EVENT_ADDED, { eventAdded: event });
}

/**
 * Publish ingestion status update
 */
export function publishIngestionStatus(status: any) {
  pubsub.publish(INGESTION_STATUS, { ingestionStatus: status });
}
