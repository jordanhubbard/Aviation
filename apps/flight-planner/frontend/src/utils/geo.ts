export function haversineNm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a
  const [lat2, lon2] = b

  const rNm = 3440.065
  const toRad = (d: number) => (d * Math.PI) / 180

  const phi1 = toRad(lat1)
  const phi2 = toRad(lat2)
  const dPhi = toRad(lat2 - lat1)
  const dLambda = toRad(lon2 - lon1)

  const sinDphi = Math.sin(dPhi / 2)
  const sinDlambda = Math.sin(dLambda / 2)

  const aVal = sinDphi * sinDphi + Math.cos(phi1) * Math.cos(phi2) * sinDlambda * sinDlambda
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
  return rNm * c
}
