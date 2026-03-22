// Utility to capture FPS and frame-time traces
export function startPerformanceProfiling() {
  const performanceData: { fps: number[]; frameTimes: number[] } = {
    fps: [],
    frameTimes: [],
  };

  let lastFrameTime = performance.now();
  let frameCount = 0;

  function update() {
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    frameCount++;

    if (delta >= 1000) {
      const fps = frameCount;
      performanceData.fps.push(fps);
      performanceData.frameTimes.push(delta / frameCount);
      frameCount = 0;
    }

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);

  return performanceData;
}
