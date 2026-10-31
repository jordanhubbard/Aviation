# `aviation.ui.panes` interface

## Pane state record

A portable pane record contains:

- `id`: opaque application-owned string identity.
- `title`: opaque application-owned display title.
- `order`: optional finite ordering number.
- `closeable`: optional boolean; omission means closeable.
- `defaultOpen`: optional boolean; the first true value in source order is the default.

Adapters may attach renderer, icon, URL, styling, and other presentation fields. The
portable operations preserve those fields without interpreting them.

## Operations

- `sortPanes(panes)`: return a new list sorted by ascending explicit order, then title;
  panes without order sort after panes with order.
- `getDefaultActiveId(panes)`: return the first source-order `defaultOpen` identity,
  otherwise the first source-order identity, otherwise `null`.
- `isPaneCloseable(pane)`: return false only when `closeable` is explicitly false.
- `getRelativePaneId(panes, currentId, delta)`: navigate the sorted list with modular
  wrapping; an unknown current identity falls back to the default identity.
- `getNextActiveId(panes, currentId)`: return the next sorted pane, then the previous
  pane, with default fallback for missing state.
- `normalizePaneOrder(panes)`: return new records with sequential order values from one.
- `movePane(panes, paneId, direction)`: move one position left or right without wrapping;
  a missing or boundary move leaves values unchanged.
- `getNextActiveIdAfterClose(panes, closedId)`: prefer the next source-order neighbor,
  then the previous neighbor.
- `closePane(panes, activeId, closedId)`: remove the requested pane, normalize remaining
  order values, and preserve the active identity unless it closed or became invalid.

Every operation leaves caller-owned lists and records unchanged. Rendering, focus,
keyboard shortcuts, persistence, URLs, icons, themes, CSS, and layout are outside this
interface.
