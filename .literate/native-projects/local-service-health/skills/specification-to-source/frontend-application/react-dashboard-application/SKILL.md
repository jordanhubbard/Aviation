---
name: "react-dashboard-application"
description: "Interactive data-dashboard frontend generation: toggleable overlaid time-series charts and sortable/rankable tables over the same dataset. Use for Literate AI workflow tasks. Delta of the front-end parent."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "react-dashboard-application"
version: "1.2.0"
title: "React dashboard application generation"
stages:
  - "plan"
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "frontend-application"
    version: "1.1.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "38b1a9f0031943567c57e34dd3ccf6a271a5b58a613421d14a7cf43e50578ad9"
limitations:
  - "Do not re-fetch or discard already-loaded data when the user only changes which series are displayed or how the view is sorted; toggling display state must not force a new network round trip for data already in hand."
  - "Do not invent a chart or table interaction the specification did not request; only build the exact toggle/sort/view-switch behavior described."
  - "Do not copy the front-end parent's module, npm, language-axis, or panel-isolation rules; inherit them."
trust: "repository-reviewed"
---
# React dashboard application generation

This skill is a delta of `frontend-application`. Pin the parent in the recipe.
Generate a single-page dashboard over one tabular, time-series dataset (one row per
entity per observation, one column per statistic). The same underlying dataset backs
two interchangeable views the user can switch between at will: a graph view and a
table view.

## Series selection state

Track which statistic/resource columns are currently selected for display as one small
piece of local UI state (e.g. a set of column identifiers), independent of the fetched
data itself. Toggling a resource on or off adds or removes it from that set and must
never trigger a re-fetch of already-loaded data; the fetched dataset already contains
every column, and the selection only controls what is rendered. Reach for a shared
state mechanism (context, external store) only if more than one distant component needs
the same selection; a single dashboard's selection state normally lives in one
component and flows down as props.

## Graph view

Every currently selected statistic renders as its own series on one shared time-series
chart, so multiple resources overlay for direct visual comparison. Adding or removing a
series must not remount or reset the other series' rendering (zoom level, visible time
range). Give each series a stable, unique key derived from its identity (statistic name
plus entity, not its position in an array), since selection order changes.

## Table view

Every column in the table view is one statistic type the backend exports; every column
independently supports ascending and descending sort, and the active sort column and
direction are visible in the UI. Support ranking by more than one statistic at once
(a primary sort key with one or more tie-breaking secondary keys), not only a single
column at a time. Table rows use a stable unique key derived from entity identity, not
row position, so sorting does not corrupt row-local UI state (e.g. an expanded row).

## View switching

Switching between graph and table view is a display-mode toggle over the same already
fetched dataset and current selection/sort state; it must not discard the current
selection, sort order, or loaded data, and must not require a new fetch.

## Browser-observable dashboard state

Expose graph/table mode, selected series, active sort keys, row count, and independently
loading panel states through native controls and accessible names inherited by browser
instrumentation. Deterministic dashboard fixtures must exercise enough rows and series to
make sorting, scrolling, responsive collapse, and selection changes observable. A generated
test that only searches returned HTML for headings is not evidence that these interactions
render or work; leave stable seams for the parent's post-build browser verification.
