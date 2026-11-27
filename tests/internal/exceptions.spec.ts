import { describe, expect, test } from 'vitest'

import { InvalidTargetReflectMetadataException, ReflectMetadataErrorCode, ReflectMetadataException } from '@exceptions'

describe('Exceptions', () => {
  test('every library exception is a TypeError with a code', () => {
    const error = new InvalidTargetReflectMetadataException('message')

    expect(error).toBeInstanceOf(TypeError)
    expect(error).toBeInstanceOf(ReflectMetadataException)
    expect(error.code).toBe(ReflectMetadataErrorCode.TARGET_METADATA_INVALID)
  })
})
