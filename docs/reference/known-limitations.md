# Known limitations

Current behaviors that differ from what most users expect. Each section gives the behavior, an example and a workaround. The examples import the library's store with `import { Reflect } from '@esliph/metadata'`.

## Member metadata is not visible inside a class decorator body

A member decorator records its metadata when the class is defined, and the store copies it the first time something touches the class. A class decorator body runs before the compiler attaches `Symbol.metadata` to the class, so the records are not reachable yet. A read there returns what `reflect-metadata` would return before the member decorators ran, and `deleteMetadata` of a pending key returns `false`.

```ts
const log: unknown[] = []

function inspect(value: any, context: ClassDecoratorContext) {
  log.push(Reflect.getMetadata('column', value.prototype, 'name')) // undefined

  context.addInitializer(function (this: any) {
    log.push(Reflect.getMetadata('column', this.prototype, 'name')) // 'user_name'
  })
}

@inspect
class User {
  @Reflect.metadata('column', 'user_name')
  name = ''
}
```

An explicit `defineMetadata` or `deleteMetadata` made inside the class decorator body still wins over the member decorator's value after the class is defined.

**Workaround:** read inside `context.addInitializer`, which runs after the class definition completes.

## A class decorator that returns an unrelated class drops class metadata written to the original

Member metadata follows the final class a class decorator returns. Class metadata written to the original class stays on the original. A replacement that is a subclass of the original sees that metadata through its prototype chain. A wrapper function, a `Proxy` or an unrelated class does not.

```ts
const replace = (_value: any): any => class Unrelated {}

@replace
@Reflect.metadata('role', 'service')
class Original {}

Reflect.getMetadata('role', Original) // undefined
```

The class name `Original` now refers to `Unrelated`, which has no metadata. `reflect-metadata` behaves the same way, because the metadata stays on the first class.

**Workaround:** put the `metadata` decorator above the decorator that replaces the class, so it runs after the replacement. Or make the replacement a subclass (`class extends value {}`).

## A decorated class created inside a class decorator loses its member metadata

A class decorator can return a class that has its own member decorators. The compiler then attaches the metadata object of the original class to the returned class, and the records of the returned class are not reachable any more. Reading them returns `undefined`.

```ts
let created: any

const wrap = (value: any): any =>
  (created = class extends value {
    @Reflect.metadata('flag', true)
    member() {}
  })

@wrap
class Original {}

Reflect.getMetadata('flag', created.prototype, 'member') // undefined
```

**Workaround:** define the decorated class outside the class decorator, or write the metadata with `defineMetadata` inside it.

