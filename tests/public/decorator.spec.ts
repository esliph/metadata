import { beforeEach, describe, expect, test } from 'vitest'

import { ReflectMetadataErrorCode } from '@exceptions/code-errors'
import { ReflectMetadataException } from '@exceptions/reflect-dependency.exception'
import { ReflectMetadata } from '@public/reflect-metadata'

describe('ReflectMetadata decorator', () => {
  let reflect: ReflectMetadata

  beforeEach(() => {
    reflect = new ReflectMetadata()
  })

  test('class decorator define/get/has/delete', () => {
    @reflect.metadata('key', 'value')
    class Class { }

    expect(reflect.hasMetadata('key', Class)).toBe(true)
    expect(reflect.getMetadata('key', Class)).toBe('value')

    reflect.deleteMetadata('key', Class)
    expect(reflect.hasMetadata('key', Class)).toBe(false)
  })

  test('field decorator records metadata on the prototype at class definition', () => {
    class Field {
      @reflect.metadata('key', 'value')
      field: any
    }

    expect(reflect.getMetadata('key', Field.prototype, 'field')).toBe('value')
    expect(reflect.getOwnMetadata('key', Field, 'field')).toBeUndefined()
  })

  test('accessor, getter and setter decorators record metadata on the prototype at class definition', () => {
    class Field {
      @reflect.metadata('key', 'value')
      accessor propAccessor = ''

      @reflect.metadata('key', 'value')
      get propGet() { return }

      @reflect.metadata('key', 'value')
      set propSet(value: any) { }
    }

    expect(reflect.getMetadata('key', Field.prototype, 'propAccessor')).toBe('value')
    expect(reflect.getMetadata('key', Field.prototype, 'propGet')).toBe('value')
    expect(reflect.getMetadata('key', Field.prototype, 'propSet')).toBe('value')
  })

  test('method decorator records metadata on the prototype at class definition', () => {
    class Method {
      @reflect.metadata('key', 'value')
      method() { }
    }

    expect(reflect.getMetadata('key', Method.prototype, 'method')).toBe('value')
  })

  test('static field decorator records metadata on the class at definition', () => {
    class StaticField {
      @reflect.metadata('key', 'value')
      static field = ''
    }

    expect(reflect.getMetadata('key', StaticField, 'field')).toBe('value')
    expect(reflect.getMetadata('key', StaticField.prototype, 'field')).toBeUndefined()
  })

  test('static method decorator records metadata on the class at definition', () => {
    class StaticMethod {
      @reflect.metadata('key', 'value')
      static method() { }
    }

    expect(reflect.getMetadata('key', StaticMethod, 'method')).toBe('value')
    expect(reflect.getMetadata('key', StaticMethod.prototype, 'method')).toBeUndefined()
  })

  test('parameter decorator on a method records on the prototype', () => {
    class ParameterInMethod {
      @reflect.metadataParam(0, 'key', 'value')
      method(p: any) { }
    }

    expect(reflect.getMetadata('key', ParameterInMethod.prototype, 'method', 0)).toBe('value')
  })

  test('parameter decorator on a static method records on the class', () => {
    class ParameterInStaticMethod {
      @reflect.metadataParam(0, 'key', 'value')
      static test(p: any) { }
    }

    expect(reflect.getMetadata('key', ParameterInStaticMethod, 'test', 0)).toBe('value')
  })

  test('parameter decorator on the class records a constructor parameter', () => {
    @reflect.metadataParam(0, 'key', 'value')
    class ParameterInConstructor {
      constructor(a: any) { }
    }

    expect(reflect.getMetadata('key', ParameterInConstructor, undefined, 0)).toBe('value')
  })

  test('creating instances does not rewrite metadata', () => {
    class Subject {
      @reflect.metadata('first', 'v1')
      a() { }

      @reflect.metadata('second', 'v2')
      b() { }
    }

    reflect.deleteMetadata('first', Subject.prototype, 'a')
    reflect.defineMetadata('second', 'changed', Subject.prototype, 'b')

    new Subject()
    new Subject()

    expect(reflect.hasMetadata('first', Subject.prototype, 'a')).toBe(false)
    expect(reflect.getMetadata('second', Subject.prototype, 'b')).toBe('changed')
  })

  test('a subclass reads parent decorator metadata', () => {
    class Parent {
      @reflect.metadata('key', 'value')
      m() { }
    }

    class Child extends Parent { }

    expect(reflect.getMetadata('key', Child.prototype, 'm')).toBe('value')
    expect(reflect.getOwnMetadata('key', Child.prototype, 'm')).toBeUndefined()
  })

  test('static and instance members with the same name are separate', () => {
    class Subject {
      @reflect.metadata('key', 'static')
      static m() { }

      @reflect.metadata('key', 'instance')
      m() { }
    }

    expect(reflect.getOwnMetadata('key', Subject, 'm')).toBe('static')
    expect(reflect.getOwnMetadata('key', Subject.prototype, 'm')).toBe('instance')
  })

  test('isolated stores do not see each other\'s decorator metadata', () => {
    const a = new ReflectMetadata()
    const b = new ReflectMetadata()

    class Subject {
      @a.metadata('key', 'value')
      m() { }
    }

    expect(b.getMetadata('key', Subject.prototype, 'm')).toBeUndefined()
    expect(b.getMetadataKeys(Subject.prototype, 'm')).toEqual([])
    expect(a.getMetadata('key', Subject.prototype, 'm')).toBe('value')
  })

  test('the outermost decorator wins for the same key', () => {
    class Subject {
      @reflect.metadata('key', 'outer')
      @reflect.metadata('key', 'inner')
      m() { }
    }

    expect(reflect.getMetadata('key', Subject.prototype, 'm')).toBe('outer')
  })

  test('a class replaced by a subclass keeps class and member metadata', () => {
    const replace = (value: any) => class extends value { }

    @replace
    @reflect.metadata('k', 'v')
    class Original {
      @reflect.metadata('m', 'x')
      method() { }
    }

    expect(reflect.getMetadata('k', Original)).toBe('v')
    expect(reflect.getMetadata('m', Original.prototype, 'method')).toBe('x')
  })

  test('a class replaced by an unrelated class loses class metadata written to the original', () => {
    const replace = (_value: any): any => class Unrelated { }

    @replace
    @reflect.metadata('k', 'v')
    class Original {
      @reflect.metadata('m', 'x')
      method() { }
    }

    expect(reflect.getMetadata('k', Original)).toBeUndefined()
    expect(reflect.getMetadata('m', Original.prototype, 'method')).toBe('x')
  })

  test('explicit writes inside a class decorator body win over member decorators', () => {
    const explicit = (value: any) => {
      reflect.defineMetadata('k', 'explicit', value.prototype, 'a')
      reflect.deleteMetadata('k', value.prototype, 'b')
    }

    @explicit
    class Subject {
      @reflect.metadata('k', 'decorated')
      a() { }

      @reflect.metadata('k', 'decorated')
      b() { }
    }

    expect(reflect.getMetadata('k', Subject.prototype, 'a')).toBe('explicit')
    expect(reflect.hasMetadata('k', Subject.prototype, 'b')).toBe(false)
  })

  test('a class decorator body does not see member metadata yet; addInitializer does', () => {
    const observed: Record<string, unknown> = {}

    const inspect = (value: any, context: ClassDecoratorContext) => {
      observed.bodyGet = reflect.getMetadata('k', value.prototype, 'a')
      observed.bodyDelete = reflect.deleteMetadata('k', value.prototype, 'b')

      context.addInitializer(function (this: any) {
        observed.initializerGet = reflect.getMetadata('k', this.prototype, 'a')
        observed.initializerHasB = reflect.hasMetadata('k', this.prototype, 'b')
      })
    }

    @inspect
    class Subject {
      @reflect.metadata('k', 'decorated')
      a() { }

      @reflect.metadata('k', 'decorated')
      b() { }
    }

    void Subject

    expect(observed).toEqual({ bodyGet: undefined, bodyDelete: false, initializerGet: 'decorated', initializerHasB: false })
  })

  test('a decorator on a private member throws', () => {
    const define = () => {
      class Subject {
        @reflect.metadata('k', 'v')
        #m() { }

        run() {
          this.#m()
        }
      }

      return Subject
    }

    expect(define).toThrow(ReflectMetadataException)
    expect(define).toThrow(expect.objectContaining({ code: ReflectMetadataErrorCode.PRIVATE_MEMBER_UNSUPPORTED }))
  })

  test('a member decorator throws when context.metadata is missing', () => {
    const context = { kind: 'method', name: 'm', static: false, private: false, metadata: undefined, addInitializer() { } } as any

    const run = () => reflect.metadata('k', 'v')(() => { }, context)

    expect(run).toThrow(expect.objectContaining({ code: ReflectMetadataErrorCode.DECORATOR_METADATA_UNAVAILABLE }))
    expect(run).toThrow('@esliph/metadata')
  })

  test('the first access through an instance sees member metadata', () => {
    class Subject {
      @reflect.metadata('k', 'v')
      m() { }
    }

    expect(reflect.getMetadata('k', new Subject(), 'm')).toBe('v')
  })

  test('key enumeration as the first access lists decorator keys', () => {
    class First {
      @reflect.metadata('k', 'v')
      m() { }
    }

    class Second {
      @reflect.metadata('k', 'v')
      m() { }
    }

    expect(reflect.getMetadataKeys(First.prototype, 'm')).toEqual(['k'])
    expect(reflect.getOwnMetadataKeys(Second.prototype, 'm')).toEqual(['k'])
  })

  test('a static field initializer of the decorated class sees member metadata', () => {
    class Plain {
      @reflect.metadata('k', 'v')
      m() { }

      static seen = reflect.getMetadata('k', this.prototype, 'm')
    }

    @reflect.metadata('class', 'c')
    class Decorated {
      @reflect.metadata('k', 'v')
      m() { }

      static seen = reflect.getMetadata('k', this.prototype, 'm')
    }

    expect(Plain.seen).toBe('v')
    expect(Decorated.seen).toBe('v')
  })

  test('computed member names keep their identity', () => {
    const symbolA = Symbol('same')
    const symbolB = Symbol('same')

    class Subject {
      @reflect.metadata('k', 'a')
      [symbolA]() { }

      @reflect.metadata('k', 'b')
      [symbolB]() { }

      @reflect.metadata('k', 'one')
      [1]() { }
    }

    expect(reflect.getOwnMetadata('k', Subject.prototype, symbolA)).toBe('a')
    expect(reflect.getOwnMetadata('k', Subject.prototype, symbolB)).toBe('b')
    expect(reflect.getOwnMetadata('k', Subject.prototype, 1)).toBe('one')
    expect(reflect.getOwnMetadata('k', Subject.prototype, '1')).toBe('one')
  })

  test('a chain walk through objects without Object.prototype does not throw', () => {
    class Subject {
      @reflect.metadata('k', 'v')
      m() { }
    }

    Object.setPrototypeOf(Subject.prototype, Object.create(null))

    expect(reflect.getMetadata('k', Subject.prototype, 'm')).toBe('v')
    expect(reflect.getMetadata('missing', Subject.prototype, 'm')).toBeUndefined()
  })

  test('static metadata of a class returned as a Proxy does not depend on the order of reads', () => {
    const proxify = (value: any): any => new Proxy(value, {})

    @proxify
    class ReadClassFirst {
      @reflect.metadata('k', 'v')
      static method() { }
    }

    @proxify
    class ReadPrototypeFirst {
      @reflect.metadata('k', 'v')
      static method() { }
    }

    const classFirst = reflect.getMetadata('k', ReadClassFirst, 'method')

    reflect.getOwnMetadataKeys(ReadPrototypeFirst.prototype)

    const prototypeFirst = reflect.getMetadata('k', ReadPrototypeFirst, 'method')

    expect(classFirst).toBe(prototypeFirst)
  })

  test('member metadata of a decorated subclass created inside a class decorator is lost', () => {
    let created: any

    const replace = (value: any): any => (created = class extends value {
      @reflect.metadata('k', 'v')
      member() { }
    })

    @replace
    class Original { }

    expect(reflect.getMetadata('k', created.prototype, 'member')).toBeUndefined()
  })
})
