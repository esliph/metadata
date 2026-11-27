# reflect-metadata parity (3.0.0) — design

Date: 2026-11-26. Status: draft for approval.

## Intent

`@esliph/metadata` exists as an alternative to `reflect-metadata` for projects on standard (TC39) decorators. Today it differs from `reflect-metadata` on purpose in several places, has a stale-cache bug and carries the limitations listed in `docs/reference/known-limitations.md`. Each difference is a bug for whoever migrates. Version 3.0.0 makes the library behave exactly like `reflect-metadata` 0.2.2 on every operation `reflect-metadata` has, keeps its own extensions (parameter metadata, isolated stores) where they do not conflict, and removes every registered defect and limitation.

Correction of a premise from the conversation: the Decorators proposal and the Decorator Metadata proposal are both at TC39 Stage 3 (not 2.7). Decorator Metadata (`context.metadata`, `Symbol.metadata`) is the mechanism this design uses for member decorators.

## Goals

1. Same observable behavior as `reflect-metadata` 0.2.2 for `defineMetadata`, `hasMetadata`, `hasOwnMetadata`, `getMetadata`, `getOwnMetadata`, `getMetadataKeys`, `getOwnMetadataKeys`, `deleteMetadata` and `decorate`, for every input `reflect-metadata` accepts or rejects.
2. Member decorators (`metadata`, `metadataParam`) record their metadata at class definition time. No instance is needed, and no instance rewrites it.
3. No stale result: every read reflects every write and delete made before it, on the target or on any object of its prototype chain.
4. Every item in `docs/reference/known-limitations.md` and in the "Known limitations" section of `CLAUDE.md` is fixed or, where parity makes it the correct behavior, removed from the list.
5. The package as published works: correct type entry, build using the intended config, tests run before publish.

## Non-goals

- Legacy decorators (`experimentalDecorators: true`) and the `design:type` / `design:paramtypes` / `design:returntype` metadata TypeScript emits only in that mode. Decided by the user.
- Installing methods on the global `Reflect` (the `import 'reflect-metadata'` side effect). Without legacy decorators nothing needs it. The library keeps exporting its own `Reflect` instance.
- Interop with the `reflect-metadata` 0.2 provider registry (`Reflect[Symbol.for('@reflect-metadata:registry')]`), which lets several copies of `reflect-metadata` share one store. It only matters together with the global `Reflect`.

## Anti-goals

- Any input on which the shared API returns or throws something different from `reflect-metadata` 0.2.2, unless this document lists it as an intended difference.
- A global side effect other than defining `Symbol.metadata` when the runtime lacks it.
- Metadata whose presence depends on whether an instance was created, or on the order of reads. The one stated exception is the class-decorator-body limitation below.

## Constraints

- Runtime: Node 20+ (publish workflow). Node 24.18 on the development host has no `Symbol.metadata` (`typeof Symbol.metadata === 'undefined'`, checked 2026-11-26).
- TypeScript ≥ 5.2 for consumers (first version with `context.metadata`). The repo uses 5.9.3.
- Build: `tsc` with `target: ES2019`, CommonJS, `experimentalDecorators: false` (`tsconfig.json`).
- Tests run through Vitest 4 / Vite 7, which transforms TypeScript with esbuild 0.25.12, not `tsc`.
- No runtime dependencies.

## Reference behavior

Source of truth: `reflect-metadata` 0.2.2, `Reflect.js`. Line numbers below are from that file (downloaded with `npm pack reflect-metadata` on 2026-11-26).

