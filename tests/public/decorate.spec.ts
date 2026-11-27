import { describe, expect, test } from 'vitest'

import { ReflectMetadataErrorCode } from '@exceptions/code-errors'
import { ReflectMetadataException } from '@exceptions/reflect-dependency.exception'
import { ReflectMetadata } from '@public/reflect-metadata'

function codeOf(run: () => unknown) {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ReflectMetadataException)

    return (error as ReflectMetadataException).code
  }

  return undefined
}

describe('ReflectMetadata decorate errors', () => {
  const reflect = new ReflectMetadata()

  test('decorators that are not an array carry DECORATORS_INVALID', () => {
    const code = codeOf(() => reflect.decorate({} as any, class Subject {}))

    expect(code).toBe(ReflectMetadataErrorCode.DECORATORS_INVALID)
  })

  test('invalid attributes carry DECORATOR_ATTRIBUTES_INVALID', () => {
    const code = codeOf(() => reflect.decorate([], class Subject {}.prototype, 'm', 1 as any))

    expect(code).toBe(ReflectMetadataErrorCode.DECORATOR_ATTRIBUTES_INVALID)
  })

  test('a class decorator returning a non-constructor carries CLASS_DECORATOR_RESULT_INVALID', () => {
    const code = codeOf(() => reflect.decorate([(() => ({})) as any], class Subject {}))

    expect(code).toBe(ReflectMetadataErrorCode.CLASS_DECORATOR_RESULT_INVALID)
  })

  test('a member decorator returning a non-object carries MEMBER_DECORATOR_RESULT_INVALID', () => {
    const code = codeOf(() => reflect.decorate([(() => 1) as any], class Subject {}.prototype, 'm'))

    expect(code).toBe(ReflectMetadataErrorCode.MEMBER_DECORATOR_RESULT_INVALID)
  })

  test('an invalid target in the class form carries TARGET_METADATA_INVALID', () => {
    const code = codeOf(() => reflect.decorate([], {} as any))

    expect(code).toBe(ReflectMetadataErrorCode.TARGET_METADATA_INVALID)
  })

  test('an invalid target in the member form carries TARGET_METADATA_INVALID', () => {
    const code = codeOf(() => reflect.decorate([], 1 as any, 'm'))

    expect(code).toBe(ReflectMetadataErrorCode.TARGET_METADATA_INVALID)
  })
})
