import type { Viewport } from '../primitives';
import type { G1000Theme } from '../themes';
import { DEFAULT_TEXT_OPTIONS, drawText } from '../primitives';
import type { MfdFrame, MfdLayer, MfdSceneGraph } from './pipeline';

export type MfdEngineGaugeDefinition = {
  id: string;
  label: string;
  unit?: string;
  precision?: number;
  value?: (frame: MfdFrame) => number | string | null | undefined;
};

export type MfdEngineLayoutConfig = {
  headerRatio: number;
  footerRatio: number;
  sectionGapRatio: number;
  paddingRatio: number;
  columnGapRatio: number;
  rowGapRatio: number;
  columns: number;
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  valueColor: string;
  headerColor: string;
  headerFont: string;
  labelFont: string;
  valueFont: string;
  theme?: G1000Theme;
  gauges?: MfdEngineGaugeDefinition[];
  footerText?: (frame: MfdFrame) => string;
};

export type MfdEngineLayoutMetrics = {
  header: Viewport;
  content: Viewport;
  grid: Viewport[];
  footer: Viewport;
};

export type MfdUtilitiesSection = {
  id: string;
  label: string;
  render?: (ctx: CanvasRenderingContext2D, frame: MfdFrame, viewport: Viewport) => void;
};

export type MfdUtilitiesLayoutConfig = {
  headerRatio: number;
  footerRatio: number;
  sectionGapRatio: number;
  paddingRatio: number;
  columnGapRatio: number;
  rowGapRatio: number;
  columns: number;
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  headerColor: string;
  headerFont: string;
  sectionFont: string;
  footerFont: string;
  theme?: G1000Theme;
  sections?: MfdUtilitiesSection[];
  footerText?: (frame: MfdFrame) => string;
};

export type MfdUtilitiesLayoutMetrics = {
  header: Viewport;
  content: Viewport;
  grid: Viewport[];
  footer: Viewport;
};

const DEFAULT_MFD_ENGINE_GAUGES: MfdEngineGaugeDefinition[] = [
  {
    id: 'rpm',
    label: 'RPM',
    value: (frame) => frame.telemetry.engine?.rpm,
  },
  {
    id: 'power',
    label: '% POWER',
    unit: '%',
    value: (frame) => frame.telemetry.engine?.percent_power,
  },
  {
    id: 'oil-temp',
    label: 'OIL TEMP',
    unit: '°C',
    value: (frame) => frame.telemetry.engine?.oil_temp_c,
  },
  {
    id: 'oil-pressure',
    label: 'OIL PRES',
    unit: 'PSI',
    value: (frame) => frame.telemetry.engine?.oil_pressure_psi,
  },
  {
    id: 'fuel-total',
    label: 'FUEL QTY',
    unit: 'GAL',
    precision: 1,
    value: (frame) => frame.telemetry.engine?.fuel_total_gal,
  },
  {
    id: 'egs-placeholder',
    label: 'EGT/CHT',
    value: () => '--',
  },
];

const DEFAULT_MFD_ENGINE_LAYOUT_CONFIG: MfdEngineLayoutConfig = {
  headerRatio: 0.12,
  footerRatio: 0.1,
  sectionGapRatio: 0.04,
  paddingRatio: 0.04,
  columnGapRatio: 0.05,
  rowGapRatio: 0.06,
  columns: 2,
  backgroundColor: '#0b1218',
  borderColor: '#1f2b36',
  labelColor: '#9fb3c8',
  valueColor: '#e6edf3',
  headerColor: '#e6edf3',
  headerFont: '16px "Fira Sans", sans-serif',
  labelFont: '11px "Fira Sans", sans-serif',
  valueFont: '18px "Fira Sans", sans-serif',
  gauges: DEFAULT_MFD_ENGINE_GAUGES,
  footerText: () => 'Lean Assist: OFF',
};

