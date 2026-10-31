import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  closePane,
  getDefaultActiveId,
  getRelativePaneId,
  isPaneCloseable,
  movePane,
  sortPanes,
} from '../state.js';
import type { PaneConfig, TabReorderDirection } from '../types.js';

type PaneRecord = Omit<PaneConfig, 'component'>;
type Vectors = {
  schema: string;
  sortCases: Array<{ id: string; panes: PaneRecord[]; expectedIds: string[] }>;
  defaultCases: Array<{ id: string; panes: PaneRecord[]; expectedId: string | null }>;
  closeableCases: Array<{ id: string; pane: PaneRecord; expected: boolean }>;
  relativeCases: Array<{
    id: string;
    panes: PaneRecord[];
    currentId: string | null;
    delta: number;
    expectedId: string | null;
  }>;
  moveCases: Array<{
    id: string;
    panes: PaneRecord[];
    paneId: string;
    direction: TabReorderDirection;
    expectedIds: string[];
    expectedOrders: Array<number | null>;
  }>;
  closeCases: Array<{
    id: string;
    panes: PaneRecord[];
    activeId: string | null;
    closedId: string;
    expectedIds: string[];
    expectedOrders: Array<number | null>;
    expectedActiveId: string | null;
  }>;
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const packagedPath = path.join(packageRoot, 'conformance/panes.json');
const authorityPath = path.resolve(
  packageRoot,
  '../../../../aviation-ui-panes/acceptance/vectors.json',
);
const packaged = fs.readFileSync(packagedPath, 'utf8');
if (fs.existsSync(authorityPath)) {
  expect(packaged).toBe(fs.readFileSync(authorityPath, 'utf8'));
}
const vectors = JSON.parse(packaged) as Vectors;
const component = () => null;
const realize = (panes: PaneRecord[]): PaneConfig[] =>
  panes.map((pane) => ({ ...pane, component }));
const ids = (panes: PaneConfig[]) => panes.map(({ id }) => id);
const orders = (panes: PaneConfig[]) => panes.map(({ order }) => order ?? null);

describe('aviation.ui.panes Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(vectors.schema).toBe('aviation/ui-panes-acceptance-vectors@1');
  });

  for (const vector of vectors.sortCases) {
    it(`sorts ${vector.id} without mutation`, () => {
      const panes = realize(vector.panes);
      const before = structuredClone(vector.panes);
      expect(ids(sortPanes(panes))).toEqual(vector.expectedIds);
      expect(vector.panes).toEqual(before);
    });
  }

  for (const vector of vectors.defaultCases) {
    it(`selects default ${vector.id}`, () => {
      expect(getDefaultActiveId(realize(vector.panes))).toBe(vector.expectedId);
    });
  }

  for (const vector of vectors.closeableCases) {
    it(`evaluates closeability ${vector.id}`, () => {
      expect(isPaneCloseable({ ...vector.pane, component })).toBe(vector.expected);
    });
  }

  for (const vector of vectors.relativeCases) {
    it(`navigates ${vector.id}`, () => {
      expect(getRelativePaneId(realize(vector.panes), vector.currentId, vector.delta))
        .toBe(vector.expectedId);
    });
  }

  for (const vector of vectors.moveCases) {
    it(`moves ${vector.id} without mutation`, () => {
      const panes = realize(vector.panes);
      const before = structuredClone(vector.panes);
      const result = movePane(panes, vector.paneId, vector.direction);
      expect(ids(result)).toEqual(vector.expectedIds);
      expect(orders(result)).toEqual(vector.expectedOrders);
      expect(vector.panes).toEqual(before);
    });
  }

  for (const vector of vectors.closeCases) {
    it(`closes ${vector.id} without mutation`, () => {
      const panes = realize(vector.panes);
      const before = structuredClone(vector.panes);
      const result = closePane(panes, vector.activeId, vector.closedId);
      expect(ids(result.panes)).toEqual(vector.expectedIds);
      expect(orders(result.panes)).toEqual(vector.expectedOrders);
      expect(result.activeId).toBe(vector.expectedActiveId);
      expect(vector.panes).toEqual(before);
    });
  }
});
