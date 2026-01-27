import { useCallback } from 'react'

import { useWebSocketClient } from './useWebSocketClient'

export type CommandMessage =
  | {
      type: 'reset'
    }
  | {
      type: 'set_targets'
      targets: {
        heading_deg?: number
        altitude_ft?: number
        airspeed_kt?: number
      }
    }
  | {
      type: 'set_adf'
      frequency_khz: number
    }
  | {
      type: 'set_dme'
      frequency_mhz: number
    }
  | {
      type: 'set_autopilot'
      master_on?: boolean
      lateral_mode?: string
      vertical_mode?: string
      target_vertical_speed_fpm?: number
    }
  | {
      type: 'set_audio_panel'
      com1_enabled?: boolean
      com2_enabled?: boolean
      nav1_enabled?: boolean
      nav2_enabled?: boolean
      adf_enabled?: boolean
      marker_enabled?: boolean
      speaker_enabled?: boolean
      headphone_enabled?: boolean
      com1_volume?: number
      com2_volume?: number
      nav1_volume?: number
      nav2_volume?: number
      adf_volume?: number
      marker_volume?: number
    }
  | {
      type: 'set_transponder'
      mode?: string
      squawk_code?: string | number
      ident?: boolean
    }

const resolveCommandSocketUrl = () => {
  if (typeof window === 'undefined') return null
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const baseUrl = import.meta.env.VITE_WS_URL || `${protocol}://${window.location.host}`
  return `${baseUrl}/ws/commands`
}

export const useCommandSocket = () => {
  const url = resolveCommandSocketUrl()
  const { status, send } = useWebSocketClient({ url })

  const sendCommand = useCallback((message: CommandMessage) => {
    send(message)
  }, [send])

  return { status, sendCommand }
}
