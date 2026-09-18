import { distanceNM, initialBearing } from '@aviation/shared-sdk';

export type LegSummary = {
  distanceNm: number;
  courseTrue: number;
};

export const summarizeLeg = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): LegSummary => ({
  distanceNm: distanceNM(start.latitude, start.longitude, end.latitude, end.longitude),
  courseTrue: initialBearing(start.latitude, start.longitude, end.latitude, end.longitude),
});
