# Decorators and initializers

Member decorators record their metadata when the class is defined, and the store copies the records the first time it touches the class. Earlier versions wrote member metadata through initializers, which is why this page still carries the name. This page explains what a standard decorator receives, how the library gets from a decorator to the class, and the one window where the metadata is not visible.

## What a standard decorator receives

TypeScript 5 implements the TC39 decorators proposal. A decorator is a function called with two arguments: the decorated value and a context object.

- A class decorator receives the class itself. `metadata` writes to it right away.
- A member decorator receives the member (the method, getter or setter function, `{ get, set }` for an `accessor`, or `undefined` for a field) and a context with its name and whether it is static. It does not receive the class or the prototype.

The legacy decorators (`experimentalDecorators`) worked differently: a member decorator received the prototype as its first argument and could write metadata immediately. Code written for `reflect-metadata` relies on that.

## How a member decorator reaches the class

The context offers two ways to reach the class:

- `context.addInitializer(fn)` registers a function the runtime calls later. For a static member it runs during class definition, with `this` set to the class. For an instance member it runs on every construction, with `this` set to the new instance.
- `context.metadata` (TypeScript 5.2 and later) is one plain object per class, shared by all the decorators of that class. The compiler attaches it to the class as `Class[Symbol.metadata]` after the class decorators have run. It inherits from the metadata object of the parent class.

`metadata` and `metadataParam` use `context.metadata`. Each member decorator appends a record to an array on that object, under a symbol private to the store that created the decorator. The record holds the placement (`'static'` or `'instance'`), the member name, the key, the value and the parameter index. Two stores never see each other's records.

Because `context.metadata` inherits from the parent's object, the array must be an own property of the object. Reading the inherited one would append to the parent's records.

## The store copies the records on first access

The store does not copy a record when the decorator runs: the class does not exist yet. Instead, every operation checks the object it touches, and every level of a prototype-chain walk checks its own object:

1. It finds the class that owns the object: the object itself when it is a function, or the `constructor` when the object is that constructor's `prototype`.
2. If that class has its own `Symbol.metadata` object with a records array, the store removes the array and replays the records in order. A static record is written to the class, an instance record to `Class.prototype`.
3. It then runs the operation.

The decorators ran at definition, before any call the user makes, so replaying first keeps temporal order. This is why `getMetadata(key, new Subject(), 'm')` finds the metadata even when it is the first call: the chain walk reaches `Subject.prototype` and copies its records before it reads.

Records replay in decorator order. For two decorators with the same key on one member, the top one runs last and wins, as with `reflect-metadata` under legacy decorators.

## An explicit write wins over a later replay

A `defineMetadata` or `deleteMetadata` call made after a decorator ran must not be overwritten when the store copies the older record. The store gives every record and every explicit write a sequence number, and a replayed record does not overwrite a write that has a higher number. The numbers are only kept while undrained records exist. The only moment an explicit write can happen before the records are copied is inside a class decorator body.

## The class decorator body does not see member metadata

The compiler attaches `Symbol.metadata` after it has run all class decorators. Inside a class decorator body, the class has no `Symbol.metadata` yet, so the store cannot find the records:

- A read returns what it would return before the member decorators ran.
- `deleteMetadata` of a pending key returns `false`.
- An explicit write or delete there still wins over the member decorator's value, through the sequence numbers above.

`context.addInitializer` on the class decorator runs after the class definition completes, when `Symbol.metadata` is attached. Reading there sees the member metadata. [Known limitations](../reference/known-limitations.md#member-metadata-is-not-visible-inside-a-class-decorator-body) has an example.

## Symbol.metadata

Not every runtime defines `Symbol.metadata`. When it is missing, `tsc` emits code that leaves `context.metadata` undefined. The library defines it when it loads: `Symbol.metadata ??= Symbol.for('Symbol.metadata')`. `Symbol.for` is the key esbuild falls back to, so classes compiled by esbuild and by `tsc` share one symbol.

The definition must run before the decorated class is defined, so import the library before such classes. A member decorator that finds `context.metadata` undefined throws `DECORATOR_METADATA_UNAVAILABLE`. Vitest compiles with esbuild, which works without the polyfill, so a dedicated test compiles fixtures with `tsc` and runs them in a fresh process (`tests/emit`).

## Parameters have no decorator

The TC39 proposal has no parameter decorators. Writing `@Inject() logger: Logger` inside a parameter list is a syntax error with standard decorators. `metadataParam(index, key, value)` replaces it: it decorates the method, or the class for constructor parameters, and names the parameter by its position.

## Practical consequences

- Decorator metadata exists after the class definition. No instance is needed, and creating instances writes nothing.
- Private members cannot carry the decorators: their name (`'#x'`) would collide with a public member named `'#x'`.
- Read member metadata inside a class decorator through `context.addInitializer`.

## Related pages

- [Decorators](../reference/decorators.md): where each decorator stores its metadata.
- [Design decisions](architecture/design-decisions.md#record-member-metadata-through-contextmetadata): why `context.metadata` and not initializers.