const DEFAULT_MFD_UTILITIES_SECTIONS: MfdUtilitiesSection[] = [
  { id: 'trip', label: 'Trip Planning' },
  { id: 'fuel', label: 'Fuel Calculator' },
  { id: 'timers', label: 'Timers' },
  { id: 'checklists', label: 'Checklists' },
];

const DEFAULT_MFD_UTILITIES_LAYOUT_CONFIG: MfdUtilitiesLayoutConfig = {
  headerRatio: 0.12,
  footerRatio: 0.08,
  sectionGapRatio: 0.05,
  paddingRatio: 0.04,
  columnGapRatio: 0.04,
  rowGapRatio: 0.05,
  columns: 2,
  backgroundColor: '#0b1218',
  borderColor: '#1f2b36',
  labelColor: '#9fb3c8',
  headerColor: '#e6edf3',
  headerFont: '16px "Fira Sans", sans-serif',
  sectionFont: '12px "Fira Sans", sans-serif',
  footerFont: '11px "Fira Sans", sans-serif',
  sections: DEFAULT_MFD_UTILITIES_SECTIONS,
  footerText: () => 'Utilities ready',
};

const resolveEngineConfig = (
  config?: Partial<MfdEngineLayoutConfig>
): MfdEngineLayoutConfig => {
  const theme = config?.theme;
  const themeDefaults = theme
    ? {
        backgroundColor: theme.palette.background,
        borderColor: theme.palette.border,
        labelColor: theme.palette.textSecondary,
        valueColor: theme.palette.textPrimary,
        headerColor: theme.palette.textPrimary,
        headerFont: theme.typography.large,
        labelFont: theme.typography.small,
        valueFont: theme.typography.title,
      }
    : {};

  return {
    ...DEFAULT_MFD_ENGINE_LAYOUT_CONFIG,
    ...themeDefaults,
    ...(config ?? {}),
    gauges: config?.gauges ?? DEFAULT_MFD_ENGINE_GAUGES,
  };
};

const resolveUtilitiesConfig = (
  config?: Partial<MfdUtilitiesLayoutConfig>
): MfdUtilitiesLayoutConfig => {
  const theme = config?.theme;
  const themeDefaults = theme
    ? {
        backgroundColor: theme.palette.background,
        borderColor: theme.palette.border,
        labelColor: theme.palette.textSecondary,
        headerColor: theme.palette.textPrimary,
        headerFont: theme.typography.large,
        sectionFont: theme.typography.medium,
        footerFont: theme.typography.small,
      }
    : {};

  return {
    ...DEFAULT_MFD_UTILITIES_LAYOUT_CONFIG,
    ...themeDefaults,
    ...(config ?? {}),
    sections: config?.sections ?? DEFAULT_MFD_UTILITIES_SECTIONS,
  };
};

const computeGrid = (
  viewport: Viewport,
  columns: number,
  rows: number,
  columnGap: number,
  rowGap: number
): Viewport[] => {
  if (columns <= 0 || rows <= 0) return [];
  const cellWidth = (viewport.width - columnGap * (columns - 1)) / columns;
  const cellHeight = (viewport.height - rowGap * (rows - 1)) / rows;
  const cells: Viewport[] = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const x = viewport.x + columnIndex * (cellWidth + columnGap);
      const y = viewport.y + rowIndex * (cellHeight + rowGap);
      cells.push({ x, y, width: cellWidth, height: cellHeight });
    }
  }
  return cells;
};