- Valid target (`IsObject`, line 687): `typeof x === 'object' && x !== null`, or `typeof x === 'function'`. Arrow, async, generator, async generator and bound functions are valid. Anything else throws `TypeError`.
- Property key (`ToPropertyKey`, line 758): a symbol stays a symbol; any other value becomes a string. `1` and `'1'` are the same member.
- Storage (lines 1040–1130): `target → propertyKey (undefined for the target itself) → metadataKey → value`. The target is used exactly as given: no class/prototype/instance normalization. Metadata keys are any value, compared with `Map` semantics.
- `hasOwnMetadata` is `map.has(key)`: a key defined with the value `undefined` is present.
- `getMetadata`/`hasMetadata` (lines 572–615): own lookup first; if the key is not present (`has`, not `!== undefined`), recurse into the parent given by `OrdinaryGetPrototypeOf`. An own `undefined` shadows the parent.
- `OrdinaryGetPrototypeOf` (line 844): `Object.getPrototypeOf(O)`, except for a function whose prototype is `Function.prototype` and whose `prototype` object inherits from something other than `Object.prototype`. There it returns that object's `constructor` (ES5-style subclass support).
- `getOwnMetadataKeys`: keys in insertion order. `getMetadataKeys` (line 616): own keys, then parent keys, deduplicated, own first.
- `deleteMetadata` (line 531, 1108): returns `true` if a key was removed, else `false`. Empty inner maps are removed.
- `defineMetadata` returns `undefined`.
- `decorate(decorators, target, propertyKey?, attributes?)` (lines 125–188, 546–571): validates arguments (`TypeError` on non-array decorators, invalid target, invalid attributes). Applies the decorators from last to first. The class form passes `(target)` and replaces the target with any non-null return, which must be a constructor. The member form passes `(target, propertyKey, descriptor)` and replaces the descriptor with any non-null return, which must be an object. Returns the final target or descriptor.

## Approaches considered (decorator write path)

1. **`context.metadata`, with the library defining `Symbol.metadata` when it is missing** — chosen by the user. The member decorator records into the class's metadata object at definition time. The store absorbs those records on first access to that class or its prototype. The only cost is one conditional global write.
2. **`context.metadata`, with the polyfill left to the consumer.** No global write, but one more setup line for every consumer, and a decorator that throws when `context.metadata` is missing.
3. **`context.addInitializer` (current).** Rejected: it is the cause of "metadata only after instantiation" and "each instance rewrites it", which this version removes.

`docs/explanation/architecture/design-decisions.md` recorded "no global side effect" as the reason for approach 3. That decision is reversed here and the page must say so.

The user also chose, earlier: parity with `reflect-metadata` semantics over keeping the current semantics with new APIs (breaking, 3.0.0), and standard decorators only over adding legacy decorator support.

## Design

### Storage

`MetadataContainer` keeps one `WeakMap<object, TargetMetadata>`. `TargetMetadata` holds:

- members: `Map<PropertyKey | undefined, Map<unknown, unknown>>`, where `undefined` is the target itself;
- parameters: `Map<PropertyKey | undefined, Map<number, Map<unknown, unknown>>>`, where `undefined` is the constructor.

No composite string keys. This removes the symbol-description and `|` collisions.

The exact data structure is left to the builder, as long as members and parameters cannot collide and empty maps are removed on delete.

### Target and key handling

- `isValidTarget` implements `IsObject`.
- `ReflectMetadataException`, the base of every library exception, extends `TypeError` instead of `Error`, so `instanceof TypeError` holds wherever `reflect-metadata` throws `TypeError`, and `instanceof ReflectMetadataException` keeps working. Every exception keeps a `code`. `decorate`'s argument errors (decorators not an array, invalid attributes, a class decorator returning a non-constructor, a member decorator returning a non-object) are library exceptions with new codes. My call, so that every error the library throws carries a code.
- `propertyKey` goes through `ToPropertyKey` when not `undefined`. `PropertyKey` in `src/contracts/metadata.ts` widens to `string | symbol | number` on input.
- `MetadataKey` widens to `unknown`, typed as in `reflect-metadata`'s `index.d.ts` (`metadataKey: any`).
- `normalizeTarget` is deleted. The target is used as given.

### Lookup

- Own reads query the target's maps only.
- Chain reads walk the chain with an `OrdinaryGetPrototypeOf` port, testing presence with `has`.
- The lookup cache (`lookupCache`, `NOT_FOUND`) is removed. Reason: with live prototype chains (`Object.setPrototypeOf`) and writes on any ancestor, a correct cache needs invalidation across every descendant, and `reflect-metadata` has none. Removing it costs one `WeakMap.get` plus one or two `Map.get` per chain level. [hypothesis] That cost is negligible at typical depths (≤ 5). No benchmark exists in the repo. If a consumer reports a lookup hot path, measure before adding any cache back.

### Parameter metadata (extension)

`defineMetadata(key, value, target, propertyKey, parameterIndex)` and the matching reads, `has*`, `getMetadataKeys`, `getOwnMetadataKeys` and `deleteMetadata` take an optional last `parameterIndex: number`. With `propertyKey === undefined` it means a constructor parameter of `target`. Lookup walks the chain the same way as member lookup. Without `parameterIndex`, every method behaves exactly as `reflect-metadata`.

### Decorators

