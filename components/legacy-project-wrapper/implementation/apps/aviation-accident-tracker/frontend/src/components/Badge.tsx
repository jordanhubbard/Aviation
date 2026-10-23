import React from 'react';

export function Badge({ children, color = '#e0e0e0', border = '#bdbdbd' }: { children: React.ReactNode; color?: string; border?: string }) {
  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: color,
        border: `1px solid ${border}`,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}
