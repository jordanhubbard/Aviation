import * as React from 'react';
import type { PaneConfig } from '../types';
import { getRelativePaneId, isPaneCloseable } from '../state';

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
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!onTabSelect) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextId = getRelativePaneId(panes, activeId ?? null, 1);
      if (nextId) onTabSelect(nextId);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prevId = getRelativePaneId(panes, activeId ?? null, -1);
      if (prevId) onTabSelect(prevId);
    } else if (event.key === 'Home') {
      event.preventDefault();
      if (panes[0]) onTabSelect(panes[0].id);
    } else if (event.key === 'End') {
      event.preventDefault();
      const lastPane = panes[panes.length - 1];
      if (lastPane) onTabSelect(lastPane.id);
    }
  };

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
              onKeyDown={handleKeyDown}
              tabIndex={isActive ? 0 : -1}
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
