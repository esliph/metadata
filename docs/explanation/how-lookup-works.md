# How metadata lookup works

Every call names a place: a class, a member or a parameter. The library stores each place separately and, for reads that follow inheritance, walks the prototype chain. This page explains how a place is stored, how inheritance falls out of the prototype chain, and why there is no cache.

## A place is a target, a member and a parameter

The library keeps one `WeakMap` from each target to its metadata. The target is used exactly as the caller gave it: a class, a prototype and an instance are three different targets. A call selects one slot in that target's metadata:

- Without a member name and without a parameter index, the slot holds the target's own metadata.
- With a member name, the slot holds that member's metadata. The name goes through `ToPropertyKey`, so `1` and `'1'` are the same member and two symbols with equal descriptions are different members.
- With a parameter index, the slot holds that parameter's metadata. Without a member name it is a constructor parameter.

Each slot holds its own keys. A member named `'m'`, its parameter 0 and the target's own metadata never share keys. The full list of combinations is in [Metadata locations](../reference/metadata-locations.md).

By convention a class stores class metadata and static members, and `Class.prototype` stores instance members. A decorator follows that convention; the container does not enforce it.

## Inheritance comes from the prototype chain

`getMetadata`, `hasMetadata` and `getMetadataKeys` walk the chain starting at the target. At each level they look in that level's slot for the same member and parameter:

- `getMetadata` and `hasMetadata` stop at the first level where the key is present. Presence means the key is stored, even with the value `undefined`, so an own `undefined` hides the parent's value.
- `getMetadataKeys` visits every level and lists each key once. Keys of the target come first.

The next level comes from `OrdinaryGetPrototypeOf`, a port of the function in `reflect-metadata`. It returns `Object.getPrototypeOf(level)`, except for an ES5-style subclass: a function whose prototype is `Function.prototype` but whose `prototype` object inherits from another class. For it, the function returns that class, found through the `constructor` of the `prototype`'s prototype. With a native `class ... extends`, the plain prototype is the parent class.

A class chain is `Sub`, `Base`, `Function.prototype`, `Object.prototype`. A prototype chain is `Sub.prototype`, `Base.prototype`, `Object.prototype`. Objects without `Object.prototype`, such as `Object.create(null)`, end the chain.

The `Own` variants (`getOwnMetadata`, `hasOwnMetadata`, `getOwnMetadataKeys`) skip the walk and answer only for the target.

## There is no cache

Every read walks the chain, one `WeakMap` lookup and one or two `Map` lookups per level. Class chains are short, so the cost grows with inheritance depth, which is small in practice. No benchmark exists in the repository.

A cache would have to be invalidated for every descendant when an ancestor is written, and when `Object.setPrototypeOf` changes a chain. `reflect-metadata` has no cache either. Earlier versions of this library cached results per target and cleared only the written target, which returned stale values for subclasses. Measure before adding a cache back: a consumer with a hot lookup path is the reason to do it.

## Decorator records are copied during the walk

Member decorators record their metadata on the class when it is defined. The walk copies the records of a class or prototype the first time it reaches it. [Decorators and initializers](decorators-and-initializers.md#the-store-copies-the-records-on-first-access) explains the copy.

## Weak references

Each target's metadata is held in a `WeakMap` keyed by the target. The store does not keep a class or an instance alive: when nothing else references it, the object and its metadata are collected together.

## Related pages

- [Decorators and initializers](decorators-and-initializers.md): when decorator metadata is written.
- [Storage model](architecture/storage-model.md): the same mechanism from the implementation side, with its costs.
