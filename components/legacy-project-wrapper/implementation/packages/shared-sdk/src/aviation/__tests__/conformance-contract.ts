import { existsSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

export function loadConformanceContract<T>(name: string): T {
  const packagedPath = fileURLToPath(new URL(`../../../conformance/${name}.json`, import.meta.url));
  const authorityPath = fileURLToPath(new URL(
    `../../../../../../../../components/aviation-${name}/acceptance/vectors.json`,
    import.meta.url,
  ));
  const packaged = JSON.parse(readFileSync(packagedPath, 'utf8')) as T;

  if (existsSync(authorityPath)) {
    const authority = JSON.parse(readFileSync(authorityPath, 'utf8')) as T;
    if (!isDeepStrictEqual(packaged, authority)) {
      throw new Error(`packaged ${name} conformance vectors differ from Component authority`);
    }
  }
  return packaged;
}
