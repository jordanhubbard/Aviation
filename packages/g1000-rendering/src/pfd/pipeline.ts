import type { Viewport } from '../primitives';

export type PfdTelemetry = {
  attitude: {
    heading_deg: number;
    pitch_deg: number;
    roll_deg: number;
    slip_skid_deg?: number;
  };
  adc: {
    ias_kt: number;
    tas_kt: number;
    pressure_altitude_ft: number;
    vertical_speed_fpm: number;
  };
  gps: {
    ground_speed_kt: number;
    track_deg: number;
  };
  targets?: {
    heading_deg?: number;
    airspeed_kt?: number;
    altitude_ft?: number;
  };
  autopilot?: {
    master_on: boolean;
    lateral_mode: string;
    vertical_mode: string;
  };
  nav?: {
    source?: string;
    course_deg?: number;
    deviation_dots?: number;
    to_from?: 'to' | 'from';
  };
  timestamp?: number;
};

export type PfdFrame = {
  nowMs: number;
  deltaMs: number;
  viewport: Viewport;
  telemetry: PfdTelemetry;
};

export type PfdLayerId =
  | 'background'
  | 'attitude'
  | 'tapes'
  | 'hsi'
  | 'nav'
  | 'autopilot'
  | 'overlays'
  | 'alerts'
  | 'text';

export type PfdLayer = {
  id: PfdLayerId;
  order: number;
  enabled?: boolean;
  render: (ctx: CanvasRenderingContext2D, frame: PfdFrame) => void;
};

export type PfdSceneGraph = {
  layers: PfdLayer[];
};

export type PfdRenderLoopConfig = {
  targetHz: number;
  useRequestAnimationFrame: boolean;
  maxFrameSkipMs: number;
};

export type PfdPipelineOptions = {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  telemetry: PfdTelemetry;
  sceneGraph?: PfdSceneGraph;
  loop?: Partial<PfdRenderLoopConfig>;
  onFrameRendered?: (frame: PfdFrame) => void;
};

export type PfdPipeline = {
  start: () => void;
  stop: () => void;
  renderOnce: (nowMs?: number) => void;
  setTelemetry: (telemetry: PfdTelemetry) => void;
  setViewport: (viewport: Viewport) => void;
  setSceneGraph: (sceneGraph: PfdSceneGraph) => void;
  getSceneGraph: () => PfdSceneGraph;
};

export const DEFAULT_PFD_LAYER_ORDER: PfdLayerId[] = [
  'background',
  'attitude',
  'tapes',
  'hsi',
  'nav',
  'autopilot',
  'overlays',
  'alerts',
  'text',
];

export const DEFAULT_PFD_LOOP_CONFIG: PfdRenderLoopConfig = {
  targetHz: 20,
  useRequestAnimationFrame: true,
  maxFrameSkipMs: 250,
};

const createPlaceholderLayer = (id: PfdLayerId, order: number): PfdLayer => ({
  id,
  order,
  enabled: true,
  render: () => undefined,
});

export const createDefaultPfdSceneGraph = (): PfdSceneGraph => ({
  layers: DEFAULT_PFD_LAYER_ORDER.map((id, index) => createPlaceholderLayer(id, index)),
});

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const resolveLoopConfig = (loop?: Partial<PfdRenderLoopConfig>): PfdRenderLoopConfig => ({
  ...DEFAULT_PFD_LOOP_CONFIG,
  ...(loop ?? {}),
});

const renderSceneGraph = (
  ctx: CanvasRenderingContext2D,
  frame: PfdFrame,
  sceneGraph: PfdSceneGraph
): void => {
  const layers = [...sceneGraph.layers]
    .filter((layer) => layer.enabled !== false)
    .sort((a, b) => a.order - b.order);
  layers.forEach((layer) => layer.render(ctx, frame));
};

export const createPfdPipeline = (options: PfdPipelineOptions): PfdPipeline => {
  let viewport = options.viewport;
  let telemetry = options.telemetry;
  let sceneGraph = options.sceneGraph ?? createDefaultPfdSceneGraph();
  const loopConfig = resolveLoopConfig(options.loop);
  const intervalMs = 1000 / loopConfig.targetHz;
  let lastFrameMs = 0;
  let running = false;
  let rafId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = () => {
    if (!running) return;
    if (loopConfig.useRequestAnimationFrame && typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(renderLoop);
      return;
    }
    timerId = setTimeout(() => renderLoop(nowMs()), intervalMs);
  };

  const renderLoop = (timestampMs: number) => {
    if (!running) return;
    const currentMs = Number.isFinite(timestampMs) ? timestampMs : nowMs();
    const deltaMs = lastFrameMs === 0 ? intervalMs : currentMs - lastFrameMs;
    if (deltaMs < intervalMs) {
      scheduleNext();
      return;
    }
    if (deltaMs > loopConfig.maxFrameSkipMs) {
      lastFrameMs = currentMs - intervalMs;
    } else {
      lastFrameMs = currentMs;
    }
    const frame: PfdFrame = {
      nowMs: currentMs,
      deltaMs,
      viewport,
      telemetry,
    };
    options.ctx.clearRect(viewport.x, viewport.y, viewport.width, viewport.height);
    renderSceneGraph(options.ctx, frame, sceneGraph);
    options.onFrameRendered?.(frame);
    scheduleNext();
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      lastFrameMs = 0;
      scheduleNext();
    },
    stop: () => {
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
    renderOnce: (timestampMs?: number) => {
      renderLoop(timestampMs ?? nowMs());
    },
    setTelemetry: (nextTelemetry) => {
      telemetry = nextTelemetry;
    },
    setViewport: (nextViewport) => {
      viewport = nextViewport;
    },
    setSceneGraph: (nextSceneGraph) => {
      sceneGraph = nextSceneGraph;
    },
    getSceneGraph: () => sceneGraph,
  };
};
