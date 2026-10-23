import type { TapeConfig } from './types'

type Props = { airspeed: number; config?: TapeConfig }

export function AirspeedTape({ airspeed }: Props) {
  return <div className="pfd-airspeed-tape">{airspeed}</div>
}
