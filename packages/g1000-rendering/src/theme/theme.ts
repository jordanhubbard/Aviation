import type { G1000Theme, G1000ThemeSource, G1000ThemeManager } from '../themes';
import { resolveG1000Theme } from '../themes';

export type CanvasTheme = G1000Theme;

export class ThemeManager implements G1000ThemeManager {
  private current: G1000Theme;
  private listeners: Array<(theme: G1000Theme) => void> = [];

  constructor(initial?: G1000ThemeSource) {
    this.current = resolveG1000Theme(initial ?? 'day');
  }

  subscribe(callback: (theme: G1000Theme) => void): () => void {
    this.listeners.push(callback);
    callback(this.current);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  setTheme(source: G1000ThemeSource): void {
    this.current = resolveG1000Theme(source);
    this.listeners.forEach((l) => l(this.current));
  }

  getTheme(): G1000Theme {
    return this.current;
  }
}
