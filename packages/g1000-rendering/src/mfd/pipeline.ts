import type { Viewport } from '../primitives';
import type { G1000Theme, G1000ThemeManager, G1000ThemeSource } from '../themes';
import { resolveG1000Theme } from '../themes';

export type MfdTelemetry = {
  position?: {
    latitude_deg: number;
    longitude_deg: number;
    ground_track_deg?: number;
    ground_speed_kt?: number;
    heading_deg?: number;
  };
  map?: {
    range_nm?: number;
    orientation?: 'north-up' | 'track-up' | 'heading-up';
  };
  terrain?: {
    enabled?: boolean;
    alert_level?: 'none' | 'caution' | 'warning';
  };
  weather?: {
    nexrad_enabled?: boolean;
    lightning_enabled?: boolean;
  };
  traffic?: {
    targets?: Array<{
      id: string;
      bearing_deg: number;
      range_nm: number;
      relative_altitude_ft: number;
    }>;
  };
  engine?: {
    rpm?: number;
    percent_power?: number;
    oil_temp_c?: number;
    oil_pressure_psi?: number;
    fuel_total_gal?: number;
  };
  timestamp?: number;
};

export type MfdFrame = {
  nowMs: number;
  deltaMs: number;
  viewport: Viewport;
  telemetry: MfdTelemetry;
  activePage: MfdPageId;
  theme: G1000Theme;
};

export type MfdPageId =
  | 'map'
  | 'terrain'
  | 'weather'
  | 'traffic'
  | 'engine'
  | 'utilities';

export type MfdLayerId =
  | 'base'
  | 'map'
  | 'terrain'
  | 'weather'
  | 'traffic'
  | 'engine'
  | 'overlays'
  | 'alerts'
  | 'text';

export type MfdLayer = {
  id: MfdLayerId;
  order: number;
  enabled?: boolean;
  render: (ctx: CanvasRenderingContext2D, frame: MfdFrame) => void;
};

export type MfdSceneGraph = {
  layers: MfdLayer[];
};

export type MfdPageDefinition = {
  id: MfdPageId;
  label?: string;
  sceneGraph: MfdSceneGraph;
};

export type MfdPageRegistry = Record<MfdPageId, MfdPageDefinition>;

export type MfdRenderLoopConfig = {
  targetHz: number;
  useRequestAnimationFrame: boolean;
  maxFrameSkipMs: number;
};

export type MfdPipelineOptions = {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  telemetry: MfdTelemetry;
  pages?: Partial<MfdPageRegistry>;
  initialPage?: MfdPageId;
  loop?: Partial<MfdRenderLoopConfig>;
  theme?: G1000ThemeSource;
  themeManager?: G1000ThemeManager;
  onFrameRendered?: (frame: MfdFrame) => void;
  onPageChanged?: (nextPage: MfdPageId, previousPage: MfdPageId) => void;
};

export type MfdPipeline = {
  start: () => void;
  stop: () => void;
  renderOnce: (nowMs?: number) => void;
  setTelemetry: (telemetry: MfdTelemetry) => void;
  setViewport: (viewport: Viewport) => void;
  setActivePage: (page: MfdPageId) => void;
  getActivePage: () => MfdPageId;
  setPageSceneGraph: (page: MfdPageId, sceneGraph: MfdSceneGraph) => void;
  getPageSceneGraph: (page: MfdPageId) => MfdSceneGraph;
  getPages: () => MfdPageRegistry;
  setTheme: (theme: G1000ThemeSource) => void;
  getTheme: () => G1000Theme;
};

export const DEFAULT_MFD_LAYER_ORDER: MfdLayerId[] = [
  'base',
  'map',
  'terrain',
  'weather',
  'traffic',
  'engine',
  'overlays',
  'alerts',
  'text',
];

export const DEFAULT_MFD_PAGES: MfdPageId[] = [
  'map',
  'terrain',
  'weather',
  'traffic',
  'engine',
  'utilities',
];

export const DEFAULT_MFD_LOOP_CONFIG: MfdRenderLoopConfig = {
  targetHz: 20,
  useRequestAnimationFrame: true,
  maxFrameSkipMs: 250,
};

