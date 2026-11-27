# @esliph/metadata

Read and write metadata on classes, members and parameters, with standard TypeScript decorators and no runtime dependencies. A replacement for [`reflect-metadata`](https://www.npmjs.com/package/reflect-metadata) that does not patch the global `Reflect`.

```ts
import { Reflect } from '@esliph/metadata'

@Reflect.metadata('role', 'service')
class UserService {}

Reflect.getMetadata('role', UserService) // 'service'
```

## Features

- Metadata on classes, methods, fields, accessors, getters, setters, and method or constructor parameters.
- The same results as `reflect-metadata` 0.2.2 for `defineMetadata`, `hasMetadata`, `hasOwnMetadata`, `getMetadata`, `getOwnMetadata`, `getMetadataKeys`, `getOwnMetadataKeys`, `deleteMetadata` and `decorate`.
- Inheritance: `getMetadata`, `hasMetadata` and `getMetadataKeys` follow the prototype chain. The `Own` variants do not.
- Decorator metadata exists as soon as the class is defined. No instance is needed.
- Standard decorators, the TC39 proposal that TypeScript 5 implements (`experimentalDecorators: false`), including parameter metadata through `metadataParam`.
- Isolated stores: each `new ReflectMetadata()` has its own storage, separate from the global `Reflect` instance.
- Weak references: metadata does not keep its target alive.

## Requirements

- TypeScript 5.2 or later, with `experimentalDecorators` disabled, to use the decorators. The functional API (`defineMetadata`, `getMetadata`, ...) works without decorators.
- Import `@esliph/metadata` before the decorated classes are defined. The import defines `Symbol.metadata` when the runtime lacks it.
- The package ships CommonJS compiled to ES2019.

## Installation

```bash
npm install @esliph/metadata
```

## Usage

Write metadata with decorators or with `defineMetadata`, and read it with `getMetadata`:

```ts
import { Reflect } from '@esliph/metadata'

@Reflect.metadata('role', 'service')
@Reflect.metadataParam(0, 'inject', 'Logger')
class UserService {
  @Reflect.metadata('column', 'user_name')
  name = ''

  constructor(logger: unknown) {}

  @Reflect.metadata('route', '/users')
  @Reflect.metadataParam(0, 'inject', 'Request')
  list(request: unknown) {}
}

Reflect.getMetadata('role', UserService) // 'service'
Reflect.getMetadata('inject', UserService, undefined, 0) // 'Logger'
Reflect.getMetadata('column', UserService.prototype, 'name') // 'user_name'
Reflect.getMetadata('route', UserService.prototype, 'list') // '/users'
Reflect.getMetadata('inject', UserService.prototype, 'list', 0) // 'Request'
```

Static members are stored on the class and instance members on `UserService.prototype`. [Decorators and initializers](docs/explanation/decorators-and-initializers.md) explains how decorators record metadata.

The same locations without decorators:

```ts
Reflect.defineMetadata('role', 'service', UserService)
Reflect.defineMetadata('inject', 'Logger', UserService, undefined, 0)
Reflect.defineMetadata('column', 'user_name', UserService.prototype, 'name')
Reflect.defineMetadata('inject', 'Request', UserService.prototype, 'list', 0)
```

Importing `Reflect` from this package hides the native `Reflect` in that module. Use `import { Reflect as Metadata } from '@esliph/metadata'` when the module also needs the native one.

## Documentation

| Section                                              | Contents                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| [Getting started](docs/tutorials/getting-started.md) | Tutorial: build a small route table with decorators.                   |
| [How-to guides](docs/README.md#how-to-guides)        | Custom decorators, isolated stores, migration from `reflect-metadata`. |
| [Reference](docs/README.md#reference)                | API, decorators, metadata locations, exceptions, known limitations.    |
| [Explanation](docs/README.md#explanation)            | How lookup works, decorators and initializers, architecture.           |

## Known limitations

- Member metadata is not visible inside a class decorator body. Read it inside `context.addInitializer`.
- A class decorator that returns an unrelated class drops the class metadata written to the original.
- A decorated class created inside a class decorator loses its member metadata.

[Known limitations](docs/reference/known-limitations.md) gives an example and a workaround for each.

## Contributing

Architecture, storage model and local commands are in [docs/explanation/architecture](docs/explanation/architecture/overview.md) and [Develop the library](docs/how-to/develop-the-library.md).

## License

MIT
