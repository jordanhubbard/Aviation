import { mkdir, writeFile } from 'node:fs/promises';

await mkdir(new URL('../dist-esm/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../dist-esm/package.json', import.meta.url),
  `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
  'utf8',
);
