# Metadata locations

A location is the place where one value is stored for one key. The library derives it from `target`, `propertyKey` and `parameterIndex`. Different calls can resolve to the same location.

## Location table

| `target`                                         | `propertyKey`   | `parameterIndex` | Location                                                                          |
| ------------------------------------------------ | --------------- | ---------------- | --------------------------------------------------------------------------------- |
| Class                                            | —               | —                | Class                                                                             |
| Prototype or instance                            | —               | —                | Its class (`target.constructor`)                                                  |
| Class, prototype or instance                     | —               | `n`              | Constructor parameter `n` of the class                                            |
| Class                                            | `'constructor'` | `n`              | Constructor parameter `n` of the class                                            |
| Class                                            | `'constructor'` | —                | Member `constructor` of the class                                                 |
| Class                                            | member name     | —                | Member of `Class.prototype`                                                       |
| Prototype                                        | member name     | —                | Member of the prototype                                                           |
| Instance                                         | member name     | —                | Member of the instance itself                                                     |
| Class or prototype                               | member name     | `n`              | Parameter `n` of the member of `Class.prototype`                                  |
| Instance                                         | member name     | `n`              | Parameter `n` of the member of the instance itself                                |
| Object literal, array or other built-in object   | —               | —                | Its constructor (`Object`, `Array`, `Date`...), shared by every object it created |
| Object without prototype (`Object.create(null)`) | —               | —                | The object itself                                                                 |

## Equivalent calls

Each group reads and writes the same location:

| Location                                    | Calls                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Class metadata                              | `(key, Class)`, `(key, Class.prototype)`, `(key, new Class())`                                         |
| Member metadata                             | `(key, Class, 'name')`, `(key, Class.prototype, 'name')`                                               |
| Constructor parameter                       | `(key, Class, undefined, n)`, `(key, Class.prototype, undefined, n)`, `(key, Class, 'constructor', n)` |
| Static and instance member of the same name | `(key, Class, 'name')` for both                                                                        |

## Separate locations

These calls look alike but resolve to different locations:

| Call                          | Not the same as                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(key, instance, 'name')`     | `(key, Class.prototype, 'name')`. A value stored on the instance is not visible from the prototype. A value stored on the prototype is visible from the instance, through inheritance. |
| `(key, Class, 'constructor')` | `(key, Class)`                                                                                                                                                                         |
| `(key, Class, 'name')`        | `(key, Class)`                                                                                                                                                                         |
| `(key, Class, 'name', 0)`     | `(key, Class, 'name')`                                                                                                                                                                 |

## Inheritance

`getMetadata` and `hasMetadata` start at the location's object and follow `Object.getPrototypeOf` until they find the key:

| Location                           | Lookup order                                            |
| ---------------------------------- | ------------------------------------------------------- |
| Class                              | `Sub`, `Base`, `Function.prototype`, `Object.prototype` |
| Member or parameter on a prototype | `Sub.prototype`, `Base.prototype`, `Object.prototype`   |
| Member on an instance              | The instance, `Class.prototype`, parent prototypes      |

`getOwnMetadata`, `hasOwnMetadata`, `defineMetadata` and `deleteMetadata` use only the location's object.

## Valid targets

| Valid                                                                           | Invalid                                                                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Classes                                                                         | `null`, `undefined`                                                                     |
| Functions declared with `function`                                              | Booleans, numbers, strings, symbols, bigints                                            |
| Objects: instances, prototypes, arrays, `Date`, `Map`, frozen objects, literals | Arrow functions, `async` functions, generator functions, bound functions                |
|                                                                                 | Methods, such as `Class.prototype.find`: pass the prototype and the method name instead |

An invalid target throws [`InvalidTargetReflectMetadataException`](exceptions.md). `async` generator functions pass the check and are accepted, unlike other generator functions.
