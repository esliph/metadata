export function ordinaryGetPrototypeOf(target: object): object | null {
  const proto = Object.getPrototypeOf(target)

  if (typeof target !== 'function' || target === Function.prototype || proto !== Function.prototype) {
    return proto
  }

  const prototype = (target as Function).prototype
  const prototypeProto = prototype && Object.getPrototypeOf(prototype)

  if (prototypeProto == null || prototypeProto === Object.prototype) {
    return proto
  }

  const constructor = prototypeProto.constructor

  if (typeof constructor !== 'function' || constructor === target) {
    return proto
  }

  return constructor
}
