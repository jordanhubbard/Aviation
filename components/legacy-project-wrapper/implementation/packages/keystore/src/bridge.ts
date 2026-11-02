#!/usr/bin/env node
/** Bounded stdin/stdout protocol for SDK consumers without npm or ts-node. */
import * as path from 'node:path';
import { SecureKeyStore } from './keystore';

const requestSchema = 'aviation/keystore-request@1';
const responseSchema = 'aviation/keystore-response@1';
const identifier = /^[A-Za-z0-9_.-]{1,128}$/;
const validIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === value && identifier.test(value);

async function main(): Promise<void> {
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input, 'utf8') > 65536) throw new Error('Invalid request');
  }
  const request = JSON.parse(input);
  if (!request || Array.isArray(request) || request.schema !== requestSchema
    || !['get', 'set', 'delete', 'keys', 'entries'].includes(request.operation)) throw new Error('Invalid request');
  const operation: string = request.operation;
  if (operation !== 'entries' && !validIdentifier(request.service)) throw new Error('Invalid request');
  if (['get', 'set', 'delete'].includes(operation) && !validIdentifier(request.key)) throw new Error('Invalid request');
  if (operation === 'set' && (typeof request.value !== 'string' || !request.value.length
    || Buffer.byteLength(request.value, 'utf8') > 16384)) throw new Error('Invalid request');
  const store = new SecureKeyStore({
    storePath: process.env.KEYSTORE_PATH || path.join(process.cwd(), '.keystore'),
    testRunId: process.env.AVIATION_E2E_RUN_ID,
  });
  store.assertReadable();
  let data: object;
  switch (operation) {
    case 'get': data = { value: store.getSecret(request.service, request.key) ?? null }; break;
    case 'set': store.setSecret(request.service, request.key, request.value); data = {}; break;
    case 'delete': data = { deleted: store.deleteSecret(request.service, request.key) }; break;
    case 'keys': data = { keys: store.listKeys(request.service).sort() }; break;
    default: data = { entries: store.listEntries() };
  }
  process.stdout.write(JSON.stringify({ schema: responseSchema, ok: true, operation, data }) + '\n');
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ schema: responseSchema, ok: false, error: 'Keystore operation failed' }) + '\n');
  process.exitCode = 1;
});
