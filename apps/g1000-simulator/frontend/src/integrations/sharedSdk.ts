import { courseTrue, distanceNm } from '@aviation/shared-sdk';

export type LegSummary = {
  distanceNm: number;
  courseTrue: number;
};

export const summarizeLeg = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): LegSummary => ({
  distanceNm: distanceNm(start.latitude, start.longitude, end.latitude, end.longitude),
  courseTrue: courseTrue(start.latitude, start.longitude, end.latitude, end.longitude),
});