export const computeMfdEngineLayout = (
  viewport: Viewport,
  config?: Partial<MfdEngineLayoutConfig>
): MfdEngineLayoutMetrics => {
  const resolved = resolveEngineConfig(config);
  const padding = Math.min(viewport.width, viewport.height) * resolved.paddingRatio;
  const innerX = viewport.x + padding;
  const innerY = viewport.y + padding;
  const innerWidth = Math.max(viewport.width - padding * 2, 0);
  const innerHeight = Math.max(viewport.height - padding * 2, 0);
  const headerHeight = innerHeight * resolved.headerRatio;
  const footerHeight = innerHeight * resolved.footerRatio;
  const gap = innerHeight * resolved.sectionGapRatio;
  const contentHeight = Math.max(innerHeight - headerHeight - footerHeight - gap * 2, 0);
  const header: Viewport = {
    x: innerX,
    y: innerY,
    width: innerWidth,
    height: headerHeight,
  };
  const content: Viewport = {
    x: innerX,
    y: innerY + headerHeight + gap,
    width: innerWidth,
    height: contentHeight,
  };
  const footer: Viewport = {
    x: innerX,
    y: content.y + content.height + gap,
    width: innerWidth,
    height: footerHeight,
  };
  const gauges = resolved.gauges ?? [];
  const columns = Math.max(resolved.columns, 1);
  const rows = Math.max(Math.ceil(gauges.length / columns), 1);
  const columnGap = content.width * resolved.columnGapRatio;
  const rowGap = content.height * resolved.rowGapRatio;
  const grid = computeGrid(content, columns, rows, columnGap, rowGap).slice(0, gauges.length);

  return { header, content, grid, footer };
};

export const computeMfdUtilitiesLayout = (
  viewport: Viewport,
  config?: Partial<MfdUtilitiesLayoutConfig>
): MfdUtilitiesLayoutMetrics => {
  const resolved = resolveUtilitiesConfig(config);
  const padding = Math.min(viewport.width, viewport.height) * resolved.paddingRatio;
  const innerX = viewport.x + padding;
  const innerY = viewport.y + padding;
  const innerWidth = Math.max(viewport.width - padding * 2, 0);
  const innerHeight = Math.max(viewport.height - padding * 2, 0);
  const headerHeight = innerHeight * resolved.headerRatio;
  const footerHeight = innerHeight * resolved.footerRatio;
  const gap = innerHeight * resolved.sectionGapRatio;
  const contentHeight = Math.max(innerHeight - headerHeight - footerHeight - gap * 2, 0);
  const header: Viewport = {
    x: innerX,
    y: innerY,
    width: innerWidth,
    height: headerHeight,
  };
  const content: Viewport = {
    x: innerX,
    y: innerY + headerHeight + gap,
    width: innerWidth,
    height: contentHeight,
  };
  const footer: Viewport = {
    x: innerX,
    y: content.y + content.height + gap,
    width: innerWidth,
    height: footerHeight,
  };
  const sections = resolved.sections ?? [];
  const columns = Math.max(resolved.columns, 1);
  const rows = Math.max(Math.ceil(sections.length / columns), 1);
  const columnGap = content.width * resolved.columnGapRatio;
  const rowGap = content.height * resolved.rowGapRatio;
  const grid = computeGrid(content, columns, rows, columnGap, rowGap).slice(0, sections.length);

  return { header, content, grid, footer };
};

const formatGaugeValue = (
  value: number | string | null | undefined,
  precision: number
): string => {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(precision);
};

const drawPanelBorder = (ctx: CanvasRenderingContext2D, viewport: Viewport, color: string): void => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.restore();
};

