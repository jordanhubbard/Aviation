type Props = { value: number; min: number; max: number }

export function ArcIndicator({ value }: Props) {
  return <div className="pfd-arc-indicator">{value}</div>
}
