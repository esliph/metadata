# Storage model

This page is for contributors. It describes the data structures of `MetadataContainer` (`src/core/container.ts`), the two functions that map a call onto them, the algorithm of each operation and what each one costs. Statements about cost come from reading the code; the repository has no benchmark, so none of them is measured.

## Data structures

```ts
storage: WeakMap<object, Map<compositeKey, value>>
lookupCache: WeakMap<object, Map<compositeKey, value | NOT_FOUND>>
```

- `storage` holds the metadata. The outer key is the owning object (a class, a prototype or another object). The inner map holds every entry of that object: class-level keys, member keys and parameter keys, distinguished by the composite key.
- `lookupCache` holds results of `getMetadata` (and therefore `hasMetadata`), keyed by the object the lookup started from. `NOT_FOUND` is a `protected static` `Symbol` that records a miss, so that a cached miss differs from "not cached".
- Both outer maps are `WeakMap`s: they do not keep the owning object alive. The inner `Map`s and the stored values live as long as the owning object.

## Mapping a call onto the structures

Every operation calls `normalizeTarget` first. `defineMetadata` and `getMetadata` then call `makeCompositeKey`; `getOwnMetadata` and `deleteMetadata` call it only after finding the object's inner map.

### normalizeTarget(target, propertyKey)

1. `assertValidTarget(target)` throws `InvalidTargetReflectMetadataException` unless the target is an object, or a function with a `prototype` whose constructor is not named `GeneratorFunction`. Async generator functions pass this check.
2. With a `propertyKey`:
   - a function resolves to `target.prototype`, except when `propertyKey` is `'constructor'`, which keeps the function;
   - an object stays as it is.
3. Without a `propertyKey`:
   - an object with a truthy `constructor` resolves to that constructor;
   - anything else stays as it is.

Step 2 makes static and instance members of the same name share one entry. Step 3 makes every object literal resolve to `Object`.

### makeCompositeKey(key, propertyKey, parameterIndex)

| `propertyKey` | `parameterIndex` | Composite key                                    |
| ------------- | ---------------- | ------------------------------------------------ |
| —             | —                | `key`, unchanged (a `Symbol` keeps its identity) |
| —             | `n`              | `'constructor\|param:n\|' + String(key)`         |
| `p`           | —                | `String(p) + '\|' + String(key)`                 |
| `p`           | `n`              | `String(p) + '\|param:n\|' + String(key)`        |

Converting to a string is what makes symbols with the same description collide, and what lets a `|` inside a name or key produce the same string as another combination. Both are listed in [Known limitations](../../reference/known-limitations.md#member-names-and-keys-can-collide-after-joining).

## Operations

| Operation                       | Algorithm                                                                                                                                                          | Work per call                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `defineMetadata`                | Normalize, get or create the inner map, `set` the composite key, delete the whole cache map of the normalized object.                                              | Validation, one string build for members and parameters, 1–2 `WeakMap` operations, 1 `Map.set`, 1 `WeakMap.delete`. |
| `getOwnMetadata`                | Normalize; return `undefined` if the object has no inner map; otherwise build the key and read it.                                                                 | Validation, one string build, 1 `WeakMap.get`, 1 `Map.get`.                                                         |
| `getMetadata`, cache hit        | Normalize, build the key, read the cache map.                                                                                                                      | As `getOwnMetadata`, plus `Map.has`.                                                                                |
| `getMetadata`, cache miss       | Walk `Object.getPrototypeOf` from the normalized object; at each level, check `storage`. Store the value or `NOT_FOUND` in the cache of the starting object.       | 1 `WeakMap.get` and 1 `Map.has` per level, plus one cache insertion.                                                |
| `hasMetadata`, `hasOwnMetadata` | Call the matching `get` and compare with `undefined`.                                                                                                              | Same as the `get`.                                                                                                  |
| `deleteMetadata`                | Normalize; return if the object has no inner map, without touching the cache; otherwise delete the composite key and the whole cache map of the normalized object. | Like `defineMetadata`, without creating maps.                                                                       |

Prototype chains in class hierarchies are short (a class chain ends at `Function.prototype` and `Object.prototype`), so the walk is bounded by the inheritance depth plus two.

## Cache invalidation

A cache entry on object `O` is correct only while no object on `O`'s prototype chain changes the entry's key. Writes invalidate only the object they write to, so the cache of a descendant is not cleared when an ancestor changes. That is the cause of [stale subclass lookups](../../reference/known-limitations.md#subclass-lookups-can-return-stale-values).

A write also discards every cached key of its object, not only the key it wrote.

## Interaction with decorators

A decorated instance member calls `defineMetadata` on the class prototype at every instantiation. Each call builds a composite key string and discards the prototype's cache map. For a class with `N` decorated instance members, one `new` performs `N` writes, and the next read of each key on that prototype walks the chain again.

This cost is an inference from the code. It matters only when instances are created often, for example one controller per request, and member metadata is read between creations. A benchmark that creates instances of a class with several decorated members, interleaved with `getMetadata` reads, would confirm or rule it out.

## Invariants

- Every object in `storage` and `lookupCache` is the result of `normalizeTarget`. The prototype walk reads intermediate objects directly from `storage`, without normalizing them.
- A value of `undefined` is stored like any other value, and `has*` reports it as absent.
- `getOwnMetadata` never reads or writes the cache.