export const createMfdEngineSceneGraph = (
  config?: Partial<MfdEngineLayoutConfig>
): MfdSceneGraph => {
  const backgroundLayer: MfdLayer = {
    id: 'base',
    order: 0,
    render: (ctx, frame) => {
      const resolved = resolveEngineConfig({ ...config, theme: frame.theme });
      ctx.save();
      ctx.fillStyle = resolved.backgroundColor;
      ctx.fillRect(frame.viewport.x, frame.viewport.y, frame.viewport.width, frame.viewport.height);
      ctx.restore();
    },
  };

  const engineLayer: MfdLayer = {
    id: 'engine',
    order: 5,
    render: (ctx, frame) => {
      const resolved = resolveEngineConfig({ ...config, theme: frame.theme });
      const layout = computeMfdEngineLayout(frame.viewport, resolved);
      const gauges = resolved.gauges ?? [];

      drawText(ctx, {
        ...DEFAULT_TEXT_OPTIONS,
        text: 'ENGINE',
        x: layout.header.x + layout.header.width / 2,
        y: layout.header.y + layout.header.height / 2,
        color: resolved.headerColor,
        font: resolved.headerFont,
      });

      gauges.forEach((gauge, index) => {
        const cell = layout.grid[index];
        if (!cell) return;
        drawPanelBorder(ctx, cell, resolved.borderColor);

        const labelPadding = 8;
        drawText(ctx, {
          ...DEFAULT_TEXT_OPTIONS,
          text: gauge.label,
          x: cell.x + labelPadding,
          y: cell.y + labelPadding,
          align: 'left',
          baseline: 'top',
          color: resolved.labelColor,
          font: resolved.labelFont,
        });

        const precision = gauge.precision ?? 0;
        const value = gauge.value ? gauge.value(frame) : '--';
        const formatted = formatGaugeValue(value, precision);
        const unitSuffix = gauge.unit ? ` ${gauge.unit}` : '';
        drawText(ctx, {
          ...DEFAULT_TEXT_OPTIONS,
          text: `${formatted}${unitSuffix}`,
          x: cell.x + cell.width / 2,
          y: cell.y + cell.height / 2,
          align: 'center',
          baseline: 'middle',
          color: resolved.valueColor,
          font: resolved.valueFont,
        });
      });

      const footerText = resolved.footerText?.(frame);
      if (footerText) {
        drawText(ctx, {
          ...DEFAULT_TEXT_OPTIONS,
          text: footerText,
          x: layout.footer.x + layout.footer.width / 2,
          y: layout.footer.y + layout.footer.height / 2,
          color: resolved.labelColor,
          font: resolved.labelFont,
        });
      }
    },
  };

  return { layers: [backgroundLayer, engineLayer] };
};

export const createMfdUtilitiesSceneGraph = (
  config?: Partial<MfdUtilitiesLayoutConfig>
): MfdSceneGraph => {
  const backgroundLayer: MfdLayer = {
    id: 'base',
    order: 0,
    render: (ctx, frame) => {
      const resolved = resolveUtilitiesConfig({ ...config, theme: frame.theme });
      ctx.save();
      ctx.fillStyle = resolved.backgroundColor;
      ctx.fillRect(frame.viewport.x, frame.viewport.y, frame.viewport.width, frame.viewport.height);
      ctx.restore();
    },
  };

  const utilitiesLayer: MfdLayer = {
    id: 'overlays',
    order: 7,
    render: (ctx, frame) => {
      const resolved = resolveUtilitiesConfig({ ...config, theme: frame.theme });
      const layout = computeMfdUtilitiesLayout(frame.viewport, resolved);
      const sections = resolved.sections ?? [];

      drawText(ctx, {
        ...DEFAULT_TEXT_OPTIONS,
        text: 'UTILITIES',
        x: layout.header.x + layout.header.width / 2,
        y: layout.header.y + layout.header.height / 2,
        color: resolved.headerColor,
        font: resolved.headerFont,
      });

      sections.forEach((section, index) => {
        const cell = layout.grid[index];
        if (!cell) return;
        drawPanelBorder(ctx, cell, resolved.borderColor);
        drawText(ctx, {
          ...DEFAULT_TEXT_OPTIONS,
          text: section.label,
          x: cell.x + 10,
          y: cell.y + 10,
          align: 'left',
          baseline: 'top',
          color: resolved.labelColor,
          font: resolved.sectionFont,
        });
        section.render?.(ctx, frame, cell);
      });

      const footerText = resolved.footerText?.(frame);
      if (footerText) {
        drawText(ctx, {
          ...DEFAULT_TEXT_OPTIONS,
          text: footerText,
          x: layout.footer.x + layout.footer.width / 2,
          y: layout.footer.y + layout.footer.height / 2,
          color: resolved.labelColor,
          font: resolved.footerFont,
        });
      }
    },
  };

  return { layers: [backgroundLayer, utilitiesLayer] };
};
