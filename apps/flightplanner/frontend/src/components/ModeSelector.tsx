import React from 'react'
import { ToggleButton, ToggleButtonGroup } from '@mui/material'

export type PlanMode = 'local' | 'route'

type Props = {
  mode: PlanMode
  onChange: (mode: PlanMode) => void
  disabled?: boolean
}

const ModeSelector: React.FC<Props> = ({ mode, onChange, disabled }) => {
  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_e, v: PlanMode | null) => {
        if (v) onChange(v)
      }}
      disabled={disabled}
      size="small"
      aria-label="Planning mode"
      sx={{ mb: 2 }}
    >
      <ToggleButton value="local" aria-label="Local Flight">
        Local Flight
      </ToggleButton>
      <ToggleButton value="route" aria-label="Cross-Country Route">
        Cross-Country Route
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

export default React.memo(ModeSelector)
