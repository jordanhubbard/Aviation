// G1000Controls.tsx
// Component to simulate G1000 controls with mouse, keyboard, and touch interactions

import React, { useState, useEffect } from 'react';

const G1000Controls = () => {
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
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
      <div className="joystick" onMouseMove={(e) => setJoystickPosition({ x: e.clientX, y: e.clientY })}>
        Joystick: {`(${joystickPosition.x}, ${joystickPosition.y})`}
      </div>
      <button onMouseDown={handleButtonPress} className={buttonPressed ? 'pressed' : ''}>
        Button
      </button>
    </div>
  );
};

export default G1000Controls;
