import { describe, expect, it } from 'vitest';
import { getDefaultActiveId, getNextActiveId, isPaneCloseable, sortPanes } from '../state';

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
    const result = getDefaultActiveId([panes[2], panes[1]]);
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
