import fs from 'fs';
import path from 'path';
import { memoryRepo } from '../src/repo/memoryRepo.js';
import { findAirport } from '../src/geo/airportLookup.js';
const dataPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data/seeds.json');
function loadSeeds() {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    return data;
}
function run() {
    const seeds = loadSeeds();
    let inserted = 0;
    let updated = 0;
    for (const ev of seeds) {
        const airport = ev.airportIcao ? findAirport(ev.airportIcao) : ev.airportIata ? findAirport(ev.airportIata) : undefined;
        const enriched = {
            ...ev,
            airportIcao: ev.airportIcao || airport?.icao,
            airportIata: ev.airportIata || airport?.iata,
            country: ev.country || airport?.country,
            region: ev.region || airport?.region,
            lat: ev.lat ?? airport?.lat,
            lon: ev.lon ?? airport?.lon,
        };
        const pre = memoryRepo.list({}).data.find((r) => r.registration === enriched.registration && r.dateZ === enriched.dateZ);
        memoryRepo.upsert(enriched);
        if (pre)
            updated += 1;
        else
            inserted += 1;
    }
    console.log(`[seed] loaded ${seeds.length} events; inserted=${inserted} updated=${updated}`);
}
run();
