# Known limitations

Current behaviors that differ from what most users expect. Each section gives the behavior, an example and a workaround. The examples import the library's store with `import { Reflect } from '@esliph/metadata'`.

## Subclass lookups can return stale values

`getMetadata` and `hasMetadata` cache each result on the target they were called with, including "not found". `defineMetadata` and `deleteMetadata` clear the cache of their own target only. A subclass that was already read keeps the old result after its parent changes.

```ts
class Base {}
class Sub extends Base {}

Reflect.defineMetadata('role', 'base', Base)
Reflect.getMetadata('role', Sub) // 'base'

Reflect.defineMetadata('role', 'changed', Base)
Reflect.getMetadata('role', Sub) // 'base'

Reflect.deleteMetadata('role', Base)
Reflect.hasMetadata('role', Sub) // true
```

The same happens with decorators on instance members. Reading `getMetadata(key, Sub.prototype, 'name')` before any instance exists caches "not found". Creating a `Base` instance later writes to `Base.prototype`, and the `Sub` read stays `undefined` until a `Sub` instance is created.

**Workaround:** write all metadata before the first read. If a parent must change later, read with `getOwnMetadata` along the chain, which has no cache:

```ts
const CHAIN_ROOTS: object[] = [Function.prototype, Object.prototype]

function getMetadataUncached(key: string | symbol, target: object, propertyKey?: string | symbol) {
  for (let current: object | null = target; current && !CHAIN_ROOTS.includes(current); current = Object.getPrototypeOf(current)) {
    if (Reflect.hasOwnMetadata(key, current, propertyKey)) return Reflect.getOwnMetadata(key, current, propertyKey)
  }

  return undefined
}
```

Pass the class for class metadata and the prototype for member metadata. The loop stops before `Function.prototype`, which is not a valid target and would throw.

## Symbol keys collide by description on members and parameters

On members and parameters, a `Symbol` key is stored as the string `String(symbol)`, which is `'Symbol(description)'`. Two symbols with the same description are the same key, and the plain string `'Symbol(description)'` is the same key too. The string `'description'` alone is a different key. On classes, without `propertyKey`, symbols keep their identity.

```ts
const a = Symbol('id')
const b = Symbol('id')

Reflect.defineMetadata(a, 1, User.prototype, 'name')
Reflect.getMetadata(b, User.prototype, 'name') // 1

Reflect.defineMetadata(a, 1, User)
Reflect.getMetadata(b, User) // undefined
```

**Workaround:** give every symbol key a unique description, or use namespaced string keys such as `'orm:column'`.

## Member names and keys can collide after joining

On members and parameters, the member name, the parameter index and the key are joined into one string, separated by `|`. Different combinations can produce the same string:

| First call                    | Collides with                            |
| ----------------------------- | ---------------------------------------- |
| Member `Symbol('m')`          | Any other member named `Symbol('m')`     |
| Member `'a'`, key `'b\|c'`    | Member `'a\|b'`, key `'c'`               |
| Class, key `'constructor\|k'` | Class, member `'constructor'`, key `'k'` |

```ts
Reflect.defineMetadata('b|c', 'value', User.prototype, 'a')
Reflect.getMetadata('c', User.prototype, 'a|b') // 'value'
```

**Workaround:** do not use `|` in keys or member names that carry metadata, and give symbol-named members unique descriptions.

## Object literals share one location

Without `propertyKey`, an object resolves to its constructor. For every object literal that constructor is `Object`, so all object literals share one location. The same applies to every object created by one constructor: all arrays share `Array`, all `Date` objects share `Date`, and all instances of a class share the class.

```ts
const first = {}
const second = {}

Reflect.defineMetadata('tag', 'first', first)
Reflect.getMetadata('tag', second) // 'first'
Reflect.getMetadata('tag', Object) // 'first'
```

**Workaround:** to keep metadata on one object, store it under a `propertyKey`, which keeps it on the object itself, or create the object with `Object.create(null)`, which has no constructor.

## Instance-member metadata exists only after instantiation

Decorators on instance members write their metadata when an instance is created, and write it again for every new instance. Before the first instance, reads return `undefined`. After `deleteMetadata` or `defineMetadata`, the next instance restores the decorator's value.

```ts
class User {
  @Reflect.metadata('column', 'user_name')
  name = ''
}

Reflect.getMetadata('column', User.prototype, 'name') // undefined

new User()

Reflect.getMetadata('column', User.prototype, 'name') // 'user_name'
```

**Workaround:** create an instance before reading, or write member metadata with `defineMetadata` when it must exist at definition time. [Decorators and initializers](../explanation/decorators-and-initializers.md) explains the cause.

## Static and instance members with the same name share metadata

A member name resolves to `Class.prototype` for both static and instance members. The static decorator writes when the class is defined, and the instance decorator overwrites it when an instance is created.

```ts
class Report {
  @Reflect.metadata('cache', 'instance')
  build() {}

  @Reflect.metadata('cache', 'static')
  static build() {}
}

Reflect.getMetadata('cache', Report, 'build') // 'static'

new Report()

Reflect.getMetadata('cache', Report, 'build') // 'instance'
```

**Workaround:** give static and instance members different names when both carry metadata under the same key.
