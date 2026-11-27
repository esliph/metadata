# Storage model

This page is for contributors. It describes the data structures of `MetadataContainer` (`src/core/container.ts`), the algorithm of each operation and what each one costs. Statements about cost come from reading the code; the repository has no benchmark, so none of them is measured.

## Data structures

```ts
storage: WeakMap<object, TargetMetadata>

class TargetMetadata {
  members: Map<string | symbol | undefined, MetadataSlot>
  parameters: Map<string | symbol | undefined, Map<number, MetadataSlot>>
}

class MetadataSlot {
  values: Map<key, value>
  stamps: Map<key, number>
}
```

- `storage` holds the metadata. The outer key is the target exactly as the caller passed it. It is a `WeakMap`, so it does not keep the target alive. The inner maps and the stored values live as long as the target.
- `members` holds one slot per member name. The key `undefined` is the target itself.
- `parameters` holds one slot per member name and parameter index. The key `undefined` is the constructor, so `(target, undefined, 0)` is a constructor parameter.
- `values` holds the metadata of a slot, under the keys the caller used, compared with `Map` semantics. No string is built from the member name, the index or the key, so symbols keep their identity and nothing collides.
- `stamps` holds sequence numbers of explicit writes, only while undrained decorator records exist. See [Stamps](#stamps).

Removing the last key of a slot removes the slot, and removing the last slot removes the `TargetMetadata`, when its `stamps` are empty too.

## Operations

Every operation validates the target first (`assertValidTarget`), then converts a defined `propertyKey` with `toPropertyKey`. This order matches `reflect-metadata`.

| Operation                                           | Algorithm                                                                                                                       | Work per call                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `defineMetadata`                                    | Drain the target, get or create the slot, `values.set`, mark the write for stamps.                                              | 1–2 `WeakMap` operations, 1–2 `Map` operations.                                  |
| `getOwnMetadata`, `hasOwnMetadata`                  | Drain the target, read the slot of the target.                                                                                  | 1 `WeakMap.get`, 1–2 `Map` operations.                                           |
| `getOwnMetadataKeys`                                | Drain the target, copy the slot's keys.                                                                                         | As above, plus the number of keys.                                               |
| `getMetadata`, `hasMetadata`                        | Walk `ordinaryGetPrototypeOf` from the target; at each level, drain it and check the slot with `has`. Stop at the first match.  | 1 `WeakMap.get` and 1–2 `Map` operations per level.                              |
| `getMetadataKeys`                                   | Walk the whole chain; append each key not yet seen.                                                                             | The walk, plus a `Set` check per key.                                            |
| `deleteMetadata`                                    | Drain the target, `values.delete`, then remove the empty slot and the empty `TargetMetadata`. Returns whether a key was removed. | As `defineMetadata`.                                                             |

A class chain is short (it ends at `Function.prototype` and `Object.prototype`), so a walk is bounded by the inheritance depth plus two. There is no cache. See [How metadata lookup works](../how-lookup-works.md#there-is-no-cache).

## Decorator records and the drain

Member decorators call `enqueueDecoratorRecord(context.metadata, record)`. The container appends the record to an array that is an own property of `context.metadata`, under `recordsKey`, a symbol created per container. It stamps the record with the next sequence number and increments `pendingRecords`.

`drain(object)` runs at the start of every operation on the target and at every level of a chain walk:

1. It returns at once when `pendingRecords` is `0`: no store-wide record waits for a copy. A decorated class that nothing touched keeps the counter above `0`, so then every operation continues with the steps below.
2. `ownerOf(object)` finds the class: the object itself if it is a function, otherwise its own `constructor` data property when that is a function whose `prototype` is the object. It reads the property descriptor, so no getter runs, and it never calls `object.hasOwnProperty`, because the object may have no `Object.prototype`.
3. It reads the own `Symbol.metadata` property of the class. A subclass without decorators inherits `Symbol.metadata` from its parent through static inheritance, so only an own property counts.
4. If the metadata object has an own records array, the container removes it, decrements `pendingRecords` and replays the records in order: static records to the class, instance records to `Class.prototype`.

### Stamps

A replayed record writes `values.set(key, value)` unless the slot has a stamp for the key that is higher than the record's. Explicit `defineMetadata` and `deleteMetadata` calls write a stamp while `pendingRecords > 0` and drop it otherwise.

A record can replay over a write made after it only while its class is undrained. The only window for that is a class decorator body, which runs before `Symbol.metadata` is attached. With no pending record, no later record can target an existing slot, so no stamp is needed. A stamp can outlive its window: replaying never removes one, and a later explicit write drops it.

## Invariants

- The target used as a key of `storage` is always the object the caller passed, or `owner` / `owner.prototype` during a replay.
- A value of `undefined` is stored like any other value, and `has*` reports it as present.
- `pendingRecords` equals the number of records that sit in own arrays of `Symbol.metadata` objects and were not drained.
- The container never writes outside its own `WeakMap` and the `recordsKey` property of `context.metadata`.
