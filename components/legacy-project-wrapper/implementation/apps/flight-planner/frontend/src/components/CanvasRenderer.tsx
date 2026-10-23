import React, { useRef, useEffect } from 'react';

const CanvasRenderer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Basic canvas rendering setup
    context.fillStyle = 'skyblue';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Example: Draw a simple aircraft shape
    context.fillStyle = 'white';
    context.beginPath();
    context.moveTo(50, 50);
    context.lineTo(70, 70);
    context.lineTo(50, 90);
    context.closePath();
    context.fill();
  }, []);

  return <canvas ref={canvasRef} width={800} height={600} />;
};

export default CanvasRenderer;
