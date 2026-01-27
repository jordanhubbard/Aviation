import { NavDataSnapshot } from "./types";

export function emptySnapshot(): NavDataSnapshot {
  return {
    airports: [],
    navaids: [],
    airspaces: [],
    procedures: [],
  };
}

export function mergeSnapshots(...snapshots: NavDataSnapshot[]): NavDataSnapshot {
  return snapshots.reduce((acc, snapshot) => {
    acc.airports.push(...snapshot.airports);
    acc.navaids.push(...snapshot.navaids);
    acc.airspaces.push(...snapshot.airspaces);
    acc.procedures.push(...snapshot.procedures);
    return acc;
  }, emptySnapshot());
}
