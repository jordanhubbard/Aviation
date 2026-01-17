import * as React from 'react';
import type { PaneConfig, TabTheme } from '../types';
import { ensureMultiTabStyles } from '../styles';

export interface PaneContainerProps {
  activePane: PaneConfig | null;
  className?: string;
  emptyState?: React.ReactNode;
  theme?: TabTheme;
  useDefaultStyles?: boolean;
}

export const PaneContainer: React.FC<PaneContainerProps> = ({
  activePane,
  className,
  emptyState,
  theme = 'light',
  useDefaultStyles = true,
}) => {
  React.useEffect(() => {
    if (useDefaultStyles) {
      ensureMultiTabStyles();
    }
  }, [useDefaultStyles]);

  const containerClassName = ['aviation-pane-container', className].filter(Boolean).join(' ');
  const emptyClassName = ['aviation-pane-empty', className].filter(Boolean).join(' ');
  if (!activePane) {
    return (
      <div
        className={emptyClassName}
        data-theme={theme}
        data-default-styles={useDefaultStyles ? 'true' : undefined}
      >
        {emptyState ?? null}
      </div>
    );
  }

  const Component = activePane.component;
  return (
    <section
      className={containerClassName}
      role="tabpanel"
      data-theme={theme}
      data-default-styles={useDefaultStyles ? 'true' : undefined}
    >
      <Component />
    </section>
  );
};
