# Decorators

Both decorators are methods of `ReflectMetadata`. The global `Reflect` and every other store have them. A decorator writes to the store that created it. The examples use `import { Reflect } from '@esliph/metadata'`.

They are standard (TC39) decorators. They require TypeScript 5.0 or later with `experimentalDecorators` disabled.

## metadata

```ts
metadata(metadataKey: any, metadataValue: unknown): (value: any, context: DecoratorContext) => void
```

Stores `metadataValue` under `metadataKey` on the decorated class or member.

| Applied to                                         | Written when                           | Read with                                    |
| -------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| Class                                              | The class is defined                   | `getMetadata(key, Class)`                    |
| Static method, field, accessor, getter or setter   | The class is defined                   | `getMetadata(key, Class, 'name')`            |
| Instance method, field, accessor, getter or setter | Every time an instance is created      | `getMetadata(key, Class.prototype, 'name')`  |
| Private member (`#name`)                           | As the static or instance member above | `getMetadata(key, Class.prototype, '#name')` |

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
Reflect.getMetadata('column', UserService.prototype, 'name') // undefined

new UserService()

Reflect.getMetadata('column', UserService.prototype, 'name') // 'user_name'
```

- Instance members write to the prototype of the class being instantiated. Creating an instance of a subclass writes to the subclass prototype.
- Each new instance writes the value again. A value removed with `deleteMetadata` or replaced with `defineMetadata` returns at the next instantiation.
- A static member and an instance member with the same name share one location. See [Known limitations](known-limitations.md#static-and-instance-members-with-the-same-name-share-metadata).
- With several decorators for the same key on one declaration, the top one wins, because decorators apply from the bottom up.

## metadataParam

```ts
metadataParam(param: number, metadataKey: any, metadataValue: unknown): (value: any, context: ClassDecoratorContext | ClassMethodDecoratorContext) => void
```

Stores `metadataValue` under `metadataKey` for the parameter at index `param` (zero-based). Applies to a class, for constructor parameters, or to a method, for that method's parameters. Applying it to a field or accessor is a compile error.

| Applied to      | Parameter of | Written when                      | Read with                                          |
| --------------- | ------------ | --------------------------------- | -------------------------------------------------- |
| Class           | Constructor  | The class is defined              | `getMetadata(key, Class, undefined, index)`        |
| Static method   | That method  | The class is defined              | `getMetadata(key, Class, 'name', index)`           |
| Instance method | That method  | Every time an instance is created | `getMetadata(key, Class.prototype, 'name', index)` |

```ts
@Reflect.metadataParam(0, 'inject', 'Logger')
class UserService {
  constructor(logger: unknown) {}

  @Reflect.metadataParam(0, 'param', 'id')
  find(id: string) {}
}

Reflect.getMetadata('inject', UserService, undefined, 0) // 'Logger'

new UserService(console)

Reflect.getMetadata('param', UserService.prototype, 'find', 0) // 'id'
```

The timing and overwrite rules of `metadata` apply to `metadataParam` too.
