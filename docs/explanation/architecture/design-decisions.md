# Design decisions

This page is for contributors. It records the decisions that shape the library: what was chosen, what it gains, what it costs, the strongest alternative and the condition that would reopen the decision.

The repository has no written rationale for these decisions. Each section describes the decision as the code shows it. The gains and costs are consequences visible in the code and tests; where a reason is inferred, the text says so.

## Own store instead of a global polyfill

**Decision.** The library exports a `ReflectMetadata` instance named `Reflect` and never changes the native `Reflect`.

**Gains.** Importing the package has no global side effect. Two libraries can each keep a private store (`new ReflectMetadata()`), and tests can start from an empty one.

**Costs.** Every module imports `Reflect` explicitly, and the import hides the native `Reflect` in that module. Code written against the `reflect-metadata` global does not work unchanged.

**Alternative.** Patch `globalThis.Reflect`, as `reflect-metadata` does. Rejected in effect: it would give one shared store for the whole process and drop isolation.

**Revisit when** compatibility with code that expects the global API becomes a requirement. An opt-in entry point that installs the methods on the global would add it without changing the default.

## Standard decorators instead of legacy decorators

**Decision.** The decorators follow the TC39 proposal (`experimentalDecorators: false`).

**Gains.** They work with the decorator model that TypeScript 5 enables by default and that JavaScript is standardizing.

**Costs.** Member decorators do not receive the prototype, so member metadata is written through initializers (next section). There are no parameter decorators, so parameters use `metadataParam` on the method or class. There is no `emitDecoratorMetadata`, so no `design:*` type metadata.

**Alternative.** Legacy decorators, which receive the prototype and allow parameter decorators. They are the TypeScript-specific variant that the standard replaces.

**Revisit when** a target user base still depends on legacy-only features such as `design:paramtypes`. A separate legacy entry point would serve it.

## Write member metadata through initializers

**Decision.** A member decorator registers `context.addInitializer`, which writes to the class (static) or to `this.constructor.prototype` (instance).

**Gains.** It works on every runtime that supports the TypeScript decorator output, with no global setup. Writing to `this.constructor.prototype` gives each subclass its own copy when it is instantiated.

**Costs.** Instance-member metadata exists only after the first instance, every instance writes it again, and every write discards the prototype's lookup cache ([Storage model](storage-model.md#interaction-with-decorators)).

**Alternative.** `context.metadata`, the decorator metadata object (TypeScript 5.2 and later), lets member decorators record data at class definition time, inherited through the metadata object's prototype. It requires `Symbol.metadata` at runtime; where the runtime does not provide it, someone must define it globally, which conflicts with the no-side-effect decision above. That conflict is the probable reason for the current choice (inferred).

**Revisit when** the supported Node versions provide `Symbol.metadata` natively. Definition-time member metadata would remove the instantiation requirement and the repeated writes.

## One map per object with string composite keys

**Decision.** `storage` maps each owning object to one `Map`. Member names, parameter indexes and keys are joined into one string key ([Storage model](storage-model.md#makecompositekeykey-propertykey-parameterindex)).

**Gains.** One structure per object, one lookup per level of the prototype chain, and a simple data layout.

**Costs.** A string is built on every member or parameter call. Symbols collide by description, and a `|` inside a name or key can collide with another combination.

**Alternative.** Nested maps: object → member → parameter → key, with the original values as keys. They keep symbol identity, cannot collide and build no strings, at the price of more `Map` objects per class and more lookups per call.

**Revisit when** a collision is reported by a user, or a profile shows key building on a hot path. Fixing the collisions requires this change or an escape scheme for the separator.

## Static and instance members share a location

**Decision.** `normalizeTarget` sends a class with a member name to `Class.prototype`, so `(Class, 'name')` and `(Class.prototype, 'name')` are the same location.

**Gains.** Callers can pass the class or the prototype for member metadata and get the same result.

**Costs.** A static member and an instance member with the same name overwrite each other ([Known limitations](../../reference/known-limitations.md#static-and-instance-members-with-the-same-name-share-metadata)).

**Alternative.** Keep static members on the class object, as `reflect-metadata` does. Callers would then have to pass the prototype for instance members.

**Revisit when** a user needs separate metadata on static and instance members with the same name.

## An object without a member name resolves to its class

**Decision.** Without `propertyKey`, `normalizeTarget` replaces an object by its `constructor`.

**Gains.** An instance or a prototype reads its class metadata directly: `getMetadata(key, instance)` works.

**Costs.** Every object literal resolves to `Object` and shares one location, as do all arrays (`Array`) and all objects of any other built-in constructor. Two instances of a class cannot hold different class-level metadata.

**Alternative.** Keep the object as it is and let the prototype walk find the class metadata. It would not find it: the walk from an instance passes through prototypes, never through the constructor.

**Revisit when** metadata on individual objects without a member name is needed. Resolving only class instances, and not plain objects, would remove the literal sharing.

## Per-object lookup cache

**Decision.** `getMetadata` caches results, including misses, on the starting object. A write clears the cache of its own object only.

**Gains.** A repeated read costs a fixed number of map operations, whatever the inheritance depth. Validation, normalization and the key string are still built on every read.

**Costs.** Descendants keep stale results after an ancestor changes ([Known limitations](../../reference/known-limitations.md#subclass-lookups-can-return-stale-values)).

**Alternative.** A store-wide version counter: every write increments it, and a cache entry is valid only if it carries the current version. Invalidation is correct and costs one integer comparison per read. Another alternative is no cache, since the chain walk is short.

**Revisit now.** The cost is a correctness defect, not a trade-off. Choosing between the version counter and removing the cache needs a benchmark of `getMetadata` hits and misses at realistic depths.

## Facade over a container

**Decision.** `ReflectMetadata` forwards storage calls to a `MetadataContainer` and adds the decorators. Both classes are exported.

**Gains.** Storage logic is tested directly (`tests/internal`), separate from the decorators (`tests/public`).

**Costs.** One forwarding call per operation, and two public classes with the same storage API to keep in sync.

**Alternative.** One class with storage and decorators. It removes the forwarding layer and halves the public surface, but the decorator code then sits next to the storage internals.

**Revisit when** the container needs a second consumer, which would justify the split, or stays without one, which would favor merging or not exporting it.
