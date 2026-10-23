type Props = { text: string; size?: number; color?: string }

export function AviationText({ text }: Props) {
  return <span className="pfd-aviation-text">{text}</span>
}