`metadata(key, value)` and `metadataParam(index, key, value)` stay standard decorators with the same targets as today. The parameter form applies to a class (constructor) or a method.

- **Class:** the decorator receives the class and writes to it directly (target = class, `propertyKey = undefined`).
- **Member:** the decorator appends a record `{ placement: 'static' | 'instance', propertyKey: context.name, key, value, parameterIndex? }` to an own array stored on `context.metadata` under a symbol private to the container instance. Two `ReflectMetadata` instances never see each other's records. Because `context.metadata` inherits from the parent class's metadata object, the array must be own (`Object.hasOwn`), created when absent.
- **Missing `context.metadata`:** if `context.metadata` is `undefined` (a compiler that lowered the class before `Symbol.metadata` existed), the decorator throws a library exception with a new `ReflectMetadataErrorCode`. The message says to import `@esliph/metadata` before the decorated class is defined.
- **Absorbing records (drain):** at the start of every container operation, and at every level a chain walk visits, the container finds the owner class of the object being accessed. That is the object itself if it is a function, or `obj.constructor` if `obj` is an own `constructor`'s `prototype`. If the owner has an own `Symbol.metadata` object with an own records array, the container replays the records in order and then removes the array. Static records write to the owner, instance records to `owner.prototype`. Replaying before the requested operation keeps temporal order: decorators ran at definition, before any call the user makes.
- **Order:** records replay in decorator application order, so for two decorators on one member with the same key, the outermost wins, as with `reflect-metadata` under legacy `__decorate`.
- **Explicit writes win over later replay:** a replayed record never overrides a `defineMetadata` or `deleteMetadata` call on the same slot (target, property key, parameter index, metadata key) that happened after the decorator ran. Without this, a write made inside a class decorator body (before `Symbol.metadata` is attached) would be overwritten by the older decorator value at drain time. The mechanism (for example a per-container sequence number stamped on records and on explicit writes and deletes) is left to the builder.
- **Private members:** `metadata` and `metadataParam` on a private member (`context.private === true`) throw a library exception with a new `ReflectMetadataErrorCode`. Storing under `context.name` (`'#x'`) would collide with a public member named `'#x'`, and `reflect-metadata` has no private-member case to match. Decided by the user.
- **Replaced classes:** both `tsc` and esbuild attach `Symbol.metadata` to the final class a class decorator returns, so member records drain to that class and its prototype. A replacement that is a subclass of the original (`return class extends C {}`) sees class metadata written to the original through its chain. A replacement that is not a subclass (wrapper function, Proxy, unrelated class) does not see the class metadata written to the original. With `reflect-metadata` that metadata also stays on the original. This is documented, not fixed.
- Placement follows reflect-metadata's model: static members live on the class, instance members on the prototype. Static and instance members with the same name no longer share metadata.

### Known limitation that remains

Inside a class decorator's body, the member metadata of that same class is not visible yet, because `Symbol.metadata` is attached only after all class decorators run (verified with `tsc` 5.9.3 and esbuild 0.25.12 by the builder check, 2026-11-26). A read there returns what `reflect-metadata` would return before the member decorators ran, and `deleteMetadata` of a pending key returns `false`. Workaround: read inside `context.addInitializer`, which runs after the class definition completes. Decided by the user (documented limitation, no context-aware API). It is the one stated exception to anti-goal 3, and it goes to `docs/reference/known-limitations.md` and the migration guide.

### `Symbol.metadata`

A dedicated module (for example `src/polyfills/symbol-metadata.ts`) runs `Symbol.metadata ??= Symbol.for('Symbol.metadata')`. `Symbol.for` matches esbuild's fallback (`__knownSymbol`), so classes compiled by esbuild and by `tsc` share the key. The module is imported first by `src/index.ts` and by the module that defines the decorators, so any file that imports a decorator from the library defines the symbol before its classes are evaluated. `package.json` must not declare `"sideEffects": false`. If it declares `sideEffects`, the list must include the polyfill's output file.

Verified on 2026-11-26 with a spike: with `tsc` output (`target ES2019`) and no `Symbol.metadata`, `context.metadata` is `undefined` and `C[Symbol.metadata]` is not set. With esbuild output it works without any polyfill, using `Symbol.for('Symbol.metadata')`. Consequence: the Vitest suite cannot detect a missing or late polyfill (see Verification).

### Packaging and pipeline

