import { useEffect } from 'react'
import type { RefObject } from 'react'

export type RenderFrame = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  time: number
  delta: number
}

export const useCanvasRenderer = (
  canvasRef: RefObject<HTMLCanvasElement>,
  onRender?: (frame: RenderFrame) => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !enabled) {
      return
    }

    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.floor(width))
      const nextHeight = Math.max(1, Math.floor(height))
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth
        canvas.height = nextHeight
      }
    }

    resizeCanvas()
    const resizeTarget = canvas.parentElement ?? canvas
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            resizeCanvas()
          })
    observer?.observe(resizeTarget)

    if (!onRender) {
      return () => {
        observer?.disconnect()
      }
    }

    let context: CanvasRenderingContext2D | null = null
    try {
      context = canvas.getContext('2d')
    } catch (error) {
      return () => {
        observer?.disconnect()
      }
    }

    if (!context) {
      return () => {
        observer?.disconnect()
      }
    }

    let animationFrame = 0
    let lastTime = performance.now()

    const renderLoop = (time: number) => {
      const delta = time - lastTime
      lastTime = time
      if (onRender) {
        onRender({ canvas, context, time, delta })
      }
      animationFrame = window.requestAnimationFrame(renderLoop)
    }

    animationFrame = window.requestAnimationFrame(renderLoop)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer?.disconnect()
    }
  }, [canvasRef, enabled, onRender])
}
