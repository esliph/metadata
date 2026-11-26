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
| `MetadataTarget`, `MetadataKey`, `MetadataValue`, `PropertyKey`                                 | types                      | [Types](#types)                         |
| `ReflectMetadataException`, `InvalidTargetReflectMetadataException`, `ReflectMetadataErrorCode` | classes, enum              | [Exceptions](exceptions.md)             |

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

| Parameter        | Type                         | Description                                                                                  |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `key`            | `string \| symbol`           | Metadata key.                                                                                |
| `target`         | `Function \| Object`         | Class, prototype, instance or other object. See [Metadata locations](metadata-locations.md). |
| `propertyKey`    | `string \| symbol`, optional | Member name. Omit for class or constructor-parameter metadata.                               |
| `parameterIndex` | `number`, optional           | Zero-based parameter index.                                                                  |

Every storage method throws [`InvalidTargetReflectMetadataException`](exceptions.md) when `target` is not a valid target.

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

Stores `value` at the location, replacing any previous value under `key`.

```ts
Reflect.defineMetadata('role', 'service', UserService)
```

### getMetadata

```ts
getMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any
```

Returns the value at the location or, if absent, the first value found along the prototype chain. Returns `undefined` when no value is found. Results are cached per target; see [Known limitations](known-limitations.md#subclass-lookups-can-return-stale-values).

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

Returns `true` when `getMetadata` returns a value other than `undefined`.

### hasOwnMetadata

```ts
hasOwnMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): boolean
```

Returns `true` when `getOwnMetadata` returns a value other than `undefined`.

### deleteMetadata

```ts
deleteMetadata(key: MetadataKey, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): void
```

Removes the value at the location. Values on other targets of the prototype chain stay. Does nothing when the location has no value.

```ts
Reflect.deleteMetadata('role', UserService)
```

### metadata

```ts
metadata(metadataKey: any, metadataValue: unknown): (value: any, context: DecoratorContext) => void
```

Returns a decorator that stores `metadataValue` under `metadataKey`. See [Decorators](decorators.md#metadata).

### metadataParam

```ts
metadataParam(param: number, metadataKey: any, metadataValue: unknown): (value: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) => void
```

Returns a decorator that stores `metadataValue` under `metadataKey` for parameter `param` of the constructor or of a method. See [Decorators](decorators.md#metadataparam).

### container

```ts
protected container: MetadataContainer
```

The storage behind the instance. Subclasses can read or replace it.

## MetadataContainer

```ts
class MetadataContainer
```

The storage engine. It has the same six storage methods as `ReflectMetadata`, with the same behavior, and no decorators. `ReflectMetadata` forwards every storage call to it.

The signatures differ in one parameter: `propertyKey` uses the built-in TypeScript `PropertyKey` (`string | number | symbol`), so the container also accepts numeric member names. A number is converted to a string, so `5` and `'5'` are the same member.

```ts
const container = new MetadataContainer()

container.defineMetadata('role', 'service', UserService)
container.getMetadata('role', UserService) // 'service'
```

## Types

| Type             | Definition           |
| ---------------- | -------------------- |
| `MetadataTarget` | `Function \| Object` |
| `MetadataKey`    | `string \| symbol`   |
| `MetadataValue`  | `unknown`            |
| `PropertyKey`    | `string \| symbol`   |

`PropertyKey` hides the built-in TypeScript `PropertyKey` (`string \| number \| symbol`) in modules that import it.
