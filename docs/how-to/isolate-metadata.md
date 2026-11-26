# How to isolate metadata in separate stores

This guide shows how to keep metadata out of the global `Reflect` store: for a library that owns its keys, and for tests that must not share state. It assumes you know `defineMetadata` and `getMetadata`.

Every `ReflectMetadata` object is a separate store. Metadata written through one store is invisible to every other store, including the global `Reflect`.

## Create a store

```ts
import { Reflect, ReflectMetadata } from '@esliph/metadata'

const store = new ReflectMetadata()

class UserService {}

store.defineMetadata('scope', 'local', UserService)

store.getMetadata('scope', UserService) // 'local'
Reflect.hasMetadata('scope', UserService) // false
```

The store has the full API: `defineMetadata`, `getMetadata`, `getOwnMetadata`, `hasMetadata`, `hasOwnMetadata`, `deleteMetadata`, `metadata` and `metadataParam`.

## Give a library its own store

Create the store in one module and export only decorators and readers bound to it:

```ts
import { ReflectMetadata } from '@esliph/metadata'

const store = new ReflectMetadata()

export function Entity(table: string) {
  return store.metadata('orm:table', table)
}

export function getTable(target: object) {
  return store.getMetadata('orm:table', target) as string | undefined
}
```

A decorator writes to the store that created it. Read with the same store: `Reflect.getMetadata('orm:table', User)` returns `undefined` for a class decorated with `@Entity`.

## Isolate tests

Create a new store before each test, and declare the decorated classes inside the test, after the store exists:

```ts
import { beforeEach, expect, test } from 'vitest'

import { ReflectMetadata } from '@esliph/metadata'

let store: ReflectMetadata

beforeEach(() => {
  store = new ReflectMetadata()
})

test('reads class metadata', () => {
  @store.metadata('role', 'service')
  class UserService {}

  expect(store.getMetadata('role', UserService)).toBe('service')
})
```

- A store has no method that clears it. A new store is the only way to start empty.
- A class declared at module level is decorated once, with the store that existed at that moment. Declare it inside the test to bind it to the current store.
- Code under test that imports the global `Reflect` keeps writing to the global store. Declare a new class in each test so that tests do not see each other's metadata.

## When to keep the global store

Use the global `Reflect` when metadata must be shared across packages, for example when one library writes metadata that application code or another library reads.
