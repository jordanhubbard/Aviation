import { distanceNM } from '@aviation/shared-sdk/aviation/navigation'

export function haversineNm(a: [number, number], b: [number, number]): number {
  return distanceNM(a[0], a[1], b[0], b[1])
}
