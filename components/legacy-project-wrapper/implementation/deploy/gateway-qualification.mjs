// Deployment qualification follows the same checked-in contract as the gateway.
// Additive discovery tools are admitted only when declared by that contract.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync(new URL('../apps/meta-app/gateway-contract.json', import.meta.url), 'utf8'));

export function assertGatewayCatalog(catalog) {
  assert.deepEqual(catalog, contract, 'Meta App public gateway catalog differs from its current v1 contract');
}

export function assertGatewayTools(tools) {
  assert.ok(Array.isArray(tools), 'Meta App MCP tools are unavailable');
  const expectedNames = contract.services.flatMap(service =>
    [service.mcpTool, ...(service.openapi?.describeTool ? [service.openapi.describeTool] : [])]);
  assert.deepEqual(tools.map(tool => tool.name).sort(), expectedNames.sort(),
    'Meta App MCP tools differ from its current v1 catalog');
  for (const service of contract.services) {
    const tool = tools.find(tool => tool.name === service.mcpTool);
    assert.deepEqual(tool.inputSchema, contract.requestSchema, `${service.mcpTool} input schema differs`);
    assert.deepEqual(tool.outputSchema, contract.responseSchema, `${service.mcpTool} output schema differs`);
  }
}
