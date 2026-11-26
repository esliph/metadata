# Exceptions

## ReflectMetadataException

```ts
class ReflectMetadataException extends Error {
  readonly code: ReflectMetadataErrorCode
}
```

Base class of the library's exceptions. `name` is `'Error'`; identify the exception with `instanceof` or `code`.

## InvalidTargetReflectMetadataException

```ts
class InvalidTargetReflectMetadataException extends ReflectMetadataException
```

| Property  | Value                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------- |
| `code`    | `ReflectMetadataErrorCode.TARGET_METADATA_INVALID`                                              |
| `message` | `The target must be a "function (class)" or an "object", but a "<typeof target>" was received.` |

Thrown by `defineMetadata`, `deleteMetadata`, `getMetadata`, `getOwnMetadata`, `hasMetadata` and `hasOwnMetadata` when `target` is not a valid target. The valid targets are listed in [Metadata locations](metadata-locations.md#valid-targets).

```ts
import { InvalidTargetReflectMetadataException, Reflect } from '@esliph/metadata'

try {
  Reflect.defineMetadata('key', 'value', () => {})
} catch (error) {
  error instanceof InvalidTargetReflectMetadataException // true
}
```

For an arrow function the message reads `but a "function" was received`, because the check reports `typeof target`.

## ReflectMetadataErrorCode

```ts
enum ReflectMetadataErrorCode {
  TARGET_METADATA_INVALID = 'TARGET_METADATA_INVALID',
}
```

| Member                    | Exception                               |
| ------------------------- | --------------------------------------- |
| `TARGET_METADATA_INVALID` | `InvalidTargetReflectMetadataException` |
