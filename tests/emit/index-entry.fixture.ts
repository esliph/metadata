/* v8 ignore file -- @preserve */
import { Reflect } from '@index'

@Reflect.metadataParam(0, 'k', 'v')
class Base {
  @Reflect.metadata('k', 'v')
  instanceMethod() { }

  @Reflect.metadata('k', 'v')
  static staticField = 1

  @Reflect.metadataParam(0, 'k', 'v')
  methodParameter(parameter: unknown) { }

  static seen = Reflect.getMetadata('k', this.prototype, 'instanceMethod')
}

class Child extends Base { }

console.log(
  JSON.stringify({
    predefined: (globalThis as any).__symbolMetadataPredefined,
    instanceMethod: Reflect.getMetadata('k', Base.prototype, 'instanceMethod'),
    staticField: Reflect.getMetadata('k', Base, 'staticField'),
    methodParameter: Reflect.getMetadata('k', Base.prototype, 'methodParameter', 0),
    constructorParameter: Reflect.getMetadata('k', Base, undefined, 0),
    inherited: Reflect.getMetadata('k', Child.prototype, 'instanceMethod'),
    staticInitializer: Base.seen,
  })
)
