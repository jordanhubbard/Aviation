import { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import type { Condition } from '../pages/performanceTypes'
import type { PerformanceReference } from '../utils/performanceReference'
import '../utils/performanceReference'

type ReferenceElement = HTMLElement & { context: Record<string, Condition> }
type Props = {
  context?: Record<string, Condition>
  onApply?: (reference: PerformanceReference & { operator_fields: string[] }) => void
}
export default function SourcedPerformanceReference({ context = {}, onApply }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const element = useRef<ReferenceElement | null>(null)
  const apply = useRef(onApply)
  apply.current = onApply
  const serialized = JSON.stringify(context)
  useEffect(() => {
    const node = document.createElement('aviation-performance-reference') as ReferenceElement
    node.setAttribute('apply-metrics', 'cruise_tas_kt cruise_fuel_flow_gph')
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail
        const reference = window.AviationPerformanceReference.validate(detail?.reference)
        if (
          !Array.isArray(detail?.operator_fields) ||
          detail.operator_fields.length > 36 ||
          detail.operator_fields.some(
            (value: unknown) => typeof value !== 'string' || value.length > 64,
          )
        )
          return
        if (reference.metric === 'cruise_tas_kt' || reference.metric === 'cruise_fuel_flow_gph') {
          apply.current?.({ ...reference, operator_fields: detail.operator_fields })
          container.current?.closest('details')?.removeAttribute('open')
        }
      } catch {
        /* Invalid references cannot change planning inputs. */
      }
    }
    node.addEventListener('performance-reference-apply', handler)
    element.current = node
    container.current?.append(node)
    return () => {
      node.removeEventListener('performance-reference-apply', handler)
      node.remove()
      element.current = null
    }
  }, [])
  useEffect(() => {
    if (element.current) element.current.context = JSON.parse(serialized)
  }, [serialized])
  return (
    <Box component="details">
      <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
        Inspect sourced performance references
      </Box>
      <Box ref={container} />
    </Box>
  )
}
