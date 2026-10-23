export type RegionConfig = {
  id: string;
  label: string;
  bounds: [[number, number], [number, number]];
  stations: string[];
};

const usWestStations = ['KSFO', 'KLAX', 'KSEA', 'KPDX', 'KSLC', 'KDEN', 'KPHX', 'KLAS'];
const usEastStations = ['KJFK', 'KBOS', 'KATL', 'KMIA', 'KORD', 'KCLT', 'KDCA', 'KTPA'];
const usStations = Array.from(new Set([...usWestStations, ...usEastStations, 'KDFW', 'KIAH', 'KMSP']));

export const regions: RegionConfig[] = [
  {
    id: 'us',
    label: 'US',
    bounds: [
      [24.396308, -124.848974],
      [49.384358, -66.885444],
    ],
    stations: usStations,
  },
  {
    id: 'us-west',
    label: 'US West',
    bounds: [
      [31.332, -125.0],
      [49.384358, -102.0],
    ],
    stations: usWestStations,
  },
  {
    id: 'us-east',
    label: 'US East',
    bounds: [
      [24.396308, -102.0],
      [49.384358, -66.885444],
    ],
    stations: usEastStations,
  },
  {
    id: 'europe',
    label: 'Europe',
    bounds: [
      [34.0, -11.0],
      [71.0, 32.0],
    ],
    stations: ['EGLL', 'EHAM', 'LFPG', 'EDDF', 'LEMD', 'LIRF', 'LSZH', 'ENGM', 'EIDW', 'EKCH'],
  },
  {
    id: 'aus-nz',
    label: 'Australia / NZ',
    bounds: [
      [-48.5, 110.0],
      [-10.0, 179.9],
    ],
    stations: ['YSSY', 'YMML', 'YBBN', 'YPPH', 'YADL', 'NZAA', 'NZWN', 'NZCH'],
  },
];

export const defaultRegionId = 'us';

export const monitoredStations = Array.from(
  new Set(regions.flatMap((region) => region.stations))
);

export function getRegion(regionId: string | null | undefined): RegionConfig {
  const region = regions.find((entry) => entry.id === regionId);
  return region ?? regions[0];
}