- `package.json` `exports["."]`: `types` first, pointing to `./dist/index.d.ts`. Today it points to `./index.d.ts`, which is not in the package.
- `prepublishOnly` builds with `tsconfig.build.json`. Today `-p` reaches `tsc-alias`, not `tsc`.
- `npm run build` works on Windows shells (no bare `rm -rf`). The builder chooses how.
- The publish workflow runs lint, type check and the full test suite before `npm publish`.
- Version `3.0.0`.

### Other fixes

- Rename the test `static field decorator also stores metadata (initializer run on instantiation)` and its static-method sibling. Their behavior changes anyway.

## Intended differences from reflect-metadata

These remain and are documented in `docs/how-to/migrate-from-reflect-metadata.md`:

- The library exports its own `Reflect`. It does not patch the global one.
- Decorators are standard decorators. `metadata` does not work under `experimentalDecorators`, and no `design:*` metadata exists.
- `decorate` follows `reflect-metadata`'s legacy call shape, because that is its contract. It is a plain function call and does not require `experimentalDecorators`.
- Extensions: `parameterIndex`, `metadataParam`, isolated stores (`new ReflectMetadata()`), `MetadataContainer` export.
- Errors are library exceptions (`ReflectMetadataException` and subclasses, all `TypeError`s with a `code`).
- Member metadata is not visible inside a class decorator's body (see "Known limitation that remains").
- Decorators on private members throw.

## Verification

All commands must be in the repository and run in CI.

1. **Differential suite against `reflect-metadata`.** Add `reflect-metadata@0.2.2` as a devDependency, imported in its no-conflict form (`reflect-metadata/no-conflict`) so that it does not patch the global. A table of scenarios runs each operation on both implementations and asserts equal results or equal thrown error types. Scenarios: every valid and invalid target in `tests/common/types-target-list.ts`, symbol keys with equal descriptions, `|` in keys and members, numeric property keys, own `undefined` values, class vs prototype vs instance, static vs instance member names, ES5-style subclasses, `Object.setPrototypeOf` after a read, define/delete on a parent after a child read, key order in `getMetadataKeys`, and `decorate` in both forms with replacing and non-replacing decorators.
2. **Decorator suite (Vitest).** Metadata exists right after class definition with no instance. Creating instances does not rewrite it. Subclass reads see parent decorator metadata. Static and instance members are separate. Two `ReflectMetadata` instances are isolated. `deleteMetadata` after definition stays deleted after instantiation. A class decorated with `metadata` and also with a third-party class decorator that returns a subclass of it: class and member metadata are readable on the final class. A non-subclass replacement behaves as documented. A `defineMetadata` and a `deleteMetadata` made inside a class decorator body on a slot a member decorator also wrote: after the class is defined, the explicit call wins. A read inside the class decorator body behaves as the known limitation states, and the same read inside `context.addInitializer` sees the member metadata. A decorator on a private member throws.
3. **Emit test against `tsc` output.** A fixture with decorated classes is compiled by `tsc` with the build settings and run in a fresh Node process where `Symbol.metadata` was not predefined. It asserts that member metadata is present. This is the only check that covers the polyfill ordering, because esbuild hides it. It must run inside `npx vitest run` or as a script the CI runs.
4. `npx tsc -p tests/tsconfig.json --noEmit` and `npx eslint .` pass.
5. `npm pack --dry-run` lists `dist/index.d.ts`, and a consumer fixture resolves the types through `exports`.

## Documentation

Behavior changes update the pages in `docs/reference/` (`api.md`, `decorators.md`, `exceptions.md`, `metadata-locations.md`) and the README. Also:

- `docs/reference/known-limitations.md`: remove every fixed item. Add the class-decorator-body limitation with its workaround, and the non-subclass replacement behavior.
- `docs/explanation/`: `decorators-and-initializers.md`, `how-lookup-works.md` and `architecture/*` describe drain-on-access, the removed cache and the reversed side-effect decision.
- `docs/how-to/migrate-from-reflect-metadata.md`: the difference table shrinks to the intended differences above. The steps about key enumeration and instantiation-before-read are removed.
- `CLAUDE.md`: architecture, storage model, decorators and known limitations sections.

## Left to the builder

- Internal shape of `TargetMetadata` and of the decorator record.
- How the parameter extension appears in method signatures, as long as calls without it match `reflect-metadata` exactly.
- How `npm run build` becomes cross-platform.
- How the emit test spawns `tsc` and Node.
- Splitting the work into commits and tasks.
