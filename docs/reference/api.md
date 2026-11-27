# API

All names are exported from the package root:

```ts
import { Reflect, ReflectMetadata, MetadataContainer } from '@esliph/metadata'
```

| Export                                                                                          | Kind                       | Page section                            |
| ----------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------- |
| `Reflect`                                                                                       | `ReflectMetadata` instance | [Reflect](#reflect)                     |
| `ReflectMetadata`                                                                               | class                      | [ReflectMetadata](#reflectmetadata)     |
| `MetadataContainer`                                                                             | class                      | [MetadataContainer](#metadatacontainer) |
| `decorate`                                                                                      | function                   | [decorate](#decorate)                   |
| `MetadataTarget`, `MetadataKey`, `MetadataValue`, `PropertyKey`                                 | types                      | [Types](#types)                         |
| `ReflectMetadataException`, `InvalidTargetReflectMetadataException`, `ReflectMetadataErrorCode` | classes, enum              | [Exceptions](exceptions.md)             |

Importing the package defines `Symbol.metadata` when the runtime lacks it. This is the only global side effect.

## Reflect

```ts
const Reflect: ReflectMetadata
```

The global store, created once when the package loads. Importing it hides the native `Reflect` in the importing module; rename it with `import { Reflect as Metadata } from '@esliph/metadata'` to keep both.

## ReflectMetadata

```ts
class ReflectMetadata
```

A metadata store. Each instance owns a separate `MetadataContainer`.

Common parameters of the storage methods:

| Parameter        | Type                                   | Description                                                                                 |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `key`            | `any`                                  | Metadata key. Keys are compared like `Map` keys.                                            |
| `target`         | `Function \| Object`                   | Any object or function, used as given. See [Metadata locations](metadata-locations.md).     |
| `propertyKey`    | `string \| symbol \| number`, optional | Member name. A number becomes a string, so `1` and `'1'` are the same member.               |
| `parameterIndex` | `number`, optional, last argument      | Zero-based parameter index. Without `propertyKey`, it selects a constructor parameter.      |

Without `parameterIndex`, every method behaves as in `reflect-metadata` 0.2.2: same result, or both throw a `TypeError`. Every storage method throws [`InvalidTargetReflectMetadataException`](exceptions.md) when `target` is not an object or a function.

The examples below use the global `Reflect` from this package and these classes:

```ts
import { Reflect } from '@esliph/metadata'

class UserService {}
class AdminService extends UserService {}
```

### defineMetadata

```ts
defineMetadata(key: MetadataKey, value: MetadataValue, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): void
```

Stores `value` at the location, replacing any previous value under `key`. A value of `undefined` counts as present.

```ts
Reflect.defineMetadata('role', 'service', UserService)
```

### getMetadata

```ts
getMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any
```

Returns the value at the location or, if the key is not present, the first value found along the prototype chain. Returns `undefined` when no level has the key. A key that is present with the value `undefined` stops the walk. Every call reads the current state: there is no cache.

```ts
Reflect.getMetadata('role', AdminService) // 'service', inherited from UserService
```

### getOwnMetadata

```ts
getOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any
```

Returns the value stored at the location itself, or `undefined`. Does not read the prototype chain.

```ts
Reflect.getOwnMetadata('role', AdminService) // undefined
```

### hasMetadata

```ts
hasMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean
```

Returns `true` when the key is present at the location or at any level of the prototype chain.

### hasOwnMetadata

```ts
hasOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean
```

Returns `true` when the key is present at the location itself, even if its value is `undefined`.

### getMetadataKeys

```ts
getMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any[]
```

Returns the keys at the location, then the keys of each prototype level, without duplicates. Own keys come first, in insertion order.

```ts
Reflect.defineMetadata('kind', 'admin', AdminService)

Reflect.getMetadataKeys(AdminService) // ['kind', 'role']
```

### getOwnMetadataKeys

```ts
getOwnMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any[]
```

Returns the keys stored at the location itself, in insertion order.

```ts
Reflect.getOwnMetadataKeys(AdminService) // ['kind']
```

### deleteMetadata

```ts
deleteMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean
```

Removes the key at the location and returns `true`. Returns `false` when the key was not there. Values on other levels of the prototype chain stay.

```ts
Reflect.deleteMetadata('kind', AdminService) // true
Reflect.deleteMetadata('kind', AdminService) // false
```

### decorate

```ts
decorate(decorators: ClassDecorator[], target: Function): Function
decorate(decorators: (PropertyDecorator | MethodDecorator)[], target: Object, propertyKey: PropertyKey, attributes?: PropertyDescriptor | null): PropertyDescriptor | undefined
```

Applies `decorators` from last to first, with the call shape of `reflect-metadata`'s `decorate`. It is a plain function call and does not need `experimentalDecorators`. Also exported as a function from the package root.

- Class form: each decorator receives the target. A return value other than `null` or `undefined` must be a function and replaces the target. Returns the final target.
- Member form: each decorator receives `(target, propertyKey, descriptor)`. A return value other than `null` or `undefined` must be an object and replaces the descriptor. `null` attributes count as `undefined`. Returns the final descriptor.

```ts
const log: string[] = []

Reflect.decorate([() => void log.push('first'), () => void log.push('second')], UserService)

log // ['second', 'first']
```

Invalid arguments throw a [`ReflectMetadataException`](exceptions.md) with the matching code.

### metadata

```ts
metadata(metadataKey: MetadataKey, metadataValue: MetadataValue): (value: unknown, context: DecoratorContext) => void
```

Returns a decorator that stores `metadataValue` under `metadataKey`. See [Decorators](decorators.md#metadata).

### metadataParam

```ts
metadataParam(parameterIndex: number, metadataKey: MetadataKey, metadataValue: MetadataValue): (value: unknown, context: ClassDecoratorContext | ClassMethodDecoratorContext) => void
```

Returns a decorator that stores `metadataValue` under `metadataKey` for parameter `parameterIndex` of the constructor or of a method. See [Decorators](decorators.md#metadataparam).

## MetadataContainer

```ts
class MetadataContainer
```

The storage engine. It has the same storage methods as `ReflectMetadata`, with the same behavior, and no decorators. `ReflectMetadata` forwards every storage call to it.

```ts
const container = new MetadataContainer()

container.defineMetadata('role', 'service', UserService)
container.getMetadata('role', UserService) // 'service'
```

## Types

| Type             | Definition                 |
| ---------------- | -------------------------- |
| `MetadataTarget` | `Function \| Object`       |
| `MetadataKey`    | `any`                      |
| `MetadataValue`  | `unknown`                  |
| `PropertyKey`    | `string \| symbol \| number` |

`PropertyKey` hides the built-in TypeScript `PropertyKey` in modules that import it.
