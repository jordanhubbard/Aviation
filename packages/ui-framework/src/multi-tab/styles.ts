let stylesInjected = false;

const MULTI_TAB_STYLES = `
.aviation-tab-nav,
.aviation-pane-container,
.aviation-pane-empty {
  --aviation-tab-surface: #f8fafc;
  --aviation-tab-bg: #e2e8f0;
  --aviation-tab-active-bg: #ffffff;
  --aviation-tab-text: #1f2937;
  --aviation-tab-muted: #6b7280;
  --aviation-tab-accent: #4f46e5;
  --aviation-tab-border: #e2e8f0;
  --aviation-tab-hover: rgba(79, 70, 229, 0.12);
  --aviation-pane-bg: #ffffff;
  --aviation-pane-muted: #64748b;
  --aviation-pane-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

.aviation-tab-nav[data-theme='dark'],
.aviation-pane-container[data-theme='dark'],
.aviation-pane-empty[data-theme='dark'] {
  --aviation-tab-surface: #0f172a;
  --aviation-tab-bg: #1e293b;
  --aviation-tab-active-bg: #111827;
  --aviation-tab-text: #e2e8f0;
  --aviation-tab-muted: #94a3b8;
  --aviation-tab-accent: #60a5fa;
  --aviation-tab-border: #1f2937;
  --aviation-tab-hover: rgba(96, 165, 250, 0.2);
  --aviation-pane-bg: #111827;
  --aviation-pane-muted: #94a3b8;
  --aviation-pane-shadow: 0 10px 30px rgba(2, 6, 23, 0.4);
}

.aviation-tab-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  overflow-x: auto;
  background: var(--aviation-tab-surface);
  border-bottom: 1px solid var(--aviation-tab-border);
}

.aviation-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  background: var(--aviation-tab-bg);
  border: 1px solid transparent;
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.aviation-tab:hover {
  transform: translateY(-1px);
}

.aviation-tab.active {
  background: var(--aviation-tab-active-bg);
  border-color: var(--aviation-tab-accent);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
}

.aviation-tab-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--aviation-tab-text);
  cursor: pointer;
}

.aviation-tab-icon {
  font-size: 1.1rem;
}

.aviation-tab-title {
  white-space: nowrap;
}

.aviation-tab-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding-right: 0.5rem;
}

.aviation-tab-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--aviation-tab-muted);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.aviation-tab-control:hover {
  background: var(--aviation-tab-hover);
  color: var(--aviation-tab-text);
}

.aviation-tab-control:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.aviation-pane-container {
  background: var(--aviation-pane-bg);
  border-radius: 12px;
  box-shadow: var(--aviation-pane-shadow);
  padding: 1.5rem;
  animation: aviation-pane-fade 0.25s ease;
}

.aviation-pane-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--aviation-pane-muted);
}

@keyframes aviation-pane-fade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .aviation-tab-nav {
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
  }

  .aviation-tab-button {
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
  }

  .aviation-tab-actions {
    padding-right: 0.35rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .aviation-tab,
  .aviation-tab-control,
  .aviation-pane-container {
    transition: none;
    animation: none;
  }
}
`;

export const ensureMultiTabStyles = (): void => {
  if (stylesInjected || typeof document === 'undefined') {
    return;
  }
  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-aviation-ui', 'multi-tab');
  styleTag.textContent = MULTI_TAB_STYLES;
  document.head.appendChild(styleTag);
  stylesInjected = true;
};
