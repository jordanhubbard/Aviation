import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RawEvent } from '../types.js';
import { config } from '../../config.js';

const DIRECTORY = 'https://data.ntsb.gov/avdata/FileDirectory/';
const DOWNLOAD = new URL('DownloadFile', DIRECTORY);
const PARSER = fileURLToPath(new URL('../../../src/ingest/adapters/parseNtsb.py', import.meta.url));
const MAX_ZIP_BYTES = 15_000_000;
const MAX_FILES = 12;

interface UpdateFile {
  name: string;
  modified: number;
  bytes: number;
}

export function listRecentUpdates(html: string, now = new Date()): UpdateFile[] {
  const cutoff = now.getTime() - Math.min(config.ingestion.windowDays, 90) * 86_400_000;
  const files: UpdateFile[] = [];
  for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const name = row.match(/<td id="fileName">(up\d{2}[A-Z]{3}\.zip)<\/td>/)?.[1];
    const date = row.match(/<td id="fileDate">([^<]+)<\/td>/)?.[1];
    const bytes = Number(row.match(/<td id="fileSize">(\d+)<\/td>/)?.[1]);
    const modified = date ? Date.parse(date) : NaN;
    if (name && Number.isFinite(modified) && modified <= now.getTime()
        && modified >= cutoff && bytes > 0 && bytes <= MAX_ZIP_BYTES) {
      files.push({ name, modified, bytes });
    }
  }
  return files.sort((a, b) => b.modified - a.modified).slice(0, MAX_FILES);
}

function parseArchive(bytes: Buffer, url: string, cutoff: string): Promise<RawEvent[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [PARSER, url, cutoff], { stdio: ['pipe', 'pipe', 'pipe'] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let outputSize = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      outputSize += chunk.length;
      if (outputSize > 5_000_000) child.kill();
      else output.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`NTSB parser exited ${code}: ${Buffer.concat(errors).toString().slice(0, 500)}`));
      try {
        resolve(JSON.parse(Buffer.concat(output).toString()) as RawEvent[]);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.on('error', reject);
    child.stdin.end(bytes);
  });
}

export async function fetchRecentNtsb(): Promise<RawEvent[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - config.ingestion.windowDays * 86_400_000).toISOString();
  try {
    const response = await fetch(DIRECTORY, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`NTSB directory HTTP ${response.status}`);
    const files = listRecentUpdates(await response.text(), now);
    if (!files.length) throw new Error('No current NTSB weekly files');

    const byId = new Map<string, RawEvent>();
    for (const file of files) {
      const url = new URL(DOWNLOAD);
      url.searchParams.set('fileID', file.name);
      try {
        const download = await fetch(url, { signal: AbortSignal.timeout(45_000) });
        if (!download.ok) throw new Error(`HTTP ${download.status}`);
        const bytes = Buffer.from(await download.arrayBuffer());
        if (bytes.length > MAX_ZIP_BYTES) throw new Error('archive exceeds size limit');
        for (const event of await parseArchive(bytes, url.toString(), cutoff)) {
          if (!byId.has(event.id)) byId.set(event.id, event);
        }
      } catch (error) {
        console.warn(`[ntsb] ${file.name} failed`, error);
      }
    }
    return [...byId.values()];
  } catch (error) {
    console.warn('[ntsb] live data unavailable', error);
    return [];
  }
}
