import type { AttitudeData } from './types'

type Props = { data: AttitudeData }

export function AttitudeIndicator({ data }: Props) {
  return <div className="pfd-attitude-indicator">{data.pitch},{data.roll}</div>
}
