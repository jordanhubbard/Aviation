---
name: "react-application"
description: "React JSX component structure, rendering, and local state as a JavaScript UI-framework Flavor. Use for Literate AI workflow tasks when ui-react is selected. Delta of the front-end parent."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "react-application"
version: "1.0.0"
title: "React application generation"
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
  - "Do not select this skill without JavaScript; ui-react requires the JavaScript language Flavor."
  - "Do not use array index as the React key for a dynamically toggled list or sortable row."
  - "Do not import React or any other library as an npm package unless package-npm is selected. Without that Flavor, emit portable JSX or equivalent createElement calls that the selected build Flavor can compile without a package manifest."
  - "Do not copy the front-end parent's module, npm, or language-axis rules; inherit them."
trust: "repository-reviewed"
---
# React application generation

This skill is a delta of `frontend-application`. The `ui-react` Flavor contributes it
when selected. It does not occupy `implementation.language-ecosystem`; React is a
UI-framework axis constrained to JavaScript.

## Components and keys

Structure the UI as functions that return elements. Give every dynamically toggled
series, table row, or routed view a stable key derived from identity, not array
position. Lift shared selection or sort state only as far as needed; a single view's
state normally lives in one parent and flows down as props.

## Rendering and effects

Do not remount an entire tree when the user only toggles display state. Clean up
effects that install timers, subscriptions, or listeners. Isolate loading and error
UI per panel as the front-end parent requires.

## Bundling boundary

A bundler is build-system authority. This Flavor assumes the selected build Flavor
can compile JSX or the equivalent. Without `package-npm` it does not emit npm scripts,
webpack configs, or `package.json`. With `package-npm`, follow the javascript-ecosystem
skill and the package Flavor: lockfile-pinned closure, detect-before-install, and
`node_modules` under `OBJ_DIR`. Keep generated helpers under `source/` role
directories, never `source/build/` or `node_modules`.
