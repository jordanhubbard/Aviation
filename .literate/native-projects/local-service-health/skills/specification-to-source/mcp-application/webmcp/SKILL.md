---
name: "webmcp"
description: "In-page WebMCP tools (JavaScript functions or HTML tools) for front-ends. Use for Literate AI workflow tasks that expose MCP in the browser page. Inherits the MCP parent; not a second protocol."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "webmcp"
version: "1.0.0"
title: "WebMCP in-page tools"
stages:
  - "plan"
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "mcp-application"
    version: "1.0.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "3170803f41b234fbc642da2b7bd2f5bcb5eba9a4931bd5bde9b47948c7e2a979"
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "frontend-application"
    version: "1.1.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "38b1a9f0031943567c57e34dd3ccf6a271a5b58a613421d14a7cf43e50578ad9"
limitations:
  - "Do not implement WebMCP as a backend MCP server that bypasses the page UI."
  - "Do not require a personal operator catalog id, a project `mcps/` item, or an npm WebMCP types package."
  - "Do not register a tool whose execute path mutates state without updating the visible page."
  - "Do not copy MCP hygiene, identity pins, or secret rejection; the MCP parent owns those rules."
trust: "repository-reviewed"
---
# WebMCP in-page tools

This skill is a delta of `mcp-application` (filesystem parent) and of
`frontend-application` (front-end parent). Pin both parents in the recipe. WebMCP is
MCP in the running page: JavaScript functions or HTML tools with natural-language
descriptions and structured schemas for in-browser agents.

## In-page, not a second protocol

Register tools on the document's model context (the WebMCP `registerTool` shape:
`name`, `description`, `inputSchema`, `execute`). HTML tools are first-class when the
specification names them. Inherit the MCP parent's tool-versus-resource split, input
schema validation, and structured errors. Do not invent a parallel protocol.

Tools reuse the page's existing client-side logic. `execute` updates the same UI and
client state a human would reach, then returns a structured result. If a requested
task is outside the registered tools, the agent may fall back to ordinary page
actuation; do not generate a hidden headless API as a substitute.

## Front-end delta

Follow the front-end parent for JavaScript-only generation, relative imports with
extensions, and dependency-free modules. Keep the human interface primary: WebMCP
augments it for cooperative, human-in-the-loop agents. Do not disintermediate the
page with a server-only MCP integration.

## What this leaf does not own

Operator catalogs, project `mcps/` hygiene, and embedded process MCP stay on their
own leaves. This skill must not name a personal catalog path or a reserved operator
id as a product tool.
