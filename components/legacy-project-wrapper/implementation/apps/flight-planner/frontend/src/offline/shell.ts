export async function ensureOfflineShell(): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext)
    throw new Error('Offline reopening requires HTTPS or localhost and service-worker support')
  const registration = await navigator.serviceWorker.register('/offline-sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })
  if (registration.active) return
  await new Promise<void>((resolve, reject) => {
    const worker = registration.installing ?? registration.waiting
    if (!worker) {
      reject(new Error('Offline application shell did not start installing'))
      return
    }
    const timer = window.setTimeout(
      () => finish(new Error('Offline application shell installation timed out; retry online')),
      30000,
    )
    const finish = (error?: Error) => {
      clearTimeout(timer)
      worker.removeEventListener('statechange', changed)
      if (error) reject(error)
      else resolve()
    }
    const changed = () => {
      if (worker.state === 'activated') finish()
      else if (worker.state === 'redundant')
        finish(
          new Error('Offline application shell could not be installed; reload and retry online'),
        )
    }
    worker.addEventListener('statechange', changed)
    changed()
  })
}
