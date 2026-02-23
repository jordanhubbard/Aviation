// G1000Controls.tsx
// Component to simulate G1000 controls with mouse, keyboard, and touch interactions

import React, { useState } from 'react';

const G1000Controls = () => {
  const [knobValue, setKnobValue] = useState(0);
  const [buttonPressed, setButtonPressed] = useState(false);

  const handleKnobTurn = (direction: 'left' | 'right') => {
    setKnobValue(prev => direction === 'left' ? prev - 1 : prev + 1);
  };

  const handleButtonPress = () => {
    setButtonPressed(true);
    setTimeout(() => setButtonPressed(false), 200); // Debounce
  };

  return (
    <div className="g1000-controls">
      <div className="knob" onClick={() => handleKnobTurn('right')} onContextMenu={(e) => { e.preventDefault(); handleKnobTurn('left'); }}>
        Knob: {knobValue}
      </div>
      <button onMouseDown={handleButtonPress} className={buttonPressed ? 'pressed' : ''}>
        Button
      </button>
    </div>
  );
};

export default G1000Controls;
