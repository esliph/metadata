# How metadata lookup works

Every call names a place: a class, a member, or a parameter. Before storing or reading anything, the library turns that place into two values: the object that owns the metadata and the key it is stored under. This page explains that translation, how inheritance falls out of it, and why reads are cached.

## A place is an object plus a key

The library keeps one map of metadata per object. A call resolves to one of those objects and to a key inside its map:

- Class metadata belongs to the class. Whatever you pass without a member name (the class, its prototype, an instance) resolves to the class itself, so `Reflect.getMetadata('role', new User())` reads what `@Reflect.metadata('role', ...)` wrote on `User`.
- Member metadata belongs to the prototype. Passing the class with a member name resolves to `Class.prototype`, which is where methods live in JavaScript. This is also why a static member and an instance member with the same name share metadata: both resolve to the prototype.
- Parameter metadata belongs to the same object as its member, and the parameter index becomes part of the key. Constructor parameters belong to the class.

Each object has one map. The class's map holds the class metadata and the constructor parameters; the prototype's map holds the members and their parameters. Because the member name and parameter index go into the key, entries of different members stay apart, except for the collisions listed in [Known limitations](../reference/known-limitations.md#member-names-and-keys-can-collide-after-joining). The full list of combinations is in [Metadata locations](../reference/metadata-locations.md).

## Inheritance comes from the prototype chain

JavaScript already links a subclass to its parent twice: `Sub` has `Base` as its prototype, and `Sub.prototype` has `Base.prototype` as its prototype. `getMetadata` uses those links. It looks in the map of the resolved object, and if the key is not there, it moves to `Object.getPrototypeOf(object)` and looks again, until the chain ends.

The library needs no inheritance logic of its own. Class metadata climbs from `Sub` to `Base`; member metadata climbs from `Sub.prototype` to `Base.prototype`. A subclass overrides a value by storing its own, and the parent keeps its value.

The `Own` variants (`getOwnMetadata`, `hasOwnMetadata`) skip the climb and answer only for the resolved object. They tell an inherited value from one stored on the object itself. For decorated instance members, "stored on the object" is not the same as "declared by the class": creating a subclass instance copies the parent's decorator values to the subclass prototype ([Decorators and initializers](decorators-and-initializers.md#how-a-member-decorator-reaches-the-class)).

## Reads are cached

Climbing the chain costs map lookups at each level, and frameworks read the same metadata many times: once per request, per instance or per injection. So `getMetadata` remembers each answer on the object it started from, including "not found". The next read of the same key on the same object costs a fixed number of map operations, whatever the inheritance depth.

The cache is cleared for an object when that object's own metadata changes. It is not cleared for the objects below it in the chain. A subclass that has already been read keeps its old answer after its parent changes. Class decorators and static-member decorators write when classes are defined, before reads usually start, so they do not cause it. It shows when `defineMetadata` or `deleteMetadata` change a parent after reads have started, and with instance-member decorators, which write at instantiation: a subclass read before the first instance caches "not found". [Known limitations](../reference/known-limitations.md#subclass-lookups-can-return-stale-values) has the details and a workaround.

## Weak references

Each map of metadata is held in a `WeakMap` keyed by its object. The store does not keep a class or an instance alive: when nothing else references it, the object and its metadata are collected together.

## Related pages

- [Decorators and initializers](decorators-and-initializers.md): when decorator metadata is written.
- [Storage model](architecture/storage-model.md): the same mechanism from the implementation side, with its costs.
