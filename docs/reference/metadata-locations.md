# Metadata locations

A location is the place where one value is stored for one key. The library derives it from `target`, `propertyKey` and `parameterIndex`. It uses `target` exactly as given: it never replaces a class, prototype or instance with another object.

## Location table

| `target`            | `propertyKey` | `parameterIndex` | Location                                                      |
| ------------------- | ------------- | ---------------- | ------------------------------------------------------------- |
| Any object          | —             | —                | The object itself                                             |
| Any object          | member name   | —                | Member of that object                                         |
| Any object          | —             | `n`              | Constructor parameter `n` of that object (a class, normally)  |
| Any object          | member name   | `n`              | Parameter `n` of the member of that object                    |

`propertyKey` goes through `ToPropertyKey`: a symbol stays a symbol, any other value becomes a string. `1` and `'1'` are the same member. Two symbols with the same description are different members.

Each location holds its own keys. Member and parameter locations of one object never collide with each other or with the object's own metadata.

## Common targets

| What you want                | Call                                       |
| ---------------------------- | ------------------------------------------ |
| Class metadata               | `(key, Class)`                             |
| Instance method or field     | `(key, Class.prototype, 'name')`           |
| Static method or field       | `(key, Class, 'name')`                     |
| Constructor parameter        | `(key, Class, undefined, n)`               |
| Method parameter             | `(key, Class.prototype, 'name', n)`        |
| Metadata of one instance     | `(key, instance)` or `(key, instance, 'name')` |

## Separate locations

These calls look alike and are all different:

| Call                       | Not the same as                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `(key, instance)`          | `(key, Class)` and `(key, Class.prototype)`. A value on the instance is not visible from the class.      |
| `(key, Class, 'name')`     | `(key, Class.prototype, 'name')`. Static and instance members with the same name are separate.           |
| `(key, Class, 'name')`     | `(key, Class)`                                                                                           |
| `(key, Class, 'name', 0)`  | `(key, Class, 'name')`                                                                                   |

## Inheritance

`getMetadata`, `hasMetadata` and `getMetadataKeys` start at the target and follow the prototype chain until the end:

| Target                    | Lookup order                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| Class                     | `Sub`, `Base`, `Function.prototype`, `Object.prototype`               |
| Prototype                 | `Sub.prototype`, `Base.prototype`, `Object.prototype`                 |
| Instance                  | The instance, `Class.prototype`, parent prototypes                    |

A key is present when it is stored, even with the value `undefined`. `getMetadata` and `hasMetadata` stop at the first level where the key is present, so an own `undefined` hides the parent's value.

For an ES5-style subclass, whose constructor does not inherit from its parent through `Object.setPrototypeOf`, the walk follows the `constructor` of its `prototype`'s prototype, as `reflect-metadata` does.

`getOwnMetadata`, `hasOwnMetadata`, `getOwnMetadataKeys`, `defineMetadata` and `deleteMetadata` use only the target.

## Valid targets

Valid: any object (`typeof` is `'object'` and not `null`) and any function. That includes classes, arrow, `async`, generator and bound functions, instances, prototypes, arrays, `Date`, `Map`, frozen objects, object literals, `Object.create(null)` and `Function.prototype`.

Invalid: `null`, `undefined`, booleans, numbers, strings, symbols and bigints. An invalid target throws [`InvalidTargetReflectMetadataException`](exceptions.md).
