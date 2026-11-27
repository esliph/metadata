# How to migrate from reflect-metadata

This guide shows how to move a TypeScript project from `reflect-metadata` and legacy decorators to `@esliph/metadata` and standard decorators. It assumes the project uses `Reflect.defineMetadata`, `Reflect.getMetadata` or `@Reflect.metadata` today.

The storage operations behave as in `reflect-metadata` 0.2.2: `defineMetadata`, `hasMetadata`, `hasOwnMetadata`, `getMetadata`, `getOwnMetadata`, `getMetadataKeys`, `getOwnMetadataKeys`, `deleteMetadata` and `decorate` return the same results, or both throw a `TypeError`. The differences are listed in step 4.

## 1. Replace the polyfill import

`reflect-metadata` adds methods to the global `Reflect`. This library does not. Remove the side-effect import and import `Reflect` in every module that uses it:

```ts
// before
import 'reflect-metadata'

// after
import { Reflect } from '@esliph/metadata'
```

A module that uses `Reflect.getMetadata` without the import no longer compiles.

Import the library before any decorated class is defined. The import defines `Symbol.metadata` when the runtime lacks it, and the decorators need it.

## 2. Switch to standard decorators

In `tsconfig.json`, remove `experimentalDecorators` and `emitDecoratorMetadata`, or set both to `false`. TypeScript 5.2 or later is required.

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

## 4. Review the differences

| Behavior                       | reflect-metadata                                          | @esliph/metadata                                                                                          |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Global `Reflect`               | `import 'reflect-metadata'` adds the methods              | Exports its own `Reflect`; the global one is untouched                                                    |
| Decorators                     | Legacy (`experimentalDecorators`), with `design:*` types  | Standard decorators only; no `design:*` metadata                                                          |
| `decorate`                     | Legacy call shape                                         | Same call shape. It is a plain function call and does not need `experimentalDecorators`                   |
| Extensions                     | —                                                         | `parameterIndex` as the last argument, `metadataParam`, isolated stores (`new ReflectMetadata()`), `MetadataContainer` export |
| Errors                         | `TypeError`                                               | `ReflectMetadataException` and subclasses: `TypeError`s with a `code`                                     |
| Member metadata in a class decorator body | Visible, because member decorators run first    | Not visible yet; read inside `context.addInitializer`. See [Known limitations](../reference/known-limitations.md#member-metadata-is-not-visible-inside-a-class-decorator-body) |
| Decorator on a private member  | Not applicable                                            | Throws `PRIVATE_MEMBER_UNSUPPORTED`                                                                       |

Search the code for class decorators that read member metadata of the class they decorate, and for decorators on private members, before switching.