const DEFAULT_MFD_PAGE: MfdPageId = 'map';

const createPlaceholderLayer = (id: MfdLayerId, order: number): MfdLayer => ({
  id,
  order,
  enabled: true,
  render: () => undefined,
});

export const createDefaultMfdSceneGraph = (): MfdSceneGraph => ({
  layers: DEFAULT_MFD_LAYER_ORDER.map((id, index) => createPlaceholderLayer(id, index)),
});

const createDefaultMfdPages = (): MfdPageRegistry =>
  DEFAULT_MFD_PAGES.reduce((pages, id) => {
    pages[id] = {
      id,
      label: id.toUpperCase(),
      sceneGraph: createDefaultMfdSceneGraph(),
    };
    return pages;
  }, {} as MfdPageRegistry);

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

const resolveLoopConfig = (loop?: Partial<MfdRenderLoopConfig>): MfdRenderLoopConfig => ({
  ...DEFAULT_MFD_LOOP_CONFIG,
  ...(loop ?? {}),
});

const resolvePageRegistry = (pages?: Partial<MfdPageRegistry>): MfdPageRegistry => ({
  ...createDefaultMfdPages(),
  ...(pages ?? {}),
});

const resolvePageId = (page: MfdPageId | undefined, pages: MfdPageRegistry): MfdPageId => {
  if (page && pages[page]) return page;
  if (pages[DEFAULT_MFD_PAGE]) return DEFAULT_MFD_PAGE;
  const firstPage = Object.keys(pages)[0] as MfdPageId | undefined;
  return firstPage ?? DEFAULT_MFD_PAGE;
};

const renderSceneGraph = (
  ctx: CanvasRenderingContext2D,
  frame: MfdFrame,
  sceneGraph: MfdSceneGraph
): void => {
  const layers = [...sceneGraph.layers]
    .filter((layer) => layer.enabled !== false)
    .sort((a, b) => a.order - b.order);
  layers.forEach((layer) => layer.render(ctx, frame));
};

export const createMfdPipeline = (options: MfdPipelineOptions): MfdPipeline => {
  let viewport = options.viewport;
  let telemetry = options.telemetry;
  let pages = resolvePageRegistry(options.pages);
  let activePage = resolvePageId(options.initialPage, pages);
  let theme: G1000Theme = resolveG1000Theme(options.theme ?? options.themeManager?.getTheme());
  const loopConfig = resolveLoopConfig(options.loop);
  const intervalMs = 1000 / loopConfig.targetHz;
  let lastFrameMs = 0;
  let running = false;
  let rafId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const fallbackSceneGraph = createDefaultMfdSceneGraph();
  const themeManager = options.themeManager;
  themeManager?.subscribe((nextTheme) => {
    theme = nextTheme;
  });
  if (themeManager && options.theme) {
    themeManager.setTheme(options.theme);
  }

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
    const frame: MfdFrame = {
      nowMs: currentMs,
      deltaMs,
      viewport,
      telemetry,
      activePage,
      theme,
    };
    const sceneGraph = pages[activePage]?.sceneGraph ?? fallbackSceneGraph;
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
    setActivePage: (nextPage) => {
      const resolvedPage = resolvePageId(nextPage, pages);
      if (resolvedPage === activePage) return;
      const previousPage = activePage;
      activePage = resolvedPage;
      options.onPageChanged?.(resolvedPage, previousPage);
    },
    getActivePage: () => activePage,
    setPageSceneGraph: (page, sceneGraph) => {
      const existingPage = pages[page];
      pages = {
        ...pages,
        [page]: {
          id: page,
          label: existingPage?.label ?? page.toUpperCase(),
          sceneGraph,
        },
      };
      activePage = resolvePageId(activePage, pages);
    },
    getPageSceneGraph: (page) => pages[page]?.sceneGraph ?? fallbackSceneGraph,
    getPages: () => pages,
    setTheme: (nextTheme: G1000ThemeSource) => {
      if (themeManager) {
        themeManager.setTheme(nextTheme);
        return;
      }
      theme = resolveG1000Theme(nextTheme);
    },
    getTheme: () => theme,
  };
};
