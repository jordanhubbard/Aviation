import { describe, expect, it } from 'vitest'
import { loadConformanceContract } from './conformance-contract'
import {
  ConfigurationValidationError,
  SERVICE_REGISTRY,
  buildServiceStatus,
  getServiceById,
  getServicesByApp,
  normalizeServiceCatalog,
  normalizeServiceDefinition,
} from '../src/registry'
import type { ServiceDefinition, ServiceDefinitionInput } from '../src/types'

type Vectors = {
  schema: string
  normalizationCases: Array<{ id: string; input: ServiceDefinitionInput; expected: ServiceDefinition }>
  invalidDefinitionCases: Array<{ id: string; input: ServiceDefinitionInput; expectedErrorCode: string }>
  invalidCatalogCases: Array<{ id: string; definitions: string[]; expectedErrorCode: string }>
  catalog: Array<{ id: string; category: string; fields: Array<[string, string, boolean, boolean]>; appScope: string[] }>
  filterCases: Array<{ appId: string; expectedIds: string[] }>
  lookupCases: Array<{ id: string; expectedId: string | null }>
  statusCases: Array<{ serviceId: string; configuredKeys: string[]; expected: unknown }>
}

const contract = loadConformanceContract<Vectors>()
const catalogProjection = (service: ServiceDefinition) => ({
  id: service.id,
  category: service.category,
  fields: service.fields.map((field) => [field.key, field.envVar, field.required, field.secret]),
  appScope: service.appScope,
})

describe('aviation.configuration Component conformance', () => {
  it('uses the declared schema and shipped catalog', () => {
    expect(contract.schema).toBe('aviation/configuration-acceptance-vectors@1')
    expect(SERVICE_REGISTRY.map(catalogProjection)).toEqual(contract.catalog)
  })

  for (const vector of contract.normalizationCases) {
    it(`normalizes ${vector.id} without mutation`, () => {
      const input = structuredClone(vector.input)
      const before = structuredClone(input)
      expect(normalizeServiceDefinition(input)).toEqual(vector.expected)
      expect(input).toEqual(before)
    })
  }

  for (const vector of contract.invalidDefinitionCases) {
    it(`rejects ${vector.id}`, () => {
      try {
        normalizeServiceDefinition(vector.input)
        throw new Error('normalization unexpectedly succeeded')
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError)
        expect((error as ConfigurationValidationError).code).toBe(vector.expectedErrorCode)
      }
    })
  }

  const base = contract.normalizationCases[0].input
  for (const vector of contract.invalidCatalogCases) {
    it(`rejects catalog ${vector.id}`, () => {
      const definitions = vector.definitions.map((name, index) => {
        const value = structuredClone(base)
        if (name === 'same-env') {
          value.id = `service-${index}`
        }
        return value
      })
      try {
        normalizeServiceCatalog(definitions)
        throw new Error('catalog normalization unexpectedly succeeded')
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationValidationError)
        expect((error as ConfigurationValidationError).code).toBe(vector.expectedErrorCode)
      }
    })
  }

  for (const vector of contract.filterCases) {
    it(`filters ${vector.appId}`, () => {
      expect(getServicesByApp(vector.appId).map((service) => service.id)).toEqual(vector.expectedIds)
    })
  }
  for (const vector of contract.lookupCases) {
    it(`looks up ${vector.id}`, () => {
      expect(getServiceById(vector.id)?.id ?? null).toBe(vector.expectedId)
    })
  }
  for (const vector of contract.statusCases) {
    it(`builds ${vector.serviceId} status`, () => {
      const service = getServiceById(vector.serviceId)
      expect(service).toBeDefined()
      expect(buildServiceStatus(service!, vector.configuredKeys)).toEqual(vector.expected)
    })
  }
})
