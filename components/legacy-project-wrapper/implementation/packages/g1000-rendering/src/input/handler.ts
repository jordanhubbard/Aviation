export interface InputEvent {
  type: 'key' | 'click' | 'wheel' | 'knob';
  key?: string;
  x?: number;
  y?: number;
  delta?: number;
}

export type InputCallback = (event: InputEvent) => void;

export class InputHandler {
  private callbacks: InputCallback[] = [];

  attach(_element: HTMLElement): void {
    // Attach DOM listeners and forward to callbacks
  }

  detach(): void {
    // Remove listeners
  }

  on(callback: InputCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== callback);
    };
  }
}
