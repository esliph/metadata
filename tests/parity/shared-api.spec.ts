import { describe, test } from 'vitest'

import { INVALID_TARGET_LIST, VALID_TARGET_LIST } from '@tests/common/types-target-list'
import { capture, expectParity } from '@tests/parity/harness'

describe('Parity with reflect-metadata: shared API', () => {
  test.each(VALID_TARGET_LIST.map(target => [target]))('every valid target accepts every operation (target #%#)', target => {
    const key = Symbol('valid-target')

    expectParity(api =>
      [undefined, 'p'].map(propertyKey => [
        api.defineMetadata(key, 'value', target, propertyKey),
        api.getMetadata(key, target, propertyKey),
        api.getOwnMetadata(key, target, propertyKey),
        api.hasMetadata(key, target, propertyKey),
        api.hasOwnMetadata(key, target, propertyKey),
        api.getMetadataKeys(target, propertyKey),
        api.getOwnMetadataKeys(target, propertyKey),
        api.deleteMetadata(key, target, propertyKey),
        api.deleteMetadata(key, target, propertyKey),
      ])
    )
  })

  test.each(INVALID_TARGET_LIST.map(target => [target]))('every invalid target throws on every operation (target #%#)', target => {
    const key = Symbol('invalid-target')

    expectParity(api => [
      capture(() => api.defineMetadata(key, 'value', target)),
      capture(() => api.getMetadata(key, target)),
      capture(() => api.getOwnMetadata(key, target)),
      capture(() => api.hasMetadata(key, target)),
      capture(() => api.hasOwnMetadata(key, target)),
      capture(() => api.getMetadataKeys(target)),
      capture(() => api.getOwnMetadataKeys(target)),
      capture(() => api.deleteMetadata(key, target)),
    ])
  })

  test('symbol keys with equal descriptions stay separate', () => {
    const keyA = Symbol('same')
    const keyB = Symbol('same')
    const memberA = Symbol('same')
    const memberB = Symbol('same')

    expectParity(api => {
      class Subject {}

      api.defineMetadata(keyA, 'a', Subject)
      api.defineMetadata(keyB, 'b', Subject)
      api.defineMetadata('key', 'member-a', Subject.prototype, memberA)
      api.defineMetadata('key', 'member-b', Subject.prototype, memberB)

      return [
        api.getOwnMetadata(keyA, Subject),
        api.getOwnMetadata(keyB, Subject),
        api.getOwnMetadataKeys(Subject),
        api.getOwnMetadata('key', Subject.prototype, memberA),
        api.getOwnMetadata('key', Subject.prototype, memberB),
      ]
    })
  })

  test('a pipe inside keys and member names does not collide', () => {
    expectParity(api => {
      class Subject {}

      api.defineMetadata('a|b', 'first', Subject.prototype, 'x')
      api.defineMetadata('b', 'second', Subject.prototype, 'x|a')

      return [
        api.getOwnMetadata('a|b', Subject.prototype, 'x'),
        api.getOwnMetadata('b', Subject.prototype, 'x|a'),
        api.getOwnMetadata('a|b', Subject.prototype, 'x|a'),
        api.getOwnMetadata('b', Subject.prototype, 'x'),
      ]
    })
  })

  test('numeric and string property keys are the same member', () => {
    expectParity(api => {
      class Subject {}

      api.defineMetadata('key', 'from-number', Subject.prototype, 1)
      api.defineMetadata('key', 'from-string', Subject.prototype, '2')

      return [
        api.getOwnMetadata('key', Subject.prototype, '1'),
        api.getOwnMetadata('key', Subject.prototype, 2),
        api.getOwnMetadataKeys(Subject.prototype, 1),
      ]
    })
  })

  test('an object property key converts like ToPropertyKey', () => {
    const symbolKey = Symbol('member')

    expectParity(api => {
      class Subject {}

      api.defineMetadata('key', 'value', Subject.prototype, { toString: () => symbolKey })

      return api.getOwnMetadata('key', Subject.prototype, symbolKey)
    })
  })

  test('an own undefined value shadows the parent value', () => {
    expectParity(api => {
      class Parent {}
      class Child extends Parent {}

      api.defineMetadata('key', 'parent', Parent)
      api.defineMetadata('key', undefined, Child)

      return [api.getMetadata('key', Child), api.hasMetadata('key', Child), api.hasOwnMetadata('key', Child), api.getMetadataKeys(Child)]
    })
  })

  test('class, prototype and instance are separate targets', () => {
    expectParity(api => {
      class Subject {}

      const instance = new Subject()

      api.defineMetadata('on-instance', 'i', instance)

      const afterInstance = [api.getMetadata('on-instance', Subject), api.getMetadata('on-instance', Subject.prototype), api.getMetadata('on-instance', instance)]

      api.defineMetadata('on-class', 'c', Subject)

      return [afterInstance, api.getMetadata('on-class', instance), api.getMetadata('on-class', Subject)]
    })
  })

  test('static and instance members with the same name are separate', () => {
    expectParity(api => {
      class Subject {}

      api.defineMetadata('key', 'static', Subject, 'm')
      api.defineMetadata('key', 'instance', Subject.prototype, 'm')

      return [api.getOwnMetadata('key', Subject, 'm'), api.getOwnMetadata('key', Subject.prototype, 'm')]
    })
  })

  test('an ES5-style subclass inherits through its prototype constructor', () => {
    expectParity(api => {
      function Parent() {}
      function Child() {}

      Child.prototype = Object.create(Parent.prototype)
      Child.prototype.constructor = Child

      api.defineMetadata('key', 'parent', Parent)

      return [api.getMetadata('key', Child), api.hasMetadata('key', Child), api.hasOwnMetadata('key', Child), api.getMetadataKeys(Child)]
    })
  })

  test('Object.setPrototypeOf after a read changes later reads', () => {
    expectParity(api => {
      const parent = {}
      const child = {}

      api.defineMetadata('key', 'parent', parent)

      const before = api.getMetadata('key', child)

      Object.setPrototypeOf(child, parent)

      return [before, api.getMetadata('key', child), api.getMetadataKeys(child)]
    })
  })

  test('define and delete on a parent after a child read are visible', () => {
    expectParity(api => {
      class Parent {}
      class Child extends Parent {}

      const first = api.getMetadata('key', Child)

      api.defineMetadata('key', 'parent', Parent)

      const second = api.getMetadata('key', Child)

      api.deleteMetadata('key', Parent)

      return [first, second, api.getMetadata('key', Child)]
    })
  })

  test('getMetadataKeys lists own keys first, then parent keys, without duplicates', () => {
    expectParity(api => {
      class Parent {}
      class Child extends Parent {}

      api.defineMetadata('a', 1, Parent)
      api.defineMetadata('b', 1, Parent)
      api.defineMetadata('c', 2, Child)
      api.defineMetadata('a', 2, Child)

      return [api.getMetadataKeys(Child), api.getOwnMetadataKeys(Child)]
    })
  })

  test('deleteMetadata returns whether a key was removed', () => {
    expectParity(api => {
      class Untouched {}
      class Subject {}

      api.defineMetadata('present', 1, Subject)

      return [
        api.deleteMetadata('present', Untouched),
        api.deleteMetadata('missing', Subject),
        api.deleteMetadata('present', Subject),
        api.getOwnMetadataKeys(Subject),
      ]
    })
  })

  test('defineMetadata returns undefined', () => {
    expectParity(api => api.defineMetadata('key', 'value', class Subject {}))
  })

  test('objects without Object.prototype work as targets and chain ends', () => {
    const key = Symbol('no-prototype')

    expectParity(api => {
      const root = Object.create(null)
      const child = Object.create(root)

      api.defineMetadata(key, 'root', root)
      api.defineMetadata(key, 'function-prototype', Function.prototype)

      const result = [
        api.getMetadata(key, root),
        api.getMetadata(key, child),
        api.getMetadataKeys(child),
        api.getMetadata(key, Function.prototype),
        api.getMetadataKeys(Function.prototype),
      ]

      api.deleteMetadata(key, Function.prototype)

      return result
    })
  })
})
