import * as React from 'react';
import type { PaneConfig, TabReorderDirection, TabTheme } from '../types';
import { getRelativePaneId, isPaneCloseable } from '../state';
import { ensureMultiTabStyles } from '../styles';

export interface TabNavigationProps {
  panes: PaneConfig[];
  activeId?: string | null;
  onTabSelect?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onTabReorder?: (id: string, direction: TabReorderDirection) => void;
  showReorderControls?: boolean;
  theme?: TabTheme;
  useDefaultStyles?: boolean;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  panes,
  activeId,
  onTabSelect,
  onTabClose,
  onTabReorder,
  showReorderControls = true,
  theme = 'light',
  useDefaultStyles = true,
  className,
}) => {
  React.useEffect(() => {
    if (useDefaultStyles) {
      ensureMultiTabStyles();
    }
  }, [useDefaultStyles]);

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

  const handleReorder = (paneId: string, direction: TabReorderDirection) => {
    onTabReorder?.(paneId, direction);
  };

  const navClassName = ['aviation-tab-nav', className].filter(Boolean).join(' ');
  const showReorder = Boolean(onTabReorder) && showReorderControls;

  return (
    <nav
      className={navClassName}
      role="tablist"
      data-theme={theme}
      data-default-styles={useDefaultStyles ? 'true' : undefined}
    >
      {panes.map((pane) => {
        const isActive = pane.id === activeId;
        const canClose = isPaneCloseable(pane) && Boolean(onTabClose);
        const canMoveLeft = showReorder && index > 0;
        const canMoveRight = showReorder && index < panes.length - 1;
        const showActions = showReorder || canClose;
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
            {showActions ? (
              <span className="aviation-tab-actions">
                {showReorder ? (
                  <>
                    <button
                      type="button"
                      className="aviation-tab-control aviation-tab-move"
                      aria-label={`Move ${pane.title} left`}
                      disabled={!canMoveLeft}
                      onClick={() => handleReorder(pane.id, 'left')}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      className="aviation-tab-control aviation-tab-move"
                      aria-label={`Move ${pane.title} right`}
                      disabled={!canMoveRight}
                      onClick={() => handleReorder(pane.id, 'right')}
                    >
                      ▶
                    </button>
                  </>
                ) : null}
                {canClose ? (
                  <button
                    type="button"
                    className="aviation-tab-control aviation-tab-close"
                    aria-label={`Close ${pane.title}`}
                    onClick={() => onTabClose?.(pane.id)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
};
