# Decorators

Both decorators are methods of `ReflectMetadata`. The global `Reflect` and every other store have them. A decorator writes to the store that created it. The examples use `import { Reflect } from '@esliph/metadata'`.

They are standard (TC39) decorators. They require TypeScript 5.2 or later with `experimentalDecorators` disabled, because they use `context.metadata`. Import the library before the decorated class is defined: the import defines `Symbol.metadata` when the runtime lacks it, and a decorator throws [`DECORATOR_METADATA_UNAVAILABLE`](exceptions.md) when `context.metadata` is missing.

## metadata

```ts
metadata(metadataKey: MetadataKey, metadataValue: MetadataValue): (value: unknown, context: DecoratorContext) => void
```

Stores `metadataValue` under `metadataKey` on the decorated class or member.

| Applied to                                         | Stored on         | Read with                                   |
| -------------------------------------------------- | ----------------- | ------------------------------------------- |
| Class                                              | The class         | `getMetadata(key, Class)`                   |
| Static method, field, accessor, getter or setter   | The class         | `getMetadata(key, Class, 'name')`           |
| Instance method, field, accessor, getter or setter | `Class.prototype` | `getMetadata(key, Class.prototype, 'name')` |

A class decorator writes when it runs. A member decorator records the metadata on `context.metadata` when the class is defined. The store copies the record the first time any operation touches the class or its prototype. No instance is needed, and creating instances does not write again.

```ts
@Reflect.metadata('role', 'service')
class UserService {
  @Reflect.metadata('column', 'user_name')
  name = ''

  @Reflect.metadata('cache', true)
  static create() {
    return new UserService()
  }
}

Reflect.getMetadata('role', UserService) // 'service'
Reflect.getMetadata('cache', UserService, 'create') // true
Reflect.getMetadata('column', UserService.prototype, 'name') // 'user_name'
```

- Static members live on the class, instance members on the prototype. A static and an instance member with the same name have separate metadata.
- A subclass reads the metadata of its parent through `getMetadata`. `getOwnMetadata` on the subclass prototype returns `undefined`.
- With several decorators for the same key on one declaration, the top one wins, because decorators apply from the bottom up.
- A decorator on a private member (`#name`) throws [`PRIVATE_MEMBER_UNSUPPORTED`](exceptions.md).
- A `defineMetadata` or `deleteMetadata` call made after the class is defined replaces the decorator's value for good.
- A class decorator body does not see the member metadata of its own class yet. See [Known limitations](known-limitations.md#member-metadata-is-not-visible-inside-a-class-decorator-body).

## metadataParam

```ts
metadataParam(parameterIndex: number, metadataKey: MetadataKey, metadataValue: MetadataValue): (value: unknown, context: ClassDecoratorContext | ClassMethodDecoratorContext) => void
```

Stores `metadataValue` under `metadataKey` for the parameter at index `parameterIndex` (zero-based). Applies to a class, for constructor parameters, or to a method, for that method's parameters. Applying it to a field or accessor is a compile error.

| Applied to      | Parameter of | Stored on         | Read with                                          |
| --------------- | ------------ | ----------------- | -------------------------------------------------- |
| Class           | Constructor  | The class         | `getMetadata(key, Class, undefined, index)`        |
| Static method   | That method  | The class         | `getMetadata(key, Class, 'name', index)`           |
| Instance method | That method  | `Class.prototype` | `getMetadata(key, Class.prototype, 'name', index)` |

```ts
@Reflect.metadataParam(0, 'inject', 'Logger')
class UserService {
  constructor(logger: unknown) {}

  @Reflect.metadataParam(0, 'param', 'id')
  find(id: string) {}
}

Reflect.getMetadata('inject', UserService, undefined, 0) // 'Logger'
Reflect.getMetadata('param', UserService.prototype, 'find', 0) // 'id'
```

The timing and overwrite rules of `metadata` apply to `metadataParam` too.
