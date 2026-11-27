# Exceptions

## ReflectMetadataException

```ts
class ReflectMetadataException extends TypeError {
  readonly code: ReflectMetadataErrorCode
}
```

Base class of the library's exceptions. It extends `TypeError`, so `error instanceof TypeError` holds wherever `reflect-metadata` throws a `TypeError`. Every exception the library throws carries a `code`. Dispatch on `code`: `decorate` and the decorators throw `ReflectMetadataException` itself, with no subclass per code.

## InvalidTargetReflectMetadataException

```ts
class InvalidTargetReflectMetadataException extends ReflectMetadataException
```

| Property  | Value                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| `code`    | `ReflectMetadataErrorCode.TARGET_METADATA_INVALID`                                              |
| `message` | `The target must be a "function (class)" or an "object", but a "<typeof target>" was received.` |

Thrown when `target` is not a valid target. The valid targets are listed in [Metadata locations](metadata-locations.md#valid-targets).

```ts
import { InvalidTargetReflectMetadataException, Reflect } from '@esliph/metadata'

try {
  Reflect.defineMetadata('key', 'value', 1 as any)
} catch (error) {
  error instanceof InvalidTargetReflectMetadataException // true
}
```

## ReflectMetadataErrorCode

```ts
enum ReflectMetadataErrorCode {
  TARGET_METADATA_INVALID = 'TARGET_METADATA_INVALID',
  DECORATORS_INVALID = 'DECORATORS_INVALID',
  DECORATOR_ATTRIBUTES_INVALID = 'DECORATOR_ATTRIBUTES_INVALID',
  CLASS_DECORATOR_RESULT_INVALID = 'CLASS_DECORATOR_RESULT_INVALID',
  MEMBER_DECORATOR_RESULT_INVALID = 'MEMBER_DECORATOR_RESULT_INVALID',
  DECORATOR_METADATA_UNAVAILABLE = 'DECORATOR_METADATA_UNAVAILABLE',
  PRIVATE_MEMBER_UNSUPPORTED = 'PRIVATE_MEMBER_UNSUPPORTED',
}
```

| Member                            | Thrown when                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `TARGET_METADATA_INVALID`         | A storage method or `decorate` receives a target that is not an object or function (`decorate`'s class form needs a function).    |
| `DECORATORS_INVALID`              | The first argument of `decorate` is not an array.                                                                                 |
| `DECORATOR_ATTRIBUTES_INVALID`    | The `attributes` argument of `decorate` is not an object, `null` or `undefined`.                                                  |
| `CLASS_DECORATOR_RESULT_INVALID`  | A decorator applied by `decorate`'s class form returns a value that is not `null`, `undefined` or a function.                     |
| `MEMBER_DECORATOR_RESULT_INVALID` | A decorator applied by `decorate`'s member form returns a value that is not `null`, `undefined` or an object.                     |
| `DECORATOR_METADATA_UNAVAILABLE`  | A member decorator runs with `context.metadata` undefined. Import `@esliph/metadata` before the decorated class is defined.       |
| `PRIVATE_MEMBER_UNSUPPORTED`      | `metadata` or `metadataParam` decorates a private member (`#name`).                                                               |
