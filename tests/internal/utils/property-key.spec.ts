import { describe, expect, test } from 'vitest'

import { toPropertyKey } from '@utils/property-key'

const SYMBOL_KEY = Symbol('key')

describe('toPropertyKey', () => {
  test.each([
    [1, '1'],
    ['1', '1'],
    [SYMBOL_KEY, SYMBOL_KEY],
    [true, 'true'],
    [null, 'null'],
    [{ toString: () => 'x' }, 'x'],
    [{ toString: () => SYMBOL_KEY }, SYMBOL_KEY],
  ])('converts input #%# like ToPropertyKey', (input, expected) => {
    expect(toPropertyKey(input)).toBe(expected)
  })

  test('throws a TypeError when the object has no primitive form', () => {
    const input = { toString: () => ({}), valueOf: () => ({}) }

    expect(() => toPropertyKey(input)).toThrow(TypeError)
  })
})
