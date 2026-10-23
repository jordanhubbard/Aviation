import type { CompassData } from './types'

type Props = { data: CompassData }

export function CompassRose({ data }: Props) {
  return <div className="pfd-compass-rose">{data.heading}</div>
}
