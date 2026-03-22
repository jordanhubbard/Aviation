import type { TapeConfig } from './types'

type Props = { altitude: number; config?: TapeConfig }

export function AltitudeTape({ altitude }: Props) {
  return <div className="pfd-altitude-tape">{altitude}</div>
}
