import { WebSocket } from 'ws';

export interface Subscriber {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastActivity: number;
}

export class SubscriberManager {
  private subscribers: Map<string, Subscriber> = new Map();
  private subscriptionGroups: Map<string, Set<string>> = new Map();

  constructor() {
    // Initialize subscription groups for different message types
    this.subscriptionGroups.set('FLIGHT_STATE', new Set());
    this.subscriptionGroups.set('PFD_UPDATE', new Set());
    this.subscriptionGroups.set('MFD_UPDATE', new Set());
    this.subscriptionGroups.set('NAV_UPDATE', new Set());
    this.subscriptionGroups.set('SYSTEM_STATUS', new Set());
  }

  public addSubscriber(id: string, ws: WebSocket): Subscriber {
    const subscriber: Subscriber = {
      id,
      ws,
      subscriptions: new Set(),
      lastActivity: Date.now(),
    };
    this.subscribers.set(id, subscriber);
    return subscriber;
  }

  public removeSubscriber(id: string): void {
    const subscriber = this.subscribers.get(id);
    if (subscriber) {
      // Remove from all subscription groups
      subscriber.subscriptions.forEach((messageType) => {
        const group = this.subscriptionGroups.get(messageType);
        if (group) {
          group.delete(id);
        }
      });
      this.subscribers.delete(id);
    }
  }

  public subscribe(subscriberId: string, messageType: string): boolean {
    const subscriber = this.subscribers.get(subscriberId);
    const group = this.subscriptionGroups.get(messageType);

    if (!subscriber || !group) {
      return false;
    }

    subscriber.subscriptions.add(messageType);
    group.add(subscriberId);
    subscriber.lastActivity = Date.now();
    return true;
  }

  public unsubscribe(subscriberId: string, messageType: string): boolean {
    const subscriber = this.subscribers.get(subscriberId);
    const group = this.subscriptionGroups.get(messageType);

    if (!subscriber || !group) {
      return false;
    }

    subscriber.subscriptions.delete(messageType);
    group.delete(subscriberId);
    subscriber.lastActivity = Date.now();
    return true;
  }

  public getSubscribersForMessageType(messageType: string): Subscriber[] {
    const group = this.subscriptionGroups.get(messageType);
    if (!group) {
      return [];
    }

    return Array.from(group)
      .map((id) => this.subscribers.get(id))
      .filter((subscriber): subscriber is Subscriber => subscriber !== undefined);
  }

  public getSubscriber(id: string): Subscriber | undefined {
    return this.subscribers.get(id);
  }

  public getAllSubscribers(): Subscriber[] {
    return Array.from(this.subscribers.values());
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }

  public updateActivity(subscriberId: string): void {
    const subscriber = this.subscribers.get(subscriberId);
    if (subscriber) {
      subscriber.lastActivity = Date.now();
    }
  }

  public cleanupInactiveSubscribers(maxInactiveMs: number): string[] {
    const now = Date.now();
    const removedIds: string[] = [];

    this.subscribers.forEach((subscriber, id) => {
      if (now - subscriber.lastActivity > maxInactiveMs) {
        this.removeSubscriber(id);
        removedIds.push(id);
      }
    });

    return removedIds;
  }
}
