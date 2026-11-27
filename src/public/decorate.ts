import { PropertyKey } from '@contracts/metadata'
import { assertValidTarget } from '@core/target'
import { ReflectMetadataErrorCode } from '@exceptions/code-errors'
import { InvalidTargetReflectMetadataException } from '@exceptions/invalid-target.exception'
import { ReflectMetadataException } from '@exceptions/reflect-dependency.exception'
import { isValidTarget } from '@utils/target'
import { toPropertyKey } from '@utils/property-key'

export function decorate(decorators: ClassDecorator[], target: Function): Function
export function decorate(
  decorators: (PropertyDecorator | MethodDecorator)[],
  target: Object,
  propertyKey: PropertyKey,
  attributes?: PropertyDescriptor | null
): PropertyDescriptor | undefined
export function decorate(decorators: any, target: any, propertyKey?: any, attributes?: any): any {
  if (!Array.isArray(decorators)) {
    throw new ReflectMetadataException(ReflectMetadataErrorCode.DECORATORS_INVALID, 'The decorators must be an array.')
  }

  if (propertyKey === undefined) {
    return decorateClass(decorators, target)
  }

  assertValidTarget(target)

  if (attributes !== undefined && attributes !== null && !isValidTarget(attributes)) {
    throw new ReflectMetadataException(ReflectMetadataErrorCode.DECORATOR_ATTRIBUTES_INVALID, 'The attributes must be an object, null or undefined.')
  }

  return decorateMember(decorators, target, toPropertyKey(propertyKey), attributes ?? undefined)
}

function decorateClass(decorators: Function[], target: unknown) {
  if (typeof target !== 'function') {
    throw new InvalidTargetReflectMetadataException(`The target of a class decorator must be a "function (class)", but a "${typeof target}" was received.`)
  }

  let current: Function = target

  for (let index = decorators.length - 1; index >= 0; index--) {
    const decorated = decorators[index](current)

    if (decorated === undefined || decorated === null) {
      continue
    }

    if (typeof decorated !== 'function') {
      throw new ReflectMetadataException(ReflectMetadataErrorCode.CLASS_DECORATOR_RESULT_INVALID, 'A class decorator must return a constructor, null or undefined.')
    }

    current = decorated
  }

  return current
}

function decorateMember(decorators: Function[], target: object, propertyKey: string | symbol, attributes: PropertyDescriptor | undefined) {
  let descriptor = attributes

  for (let index = decorators.length - 1; index >= 0; index--) {
    const decorated = decorators[index](target, propertyKey, descriptor)

    if (decorated === undefined || decorated === null) {
      continue
    }

    if (!isValidTarget(decorated)) {
      throw new ReflectMetadataException(ReflectMetadataErrorCode.MEMBER_DECORATOR_RESULT_INVALID, 'A member decorator must return an object, null or undefined.')
    }

    descriptor = decorated as PropertyDescriptor
  }

  return descriptor
}
