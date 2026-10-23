type RuntimeEnv = {
  VITE_OPENWEATHERMAP_API_KEY?: string
  VITE_REPO_URL?: string
  VITE_GIT_SHA?: string
}

export function getRuntimeEnv<K extends keyof RuntimeEnv>(key: K): RuntimeEnv[K] | undefined {
  const w = window as unknown as { __ENV__?: RuntimeEnv }
  if (w.__ENV__ && typeof w.__ENV__[key] === 'string' && w.__ENV__[key]) {
    return w.__ENV__[key]
  }

  // Fallback to build-time Vite env
  return (import.meta as unknown as { env?: RuntimeEnv }).env?.[key]
}
