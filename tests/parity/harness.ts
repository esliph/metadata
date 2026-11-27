/* v8 ignore file -- @preserve */

// The oracle's store is process-global. Metadata keys are therefore created once per test, outside the scenario (shared by both runs and
// unique to the test), while targets are created inside the scenario so each run gets fresh objects. A scenario never returns a target:
// it returns values, booleans, key arrays or labels.
import * as oracleModule from 'reflect-metadata/no-conflict'
import { expect } from 'vitest'

import { ReflectMetadata } from '@public/reflect-metadata'

export type Outcome = { threw: false; value: unknown } | { threw: true; typeError: boolean }

export interface MetadataApi {
  defineMetadata(key: any, value: any, target: any, propertyKey?: any): unknown
  deleteMetadata(key: any, target: any, propertyKey?: any): unknown
  hasMetadata(key: any, target: any, propertyKey?: any): unknown
  hasOwnMetadata(key: any, target: any, propertyKey?: any): unknown
  getMetadata(key: any, target: any, propertyKey?: any): unknown
  getOwnMetadata(key: any, target: any, propertyKey?: any): unknown
  getMetadataKeys(target: any, propertyKey?: any): unknown
  getOwnMetadataKeys(target: any, propertyKey?: any): unknown
  decorate(decorators: any, target: any, propertyKey?: any, attributes?: any): unknown
}

export const oracle: MetadataApi = oracleModule

export function capture(run: () => unknown): Outcome {
  try {
    return { threw: false, value: run() }
  } catch (error) {
    return { threw: true, typeError: error instanceof TypeError }
  }
}

export function expectParity(scenario: (api: MetadataApi) => unknown) {
  const library = capture(() => scenario(new ReflectMetadata() as unknown as MetadataApi))
  const reference = capture(() => scenario(oracle))

  expect(library).toEqual(reference)
}
