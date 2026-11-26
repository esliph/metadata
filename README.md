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
- Inheritance: `getMetadata` and `hasMetadata` follow the prototype chain. `getOwnMetadata` and `hasOwnMetadata` do not.
- Standard decorators, the TC39 proposal that TypeScript 5 implements (`experimentalDecorators: false`), including parameter metadata through `metadataParam`.
- Isolated stores: each `new ReflectMetadata()` has its own storage, separate from the global `Reflect` instance.
- Weak references: metadata does not keep its target alive.

## Requirements

- TypeScript 5.0 or later, with `experimentalDecorators` disabled, to use the decorators. The functional API (`defineMetadata`, `getMetadata`, ...) works without decorators.
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

new UserService(console)

Reflect.getMetadata('role', UserService) // 'service'
Reflect.getMetadata('inject', UserService, undefined, 0) // 'Logger'
Reflect.getMetadata('column', UserService.prototype, 'name') // 'user_name'
Reflect.getMetadata('route', UserService.prototype, 'list') // '/users'
Reflect.getMetadata('inject', UserService.prototype, 'list', 0) // 'Request'
```

Decorators on instance members write their metadata when an instance is created, and again for every new instance. Before the first instance, `getMetadata('column', UserService.prototype, 'name')` returns `undefined`. [Decorators and initializers](docs/explanation/decorators-and-initializers.md) explains why.

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

Some current behaviors differ from what most users expect. They include:

- Subclass lookups can return stale values after a parent changes.
- `Symbol` keys collide by description on members and parameters.
- Object literals share one location.
- Instance-member metadata appears only after instantiation.

[Known limitations](docs/reference/known-limitations.md) lists all of them, each with a workaround.

## Contributing

Architecture, storage model and local commands are in [docs/explanation/architecture](docs/explanation/architecture/overview.md) and [Develop the library](docs/how-to/develop-the-library.md).

## License

MIT
