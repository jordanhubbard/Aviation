import type { AlertLevel } from './alert-manager'

type ToneConfig = {
  frequency: number
  duration: number
  gain: number
}

const toneMap: Record<AlertLevel, ToneConfig | null> = {
  ok: null,
  info: { frequency: 520, duration: 0.18, gain: 0.04 },
  caution: { frequency: 660, duration: 0.24, gain: 0.06 },
  warning: { frequency: 880, duration: 0.32, gain: 0.08 },
}

export const playAlertTone = (level: AlertLevel) => {
  const config = toneMap[level]
  if (!config || typeof window === 'undefined') return false
  const AudioContextRef =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextRef) return false

  const context = new AudioContextRef()
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.frequency.value = config.frequency
  oscillator.type = 'sine'
  gainNode.gain.value = config.gain

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  oscillator.start()
  oscillator.stop(context.currentTime + config.duration)

  oscillator.onended = () => {
    context.close()
  }

  return true
}
