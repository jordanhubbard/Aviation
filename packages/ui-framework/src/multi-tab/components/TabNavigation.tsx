import * as React from 'react';
import type { PaneConfig } from '../types';
import { isPaneCloseable } from '../state';

export interface TabNavigationProps {
  panes: PaneConfig[];
  activeId?: string | null;
  onTabSelect?: (id: string) => void;
  onTabClose?: (id: string) => void;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  panes,
  activeId,
  onTabSelect,
  onTabClose,
  className,
}) => {
  return (
    <nav className={className || 'aviation-tab-nav'} role="tablist">
      {panes.map((pane) => {
        const isActive = pane.id === activeId;
        const canClose = isPaneCloseable(pane) && Boolean(onTabClose);
        return (
          <div
            key={pane.id}
            className={`aviation-tab ${isActive ? 'active' : ''}`}
            role="tab"
            aria-selected={isActive}
          >
            <button
              type="button"
              className="aviation-tab-button"
              onClick={() => onTabSelect?.(pane.id)}
            >
              {pane.icon ? <span className="aviation-tab-icon">{pane.icon}</span> : null}
              <span className="aviation-tab-title">{pane.title}</span>
            </button>
            {canClose ? (
              <button
                type="button"
                className="aviation-tab-close"
                aria-label={`Close ${pane.title}`}
                onClick={() => onTabClose?.(pane.id)}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
};
