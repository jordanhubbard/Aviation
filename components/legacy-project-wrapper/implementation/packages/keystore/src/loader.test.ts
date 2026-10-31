import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { SecretLoader } from './loader'
import { SecureKeyStore } from './keystore'

const tempDirs: string[] = []
const changedEnvironment = new Map<string, string | undefined>()

function createStorePath(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviation-secret-loader-'))
  tempDirs.push(tempDir)
  return path.join(tempDir, '.keystore')
}

function setEnvironment(key: string, value: string | undefined): void {
  if (!changedEnvironment.has(key)) changedEnvironment.set(key, process.env[key])
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

afterEach(() => {
  for (const [key, value] of changedEnvironment) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  changedEnvironment.clear()
  for (const tempDir of tempDirs.splice(0)) fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('SecretLoader', () => {
  it('prefers its service-scoped keystore value over the environment', () => {
    const storePath = createStorePath()
    setEnvironment('KEYSTORE_ENCRYPTION_KEY', 'loader-test-key')
    setEnvironment('API_KEY', 'environment-value')
    new SecureKeyStore({ storePath }).setSecret('flight-planner', 'API_KEY', 'stored-value')

    const loader = new SecretLoader({ serviceName: 'flight-planner', keystorePath: storePath })
    expect(loader.get('API_KEY')).toBe('stored-value')
    expect(loader.listKeys()).toEqual(['API_KEY'])
  })

  it('supports environment fallback, defaults, required values, and fail-closed fallback', () => {
    const storePath = createStorePath()
    setEnvironment('ENV_ONLY', 'environment-value')
    setEnvironment('INTENTIONALLY_EMPTY', '')
    setEnvironment('MISSING', undefined)

    const loader = new SecretLoader({ serviceName: 'weather', keystorePath: storePath })
    expect(loader.get('ENV_ONLY')).toBe('environment-value')
    expect(loader.getWithDefault('INTENTIONALLY_EMPTY', 'default-value')).toBe('')
    expect(loader.getWithDefault('MISSING', 'default-value')).toBe('default-value')
    expect(() => loader.getRequired('MISSING')).toThrow('weather:MISSING')

    const isolated = new SecretLoader({
      serviceName: 'weather',
      keystorePath: storePath,
      fallbackToEnv: false,
    })
    expect(isolated.get('ENV_ONLY')).toBeUndefined()
  })
})
