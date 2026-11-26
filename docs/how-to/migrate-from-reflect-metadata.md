# How to migrate from reflect-metadata

This guide shows how to move a TypeScript project from `reflect-metadata` and legacy decorators to `@esliph/metadata` and standard decorators. It assumes the project uses `Reflect.defineMetadata`, `Reflect.getMetadata` or `@Reflect.metadata` today.

## 1. Replace the polyfill import

`reflect-metadata` adds methods to the global `Reflect`. This library does not. Remove the side-effect import and import `Reflect` in every module that uses it:

```ts
// before
import 'reflect-metadata'

// after
import { Reflect } from '@esliph/metadata'
```

A module that uses `Reflect.getMetadata` without the import no longer compiles.

## 2. Switch to standard decorators

In `tsconfig.json`, remove `experimentalDecorators` and `emitDecoratorMetadata`, or set both to `false`. TypeScript 5.0 or later is required.

Standard decorators do not emit `design:type`, `design:paramtypes` or `design:returntype`. Code that reads them, such as a dependency injector that resolves constructor types, needs explicit metadata instead (step 3).

## 3. Replace parameter decorators

Standard decorators have no parameter decorator. Move each one to the method or class with `metadataParam`, which takes the parameter index:

```ts
// before
class UserService {
  constructor(@Inject('Logger') logger: Logger) {}

  find(@Param('id') id: string) {}
}

// after
@Reflect.metadataParam(0, 'di:inject', 'Logger')
class UserService {
  constructor(logger: Logger) {}

  @Reflect.metadataParam(0, 'http:param', 'id')
  find(id: string) {}
}
```

Reads use the index as the last argument: `Reflect.getMetadata('di:inject', UserService, undefined, 0)`.

To replace `design:paramtypes`, store the constructor dependencies yourself, for example as one list on the class:

```ts
@Reflect.metadata('di:deps', [Logger, Database])
class UserService {
  constructor(logger: Logger, database: Database) {}
}

function create<T>(type: new (...args: any[]) => T): T {
  const deps = Reflect.getMetadata('di:deps', type) as Function[]

  return new type(...deps.map(resolve))
}

const service = create(UserService)
```

`resolve` is your container's function that returns an instance for a class.

## 4. Replace key enumeration

`getMetadataKeys` and `getOwnMetadataKeys` do not exist. Store one object under one key instead of many keys, or keep the list of keys in your own module:

```ts
const routeKeys = new Set<string>()

export function defineRouteMetadata(key: string, value: unknown, target: object, method: string) {
  routeKeys.add(key)
  Reflect.defineMetadata(key, value, target, method)
}

export function getRouteMetadataKeys(target: object, method: string) {
  return [...routeKeys].filter(key => Reflect.hasMetadata(key, target, method))
}
```

## 5. Read instance-member metadata after instantiation

With legacy decorators, metadata on instance members exists as soon as the class is defined. Here it is written when the first instance is created. Code that inspects a class at startup, before creating any instance, must either create an instance first or write the metadata with `defineMetadata`. See [Decorators and initializers](../explanation/decorators-and-initializers.md).

## 6. Review the behavior differences

| Behavior                                          | reflect-metadata                                                           | @esliph/metadata                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `defineMetadata(k, v, Class, 'member')`           | Stores on the class object, for a static member                            | Stores on `Class.prototype`; static and instance members of the same name share it                       |
| `getMetadata(k, instance)` with class metadata    | Not found: the lookup walks the instance's prototypes, not its constructor | Found: an instance without `propertyKey` resolves to its class                                           |
| `hasMetadata` on a key whose value is `undefined` | `true`                                                                     | `false`                                                                                                  |
| `deleteMetadata` return value                     | `boolean`                                                                  | `undefined`                                                                                              |
| Invalid target                                    | `TypeError`                                                                | `InvalidTargetReflectMetadataException`; arrow, `async`, generator and bound functions are also rejected |
| Key types                                         | Any value                                                                  | `string` or `symbol` (`MetadataKey`); the decorators accept `any`                                        |

Search the code for each row before switching: `hasMetadata` checks on `undefined` values, `deleteMetadata` results used as booleans, and static-member metadata that must stay separate from an instance member of the same name.
