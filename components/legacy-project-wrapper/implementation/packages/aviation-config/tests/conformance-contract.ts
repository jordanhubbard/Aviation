import { existsSync, readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'

export function loadConformanceContract<T>(): T {
  const packagedPath = fileURLToPath(new URL('../conformance/configuration.json', import.meta.url))
  const checkoutMarker = fileURLToPath(new URL('../../../../../../.git', import.meta.url))
  const authorityPath = fileURLToPath(new URL(
    '../../../../../../components/aviation-configuration/acceptance/vectors.json',
    import.meta.url,
  ))
  const packaged = JSON.parse(readFileSync(packagedPath, 'utf8')) as T
  if (existsSync(checkoutMarker)) {
    const authority = JSON.parse(readFileSync(authorityPath, 'utf8')) as T
    if (!isDeepStrictEqual(packaged, authority)) {
      throw new Error('packaged configuration vectors differ from Component authority')
    }
  }
  return packaged
}
