# How to create custom decorators

This guide shows how to build named decorators on top of `metadata` and `metadataParam`, keep their keys private, restrict where they apply, and accumulate values. It assumes you have used `Reflect.metadata` before; if not, start with [Getting started](../tutorials/getting-started.md).

## Wrap a key in a decorator factory

Return the decorator that `metadata` creates. The key stays inside the module:

```ts
import { Reflect } from '@esliph/metadata'

const ROUTE_KEY = 'http:route'

export function Route(path: string) {
  return Reflect.metadata(ROUTE_KEY, path)
}
```

For parameters, wrap `metadataParam` the same way:

```ts
export function Inject(index: number, token: string) {
  return Reflect.metadataParam(index, 'di:inject', token)
}
```

## Pair each decorator with a reader

Export a reader next to the decorator, so callers never handle the key:

```ts
export function getRoute(target: object, method: string | symbol) {
  return Reflect.getMetadata(ROUTE_KEY, target, method) as string | undefined
}
```

`getRoute(ReportsController, 'list')` and `getRoute(ReportsController.prototype, 'list')` read the same location.

## Choose keys that do not collide

- Prefix string keys with a namespace (`http:route`, `di:inject`), because every decorator that writes to the same store shares one key space per location.
- On members and parameters, two `Symbol` keys with the same description are the same key. Give each symbol a unique description, or use namespaced strings. See [Known limitations](../reference/known-limitations.md#symbol-keys-collide-by-description-on-members-and-parameters).

## Restrict where a decorator applies

`metadata` accepts any decorator context. To allow only methods, type the wrapper:

```ts
export function Route(path: string) {
  const decorate = Reflect.metadata(ROUTE_KEY, path)

  return (method: Function, context: ClassMethodDecoratorContext) => decorate(method, context)
}
```

Applying `@Route('/x')` to a field now fails to compile with `TS1240: Unable to resolve signature of property decorator`.

## Accumulate values instead of replacing them

`metadata` replaces the value stored under its key. To collect values from several decorators, read the current value and write a new one. On a class decorator, write directly with `defineMetadata`:

```ts
const ROLES_KEY = 'auth:roles'

export function Roles(...roles: string[]) {
  return (target: Function, _context: ClassDecoratorContext) => {
    const current = (Reflect.getOwnMetadata(ROLES_KEY, target) as string[] | undefined) ?? []

    Reflect.defineMetadata(ROLES_KEY, [...current, ...roles], target)
  }
}

@Roles('admin')
@Roles('auditor')
class ReportsController {}

Reflect.getMetadata(ROLES_KEY, ReportsController) // ['auditor', 'admin']
```

- Use `getOwnMetadata` to read the current value. `getMetadata` would return the parent's list, and the subclass would copy it into its own.
- Decorators run from the bottom up, so the lowest decorator adds its values first.

## Use a private store for a library

If the decorators belong to a library, create a `ReflectMetadata` instance for it instead of writing to the global `Reflect`. See [Isolate metadata in separate stores](isolate-metadata.md).
