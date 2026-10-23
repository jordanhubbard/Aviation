import type { FlightData } from './types'

type Props = { data: FlightData }

export function PFDDisplay({ data }: Props) {
  return <div className="pfd-display">{data.heading}</div>
}
