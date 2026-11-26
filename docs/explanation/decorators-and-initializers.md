# Decorators and initializers

Class metadata is available as soon as the class is defined. Instance-member metadata appears only when the first instance is created. The difference comes from what a standard decorator receives, not from a choice in this library.

## What a standard decorator receives

TypeScript 5.0 implements the TC39 decorators proposal. A decorator is a function called with two arguments: the decorated value and a context object.

- A class decorator receives the class itself. `metadata` writes to it right away, during class definition.
- A member decorator receives the member (the method, getter or setter function, `{ get, set }` for an `accessor`, or `undefined` for a field) and a context with its name and whether it is static. It does not receive the class or the prototype.

The legacy decorators (`experimentalDecorators`) worked differently: a member decorator received the prototype as its first argument and could write metadata immediately. Code written for `reflect-metadata` relies on that.

## How a member decorator reaches the class

The context offers one way to reach the class: `context.addInitializer(fn)`, which registers an initializer, a function the runtime calls later:

| Member   | `fn` runs                | `this` is        |
| -------- | ------------------------ | ---------------- |
| Static   | During class definition  | The class        |
| Instance | During each construction | The new instance |

`metadata` and `metadataParam` register an initializer that calls `defineMetadata` with the member name and, as the target, `this` for static members (the class) or `this.constructor.prototype` for instance members. Both resolve to the class prototype, because a class with a member name resolves to its prototype ([Metadata locations](../reference/metadata-locations.md)). That is why static-member metadata exists at definition time, and instance-member metadata only after `new`.

Writing to `this.constructor.prototype`, and not to the prototype of the class where the decorator appears, has a consequence for inheritance. Creating an instance of a subclass writes the metadata to the subclass prototype. The subclass then owns a copy, and `getOwnMetadata` on the subclass prototype finds it.

## Every instance writes again

The initializer runs on every construction, so every `new` writes the same value to the same location. Writing is idempotent, so normal use sees no difference. Two effects become visible:

- A value removed with `deleteMetadata`, or replaced with `defineMetadata`, comes back at the next instantiation.
- Each write clears the lookup cache of that prototype. See [How metadata lookup works](how-lookup-works.md#reads-are-cached).

## Parameters have no decorator

The TC39 proposal has no parameter decorators. Writing `@Inject() logger: Logger` inside a parameter list is a syntax error with standard decorators. `metadataParam(index, key, value)` replaces it: it decorates the method, or the class for constructor parameters, and names the parameter by its position.

## Practical consequences

- Read instance-member metadata after creating an instance, or write it with `defineMetadata` when it must exist earlier.
- Prefer class decorators and static members for metadata that a framework reads at startup, before it creates instances.

## Related pages

- [Decorators](../reference/decorators.md): when each kind of decorator writes, and where.
- [Design decisions](architecture/design-decisions.md#write-member-metadata-through-initializers): why initializers and not another mechanism.
