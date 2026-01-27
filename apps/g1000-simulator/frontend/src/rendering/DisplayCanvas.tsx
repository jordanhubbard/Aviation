import { useRef } from 'react'

import type { RenderFrame } from './useCanvasRenderer'
import { useCanvasRenderer } from './useCanvasRenderer'

type DisplayCanvasProps = {
  className?: string
  onRender?: (frame: RenderFrame) => void
  enabled?: boolean
}

export const DisplayCanvas = ({ className, onRender, enabled = true }: DisplayCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useCanvasRenderer(canvasRef, onRender, enabled)

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
