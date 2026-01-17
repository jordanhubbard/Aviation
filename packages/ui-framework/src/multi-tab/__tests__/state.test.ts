import { describe, expect, it } from 'vitest';
import {
  getDefaultActiveId,
  getNextActiveIdAfterClose,
  getNextActiveId,
  getRelativePaneId,
  isPaneCloseable,
  closePane,
  movePane,
  normalizePaneOrder,
  sortPanes,
} from '../state';

const panes = [
  { id: 'b', title: 'Bravo', component: () => null, order: 2 },
  { id: 'a', title: 'Alpha', component: () => null, order: 1, defaultOpen: true },
  { id: 'c', title: 'Charlie', component: () => null },
];

describe('sortPanes', () => {
  it('sorts by order then title', () => {
    const result = sortPanes(panes);
    expect(result.map((pane) => pane.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('getDefaultActiveId', () => {
  it('returns defaultOpen when present', () => {
    expect(getDefaultActiveId(panes)).toBe('a');
  });

  it('returns first pane id when no defaultOpen', () => {
    const result = getDefaultActiveId([
      { ...panes[2] },
      { ...panes[1], defaultOpen: false },
    ]);
    expect(result).toBe('c');
  });
});

describe('isPaneCloseable', () => {
  it('defaults to true when closeable is undefined', () => {
    expect(isPaneCloseable(panes[0])).toBe(true);
  });

  it('respects closeable=false', () => {
    expect(isPaneCloseable({ ...panes[0], closeable: false })).toBe(false);
  });
});

describe('getNextActiveId', () => {
  it('returns default active when current is null', () => {
    expect(getNextActiveId(panes, null)).toBe('a');
  });

  it('returns next pane when current is found', () => {
    expect(getNextActiveId(panes, 'a')).toBe('b');
  });

  it('returns previous pane when current is last', () => {
    expect(getNextActiveId(panes, 'c')).toBe('b');
  });
});

describe('getRelativePaneId', () => {
  it('wraps forward through panes', () => {
    expect(getRelativePaneId(panes, 'c', 1)).toBe('a');
  });

  it('wraps backward through panes', () => {
    expect(getRelativePaneId(panes, 'a', -1)).toBe('c');
  });
});

describe('normalizePaneOrder', () => {
  it('assigns sequential order values', () => {
    const result = normalizePaneOrder([
      { id: 'c', title: 'Charlie', component: () => null },
      { id: 'a', title: 'Alpha', component: () => null },
    ]);
    expect(result.map((pane) => pane.order)).toEqual([1, 2]);
  });
});

describe('movePane', () => {
  it('moves panes left and right', () => {
    const ordered = [
      { id: 'a', title: 'Alpha', component: () => null },
      { id: 'b', title: 'Bravo', component: () => null },
      { id: 'c', title: 'Charlie', component: () => null },
    ];
    const movedLeft = movePane(ordered, 'b', 'left');
    expect(movedLeft.map((pane) => pane.id)).toEqual(['b', 'a', 'c']);
    const movedRight = movePane(movedLeft, 'b', 'right');
    expect(movedRight.map((pane) => pane.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns original list when move is out of bounds', () => {
    const ordered = [
      { id: 'a', title: 'Alpha', component: () => null },
      { id: 'b', title: 'Bravo', component: () => null },
    ];
    expect(movePane(ordered, 'a', 'left')).toEqual(ordered);
  });
});

describe('getNextActiveIdAfterClose', () => {
  it('returns next pane after closed id', () => {
    const ordered = [
      { id: 'a', title: 'Alpha', component: () => null },
      { id: 'b', title: 'Bravo', component: () => null },
      { id: 'c', title: 'Charlie', component: () => null },
    ];
    expect(getNextActiveIdAfterClose(ordered, 'b')).toBe('c');
  });
});

describe('closePane', () => {
  it('removes a pane and selects a neighbor when active closes', () => {
    const ordered = [
      { id: 'a', title: 'Alpha', component: () => null },
      { id: 'b', title: 'Bravo', component: () => null },
      { id: 'c', title: 'Charlie', component: () => null },
    ];
    const result = closePane(ordered, 'b', 'b');
    expect(result.panes.map((pane) => pane.id)).toEqual(['a', 'c']);
    expect(result.activeId).toBe('c');
  });
});
