import { describe, expect, test } from 'vitest'

import { ordinaryGetPrototypeOf } from '@utils/prototype'

describe('ordinaryGetPrototypeOf', () => {
  test('returns the parent class of a class', () => {
    class Parent {}
    class Child extends Parent {}

    expect(ordinaryGetPrototypeOf(Child)).toBe(Parent)
  })

  test('returns the parent of an ES5-style subclass', () => {
    function Parent() {}
    function Child() {}

    Child.prototype = Object.create(Parent.prototype)
    Child.prototype.constructor = Child

    expect(ordinaryGetPrototypeOf(Child)).toBe(Parent)
  })

  test('returns Function.prototype for a plain function', () => {
    function F() {}

    expect(ordinaryGetPrototypeOf(F)).toBe(Function.prototype)
  })

  test('returns Object.prototype for Function.prototype', () => {
    expect(ordinaryGetPrototypeOf(Function.prototype)).toBe(Object.prototype)
  })

  test('returns Function.prototype when the prototype constructor is the function itself', () => {
    function Self() {}

    Self.prototype = Object.create({ constructor: Self })

    expect(ordinaryGetPrototypeOf(Self)).toBe(Function.prototype)
  })

  test('returns Object.prototype for a plain object', () => {
    expect(ordinaryGetPrototypeOf({})).toBe(Object.prototype)
  })

  test('returns null for an object without prototype', () => {
    expect(ordinaryGetPrototypeOf(Object.create(null))).toBeNull()
  })
})
