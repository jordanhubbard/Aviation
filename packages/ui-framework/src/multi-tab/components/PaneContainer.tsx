import * as React from 'react';
import type { PaneConfig } from '../types';

export interface PaneContainerProps {
  activePane: PaneConfig | null;
  className?: string;
  emptyState?: React.ReactNode;
}

export const PaneContainer: React.FC<PaneContainerProps> = ({
  activePane,
  className,
  emptyState,
}) => {
  if (!activePane) {
    return <div className={className || 'aviation-pane-empty'}>{emptyState ?? null}</div>;
  }

  const Component = activePane.component;
  return (
    <section className={className || 'aviation-pane-container'} role="tabpanel">
      <Component />
    </section>
  );
};
