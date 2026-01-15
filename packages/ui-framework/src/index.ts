/**
 * Aviation UI Framework
 * Shared UI components and patterns for aviation applications
 */

// Map components and utilities
export * from './map';
// Multi-tab UI components
export * from './multi-tab';

/**
 * UI Modality Types
 */
export type UIModality = 'mobile' | 'web' | 'multi-tab' | 'embedded' | 'standalone';

/**
 * Base application UI interface
 */
export interface ApplicationUI {
  id: string;
  name: string;
  modality: UIModality;
  render(): void;
}


/**
 * Base class for mobile UIs
 */
export abstract class MobileUI implements ApplicationUI {
  public id: string;
  public name: string;
  public modality: UIModality = 'mobile';

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract render(): void;
}

/**
 * Base class for standalone web UIs
 */
export abstract class StandaloneWebUI implements ApplicationUI {
  public id: string;
  public name: string;
  public modality: UIModality = 'standalone';

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract render(): void;
}
