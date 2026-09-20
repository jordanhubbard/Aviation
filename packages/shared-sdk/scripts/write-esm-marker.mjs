// dist-esm/ holds ES modules but the package itself is CommonJS (no top-level
// "type": "module"), so Node would otherwise parse those .js files as CJS.
// A nested package.json marks just that directory as ESM.
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-esm', 'package.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ type: 'module' }, null, 2) + '\n');
console.log('[shared-sdk] wrote dist-esm/package.json ({"type":"module"})');
