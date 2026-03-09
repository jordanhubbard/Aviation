import React, { useEffect } from 'react';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
}

const shortcuts: Shortcut[] = [
  { key: 'Alt+1', description: 'Navigate to Flight Planner', action: () => window.location.href = '/' },
  { key: 'Alt+2', description: 'Navigate to Weather', action: () => window.location.href = '/weather' },
  { key: 'Alt+3', description: 'Navigate to Airports', action: () => window.location.href = '/airports' },
  // Add more shortcuts here for G1000 controls
];

const KeyboardShortcuts: React.FC = () => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        if (event.altKey && event.key === shortcut.key.split('+')[1]) {
          shortcut.action();
          event.preventDefault();
        }
      });
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return null;
};

export default KeyboardShortcuts;
