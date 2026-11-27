# Design decisions

This page is for contributors. It records the decisions that shape the library: what was chosen, what it gains, what it costs, the strongest alternative and the condition that would reopen the decision.

Version 3.0.0 made the library behave like `reflect-metadata` 0.2.2 on every operation both have. Several decisions of earlier versions changed for that reason, and this page records the new ones.

## Parity with reflect-metadata is the contract

**Decision.** The storage operations and `decorate` return what `reflect-metadata` 0.2.2 returns, or throw a `TypeError` where it does. A differential suite (`tests/parity`) runs each scenario on the library and on `reflect-metadata/no-conflict` and requires equal results.

**Gains.** Moving from `reflect-metadata` needs no review of storage semantics. Any difference found by the suite is a bug, not an opinion.

**Costs.** The library inherits the semantics it would not have chosen, such as a target used exactly as given and `hasOwnMetadata` true for an `undefined` value. `reflect-metadata` is a devDependency, used only as the oracle.

**Alternative.** Keep the earlier semantics (class and prototype normalization, a cache) and document the differences. Rejected: each difference was a bug for whoever migrates.

**Revisit when** `reflect-metadata` releases a version that changes a shared operation. Update the oracle and review the suite.

## Own store instead of a global polyfill

**Decision.** The library exports a `ReflectMetadata` instance named `Reflect` and never changes the native `Reflect`.

**Gains.** Two libraries can each keep a private store (`new ReflectMetadata()`), and tests can start from an empty one.

**Costs.** Every module imports `Reflect` explicitly, and the import hides the native `Reflect` in that module. Code written against the `reflect-metadata` global does not work unchanged.

**Alternative.** Patch `globalThis.Reflect`, as `reflect-metadata` does. It would give one shared store for the whole process and drop isolation.

**Revisit when** compatibility with code that expects the global API becomes a requirement. An opt-in entry point that installs the methods on the global would add it without changing the default.

### The one global side effect

Earlier versions listed "no global side effect" as a reason for their design. Version 3.0.0 reverses it for one case: the library defines `Symbol.metadata` when the runtime lacks it. The decorators need `context.metadata`, and `tsc` emits it only when that symbol exists. The definition is `Symbol.metadata ??= Symbol.for('Symbol.metadata')` and changes nothing when the runtime already has the symbol. The alternative was to ask every consumer to define the symbol, one more setup line for every project.

## Standard decorators instead of legacy decorators

**Decision.** The decorators follow the TC39 proposal (`experimentalDecorators: false`).

**Gains.** They work with the decorator model that TypeScript 5 enables by default and that JavaScript is standardizing.

**Costs.** Member decorators do not receive the prototype, so member metadata goes through `context.metadata` (next section). There are no parameter decorators, so parameters use `metadataParam` on the method or class. There is no `emitDecoratorMetadata`, so no `design:*` type metadata.

**Alternative.** Legacy decorators, which receive the prototype and allow parameter decorators. They are the TypeScript-specific variant that the standard replaces.

**Revisit when** a target user base still depends on legacy-only features such as `design:paramtypes`. A separate legacy entry point would serve it.

## Record member metadata through context.metadata

**Decision.** A member decorator appends a record to `context.metadata`. The store copies the records to the class or the prototype the first time any operation touches it.

**Gains.** Member metadata exists as soon as the class is defined. No instance is needed, and an instance never rewrites it. An explicit `deleteMetadata` or `defineMetadata` stays in effect.

**Costs.** It needs TypeScript 5.2, the `Symbol.metadata` definition above and a drain check on every operation. Inside a class decorator body, the member metadata of the same class is not visible yet.

**Alternative.** `context.addInitializer`, the earlier choice. It writes member metadata at every construction, so metadata appears only after the first instance, a deleted value returns at the next `new`, and each write had to invalidate a cache. Another alternative is leaving the definition of `Symbol.metadata` to the consumer.

**Revisit when** the supported Node versions provide `Symbol.metadata` natively, which would allow dropping the polyfill, or when a class decorator needs the member metadata of its own class, which needs a context-aware API.

## Nested maps instead of string composite keys

**Decision.** `storage` maps each target to a `TargetMetadata` with nested maps: member, parameter index, key ([Storage model](storage-model.md)).

**Gains.** Symbols keep their identity, a `|` collides with nothing and no string is built per call.

**Costs.** More `Map` objects per target, and more lookups per call than one flat map.

**Alternative.** One map per object with string keys, the earlier choice. It built a string on every member or parameter call, and symbols collided by description.

**Revisit when** a profile shows the lookups on a hot path.

## Targets are used as given

**Decision.** The container never replaces a class, prototype or instance with another object. Static members live on the class, instance members on the prototype.

**Gains.** The same behavior as `reflect-metadata`. Static and instance members with the same name are separate, and each object keeps its own metadata.

**Costs.** A caller must pass the class for class metadata and the prototype for instance members. `getMetadata(key, instance)` does not find class metadata.

**Alternative.** Resolve a class with a member name to its prototype and an instance to its class, the earlier choice. It let callers pass either object, made static and instance members share a location and made all object literals share `Object`.

**Revisit when** a caller needs metadata of a class instance without a member name to fall back to the class. A helper that passes the right object serves that without changing the container.

## No lookup cache

**Decision.** Reads walk the prototype chain every time ([How metadata lookup works](../how-lookup-works.md#there-is-no-cache)).

**Gains.** Every read reflects every write and delete on the target or on any object of its chain, and every `Object.setPrototypeOf`. There is no invalidation to get wrong.

**Costs.** A read costs map operations per chain level. [hypothesis] That cost is small at typical depths (5 or less). No benchmark exists.

**Alternative.** A store-wide version counter: every write increments it, and a cache entry is valid only with the current version. It also needs a prototype-change signal, which the language does not give.

**Revisit when** a consumer reports a lookup hot path. Measure before adding any cache back.

## Facade over a container

**Decision.** `ReflectMetadata` forwards storage calls to a `MetadataContainer` and adds the decorators and `decorate`. Both classes are exported.

**Gains.** Storage logic is tested directly (`tests/internal`), separate from the decorators (`tests/public`).

**Costs.** One forwarding call per operation, and two public classes with the same storage API to keep in sync.

**Alternative.** One class with storage and decorators. It removes the forwarding layer and halves the public surface, but the decorator code then sits next to the storage internals.

**Revisit when** the container needs a second consumer, which would justify the split, or stays without one, which would favor merging or not exporting it.
