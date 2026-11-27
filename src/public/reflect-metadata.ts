import '@polyfills/symbol-metadata'

import { MetadataKey, MetadataTarget, MetadataValue, PropertyKey } from '@contracts/metadata'
import { MetadataContainer } from '@core/container'
import { ReflectMetadataErrorCode } from '@exceptions/code-errors'
import { ReflectMetadataException } from '@exceptions/reflect-dependency.exception'
import { decorate } from '@public/decorate'
import { toPropertyKey } from '@utils/property-key'

export class ReflectMetadata {

  protected container = new MetadataContainer()

  defineMetadata(key: MetadataKey, value: MetadataValue, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.defineMetadata(key, value, target, propertyKey, parameterIndex)
  }

  deleteMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.deleteMetadata(key, target, propertyKey, parameterIndex)
  }

  getMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.getMetadata(key, target, propertyKey, parameterIndex)
  }

  getOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.getOwnMetadata(key, target, propertyKey, parameterIndex)
  }

  hasMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.hasMetadata(key, target, propertyKey, parameterIndex)
  }

  hasOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.hasOwnMetadata(key, target, propertyKey, parameterIndex)
  }

  decorate(decorators: ClassDecorator[], target: Function): Function
  decorate(
    decorators: (PropertyDecorator | MethodDecorator)[],
    target: Object,
    propertyKey: PropertyKey,
    attributes?: PropertyDescriptor | null
  ): PropertyDescriptor | undefined
  decorate(decorators: any, target: any, propertyKey?: any, attributes?: any): any {
    return decorate(decorators, target, propertyKey, attributes)
  }

  getMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.getMetadataKeys(target, propertyKey, parameterIndex)
  }

  getOwnMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number) {
    return this.container.getOwnMetadataKeys(target, propertyKey, parameterIndex)
  }

  metadata(metadataKey: MetadataKey, metadataValue: MetadataValue) {
    const container = this.container

    return (value: unknown, context: DecoratorContext) => {
      if (context.kind === 'class') {
        container.defineMetadata(metadataKey, metadataValue, value as Function)

        return
      }

      recordMemberMetadata(container, context, metadataKey, metadataValue, undefined)
    }
  }

  metadataParam(parameterIndex: number, metadataKey: MetadataKey, metadataValue: MetadataValue) {
    const container = this.container

    return (value: unknown, context: ClassDecoratorContext | ClassMethodDecoratorContext) => {
      if (context.kind === 'class') {
        container.defineMetadata(metadataKey, metadataValue, value as Function, undefined, parameterIndex)

        return
      }

      recordMemberMetadata(container, context, metadataKey, metadataValue, parameterIndex)
    }
  }
}

function recordMemberMetadata(
  container: MetadataContainer,
  context: Exclude<DecoratorContext, ClassDecoratorContext>,
  key: MetadataKey,
  value: MetadataValue,
  parameterIndex: number | undefined
) {
  if (context.private) {
    throw new ReflectMetadataException(
      ReflectMetadataErrorCode.PRIVATE_MEMBER_UNSUPPORTED,
      `The metadata decorators do not support private members, but "${String(context.name)}" is private.`
    )
  }

  if (context.metadata === undefined) {
    throw new ReflectMetadataException(
      ReflectMetadataErrorCode.DECORATOR_METADATA_UNAVAILABLE,
      'context.metadata is not available. Import "@esliph/metadata" before the decorated class is defined.'
    )
  }

  container.enqueueDecoratorRecord(context.metadata, {
    placement: context.static ? 'static' : 'instance',
    propertyKey: toPropertyKey(context.name),
    key,
    value,
    parameterIndex,
  })
}
