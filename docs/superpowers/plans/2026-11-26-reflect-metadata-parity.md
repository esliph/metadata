# reflect-metadata parity (3.0.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@esliph/metadata` 3.0.0 behave exactly like `reflect-metadata` 0.2.2 on every shared operation, record decorator metadata at class definition time, and ship a package whose types, build and publish pipeline work.

**Architecture:** `MetadataContainer` stores `target → member slot → metadata key → value` in nested `Map`s under one `WeakMap`, with no target normalization and no cache. Member decorators append records to `context.metadata` under a symbol private to the container; the container replays ("drains") those records the first time any operation touches the class or its prototype. A differential suite runs every scenario on the library and on `reflect-metadata/no-conflict` and requires equal results.

**Tech Stack:** TypeScript 5.9.3 (`tsc`, target ES2019, CommonJS), Vitest 4 / esbuild 0.25.12, `tsc-alias`, `reflect-metadata@0.2.2` (devDependency, test oracle only), Node 20+.

**Spec:** `docs/superpowers/specs/2026-11-26-reflect-metadata-parity-design.md`

## Global Constraints

- Work on a branch (for example `feat/reflect-metadata-parity`), never on `master`.
- No runtime dependencies. `reflect-metadata@0.2.2` is a devDependency, imported only as `reflect-metadata/no-conflict` (no global `Reflect` patch).
- Node 20+ at runtime; TypeScript ≥ 5.2 for consumers. Build: `tsc`, `target: ES2019`, CommonJS, `experimentalDecorators: false`.
- The only global side effect is `Symbol.metadata ??= Symbol.for('Symbol.metadata')` when the runtime lacks it.
- Never add `declare global` for `Symbol.metadata`: `lib.esnext.decorators.d.ts` declares it as its own `unique symbol`, and a second declaration in our `.d.ts` conflicts for consumers on `lib: esnext`. Read it through a local cast (`(Symbol as { metadata?: symbol }).metadata`). Verified 2026-11-26: with target ES2019, `Symbol.metadata` is a TS2550 error without a cast; `DecoratorMetadataObject` and `context.metadata` type-check.
- `ReflectMetadataException` extends `TypeError`; every exception the library throws carries a `ReflectMetadataErrorCode`.
- Calls without `parameterIndex` behave exactly as `reflect-metadata` 0.2.2: same result, or both throw a `TypeError`.
- Internal imports use the `@*` → `src/*` alias; tests may use `@tests/*`.
- Style: Prettier config of the repo (no semicolons, single quotes, 2 spaces, 160 columns) and the `code-style` rules: blank lines separate steps; a multi-line scope gets a blank line before and after; the lines that only feed a scope stay glued to it; tests have exactly three blocks (Arrange, Act, Assert); comments only for reasons, measurements, external constraints and non-local invariants.
- Every task ends green on: `npx vitest run`, `npx tsc -p tests/tsconfig.json --noEmit` (no output), `npx eslint .` (0 errors; the 3 existing semicolon warnings may stay).
- Commits: `type: Description` in English with the verb in the gerund (`feat: Creating ...`), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every temporary directory or file a step creates is removed by a named step of the same task.

## Review Focus

1. **First access through an instance.** `getMetadata(key, new C(), 'm')` is the first call that touches a decorated class: it must return the decorator value, because the chain walk drains `C` when it reaches `C.prototype`. Test in Task 4.
2. **First access through key enumeration.** `getMetadataKeys(C.prototype, 'm')` and `getOwnMetadataKeys` as the first call must list the decorator keys. Test in Task 4.
3. **Read inside a static field initializer of the decorated class.** `static seen = reflect.getMetadata('k', this.prototype, 'm')` must see the member metadata: both `tsc` and esbuild attach `Symbol.metadata` before static fields run, with and without a class decorator (verified 2026-11-26 in a scratch build). Tests in Task 4 (esbuild) and Task 5 (`tsc`).
4. **Computed member names.** Two members named by symbols with the same description stay separate; a member named `[1]` is read with `1` or `'1'`. Test in Task 4.
5. **Objects without `Object.prototype`.** `Object.create(null)` and `Function.prototype` as targets and as chain levels: no crash in owner resolution, results equal to `reflect-metadata`. Tests in Task 2 (parity) and Task 4 (drain walk).

---

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `src/exceptions/reflect-dependency.exception.ts`, `code-errors.ts` | `TypeError` base, new codes | 1 |
| `src/utils/property-key.ts` | `toPropertyKey` (ECMAScript `ToPropertyKey`) | 1 |
| `src/utils/prototype.ts` | `ordinaryGetPrototypeOf` (port of `reflect-metadata`'s) | 1 |
| `src/utils/target.ts` | `isValidTarget` = `IsObject` | 2 |
| `src/core/target-metadata.ts` | per-target slot tables | 2 |
| `src/core/container.ts` | operations, chain walk, keys, drain, stamps | 2, 4 |
| `src/core/decorator-record.ts` | record type | 4 |
| `src/polyfills/symbol-metadata.ts` | `Symbol.metadata` polyfill, `SYMBOL_METADATA` | 4 |
| `src/public/decorate.ts` | `decorate` | 3 |
| `src/public/reflect-metadata.ts` | facade, decorators | 2, 3, 4 |
| `tests/parity/*` | differential suite against `reflect-metadata` | 2, 3 |
| `tests/emit/*` | `tsc` emit test | 5 |
| `scripts/check-package.mjs`, `package.json`, `.github/workflows/publish.yml` | packaging and pipeline | 6 |
| `README.md`, `docs/**`, `CLAUDE.md` | documentation | 7, 8 |

---

### Task 1: TypeError-based exceptions and the two ECMAScript helpers

**Files:**
- Modify: `src/exceptions/reflect-dependency.exception.ts`, `src/exceptions/code-errors.ts`
- Create: `src/utils/property-key.ts`, `src/utils/prototype.ts`
- Test: `tests/internal/exceptions.spec.ts`, `tests/internal/utils/property-key.spec.ts`, `tests/internal/utils/prototype.spec.ts`

**Interfaces:**
- Produces:
  - `class ReflectMetadataException extends TypeError { constructor(readonly code: ReflectMetadataErrorCode, message: string) }` — concrete; Tasks 3 and 4 throw it directly with the new codes (no subclass per code: callers dispatch on `code`).
  - `enum ReflectMetadataErrorCode` gains `DECORATORS_INVALID`, `DECORATOR_ATTRIBUTES_INVALID`, `CLASS_DECORATOR_RESULT_INVALID`, `MEMBER_DECORATOR_RESULT_INVALID`, `DECORATOR_METADATA_UNAVAILABLE`, `PRIVATE_MEMBER_UNSUPPORTED` (value = name, like `TARGET_METADATA_INVALID`).
  - `toPropertyKey(key: unknown): string | symbol` in `src/utils/property-key.ts`.
  - `ordinaryGetPrototypeOf(target: object): object | null` in `src/utils/prototype.ts`.
  - `reflect-metadata@0.2.2` installed as a devDependency (used as the source to port here and as the oracle from Task 2).

- [ ] **Step 0: Install the oracle**

Run: `npm install --save-dev --save-exact reflect-metadata@0.2.2`
Expected: `package.json` devDependencies gain `"reflect-metadata": "0.2.2"`; `node_modules/reflect-metadata/ReflectNoConflict.js` and `no-conflict.d.ts` exist (the CommonJS `moduleResolution` of `tests/tsconfig.json` resolves `reflect-metadata/no-conflict` through that root `.d.ts`).

- [ ] **Step 1: Write the failing tests**

`tests/internal/exceptions.spec.ts`:

```ts
test('every library exception is a TypeError with a code', () => {
  const error = new InvalidTargetReflectMetadataException('message')

  expect(error).toBeInstanceOf(TypeError)
  expect(error).toBeInstanceOf(ReflectMetadataException)
  expect(error.code).toBe(ReflectMetadataErrorCode.TARGET_METADATA_INVALID)
})
```

`tests/internal/utils/property-key.spec.ts` — `test.each` over `[input, expected]`: `[1, '1']`, `['1', '1']`, `[symbol, symbol]`, `[true, 'true']`, `[null, 'null']`, `[{ toString: () => 'x' }, 'x']`, `[{ toString: () => symbol }, symbol]` (an object whose primitive is a symbol stays that symbol), with `expect(toPropertyKey(input)).toBe(expected)`. One more test: `toPropertyKey({ toString: () => ({}), valueOf: () => ({}) })` throws `TypeError`.

`tests/internal/utils/prototype.spec.ts`, one test each, `expect(ordinaryGetPrototypeOf(x)).toBe(y)`:
- `class Child extends Parent` → `Parent`
- ES5 subclass (`function Child() {}`, `Child.prototype = Object.create(Parent.prototype)`, `Child.prototype.constructor = Child`, `Parent` a plain function) → `Parent`
- a plain `function F() {}` → `Function.prototype`
- `Function.prototype` → `Object.prototype`
- self-reference (`function Self() {}`, `Self.prototype = Object.create({ constructor: Self })`) → `Function.prototype`
- `{}` → `Object.prototype`; `Object.create(null)` → `null`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/internal/exceptions.spec.ts tests/internal/utils --coverage.enabled=false`
Expected: FAIL — `TypeError` instance check fails; `property-key` and `prototype` modules not found.

- [ ] **Step 3: Implement**

- Base exception: `extends TypeError`. Target ES2019 emits native classes, so no `Object.setPrototypeOf` fix is needed.
- `toPropertyKey`: build `{ [key as PropertyKey]: true }` and return its only own key (`Object.getOwnPropertySymbols(holder)[0] ?? Object.keys(holder)[0]`). A computed property name runs the engine's own `ToPropertyKey`, which is exactly what `reflect-metadata` ports (`ToPrimitive` with hint string, then symbol or string). Record that reason in a one-line comment.
- `ordinaryGetPrototypeOf`: port `OrdinaryGetPrototypeOf` from `node_modules/reflect-metadata/ReflectNoConflict.js`: `Object.getPrototypeOf(O)`, except for a function other than `Function.prototype` whose proto is `Function.prototype`, whose `prototype` inherits from something other than `null`/`Object.prototype`, and whose `prototype`'s proto has a function `constructor` different from `O` — there return that `constructor`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/internal/exceptions.spec.ts tests/internal/utils --coverage.enabled=false`
Expected: PASS. Then the three global checks (Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/exceptions src/utils tests/internal
git commit -m "feat: Making exceptions TypeErrors and porting ToPropertyKey and OrdinaryGetPrototypeOf"
```

---

### Task 2: Container with reflect-metadata semantics, differential suite, parameter extension

**Files:**
- Modify: `src/contracts/metadata.ts`, `src/utils/target.ts`, `src/public/reflect-metadata.ts`
- Create: `src/core/target-metadata.ts`
- Rewrite: `src/core/container.ts`
- Modify tests: `tests/common/types-target-list.ts`, `tests/internal/metadata-class.spec.ts`, `tests/internal/metadata-parameter.spec.ts`
- Create tests: `tests/parity/harness.ts`, `tests/parity/harness.spec.ts`, `tests/parity/shared-api.spec.ts`

**Interfaces:**
- Consumes: `toPropertyKey`, `ordinaryGetPrototypeOf`, `assertValidTarget` (unchanged in `src/core/target.ts`).
- Produces:
  - `src/contracts/metadata.ts`: `MetadataTarget = Function | Object` (unchanged), `MetadataKey = any`, `MetadataValue = unknown`, `PropertyKey = string | symbol | number`.
  - `isValidTarget(target: unknown): target is MetadataTarget` — `typeof x === 'object' ? x !== null : typeof x === 'function'`.
  - `src/core/target-metadata.ts`:
    - `type StoredPropertyKey = string | symbol`
    - `class MetadataSlot { readonly values: Map<MetadataKey, MetadataValue>; readonly stamps: Map<MetadataKey, number>; get isEmpty(): boolean }` (`stamps` is used from Task 4)
    - `class TargetMetadata { getSlot(propertyKey: StoredPropertyKey | undefined, parameterIndex: number | undefined): MetadataSlot | undefined; getOrCreateSlot(...same): MetadataSlot; removeSlotIfEmpty(...same): void; get isEmpty(): boolean }` — members in `Map<StoredPropertyKey | undefined, MetadataSlot>`, parameters in `Map<StoredPropertyKey | undefined, Map<number, MetadataSlot>>`; `undefined` is the target itself / its constructor. Removing a slot also removes an emptied parameter map.
  - `MetadataContainer` (and the facade `ReflectMetadata`, same names and signatures, plain forwarding):
    - `defineMetadata(key: MetadataKey, value: MetadataValue, target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): void`
    - `deleteMetadata(key, target, propertyKey?, parameterIndex?): boolean`
    - `hasMetadata(...)` / `hasOwnMetadata(...)`: `boolean`; `getMetadata(...)` / `getOwnMetadata(...)`: `any`
    - `getMetadataKeys(target: MetadataTarget, propertyKey?: PropertyKey, parameterIndex?: number): any[]` / `getOwnMetadataKeys(...)`: `any[]`

- [ ] **Step 1: Write the harness and its self-test**

`tests/parity/harness.ts` exports:
- `type Outcome = { threw: false; value: unknown } | { threw: true; typeError: boolean }`
- `interface MetadataApi` — the 9 shared operations (`defineMetadata`, `deleteMetadata`, `hasMetadata`, `hasOwnMetadata`, `getMetadata`, `getOwnMetadata`, `getMetadataKeys`, `getOwnMetadataKeys`, `decorate`), every parameter `any`, every return `unknown`, `propertyKey` as last optional parameter (no `parameterIndex`).
- `oracle: MetadataApi` — `import * as oracle from 'reflect-metadata/no-conflict'`.
- `capture(run: () => unknown): Outcome`
- `expectParity(scenario: (api: MetadataApi) => unknown): void` — runs `scenario` once on `new ReflectMetadata()` (cast to `MetadataApi`; `decorate` arrives in Task 3) and once on `oracle`, captures both and `expect(library).toEqual(oracle)`.

Rule every parity test follows, written as a comment at the top of `harness.ts` because it is a non-local invariant: the oracle's store is process-global, so metadata keys are created once per test (outside the scenario, shared by both runs and unique to the test), while targets are created inside the scenario so each run gets fresh objects. A scenario never returns a target; it returns values, booleans, key arrays or labels.

`tests/parity/harness.spec.ts`:

```ts
test('expectParity fails when the two implementations differ', () => {
  expect(() => expectParity(api => api === oracle)).toThrow()
})
```

- [ ] **Step 2: Write the parity scenarios**

`tests/parity/shared-api.spec.ts`. Each row is one `test` whose body is `expectParity(api => ...)`; the scenario returns an array with one entry per call listed.

| Test name | Scenario |
| --- | --- |
| `every valid target accepts every operation` | `test.each(VALID_TARGET_LIST)`: define, get, getOwn, has, hasOwn, getMetadataKeys, getOwnMetadataKeys, delete twice (`true`, then `false`), each with and without a property key `'p'` |
| `every invalid target throws on every operation` | `test.each(INVALID_TARGET_LIST)`: one `capture` per operation, returned as an array (all `{ threw: true, typeError: true }`) |
| `symbol keys with equal descriptions stay separate` | two `Symbol('same')` as metadata keys on one class, and as property keys of one prototype |
| `a pipe inside keys and member names does not collide` | define `('a|b', 'x')` and `('b', 'x|a')` on one prototype (key, member); read all four combinations |
| `numeric and string property keys are the same member` | define with `1`, read with `'1'`; define with `'2'`, read with `2`; `getOwnMetadataKeys(target, 1)` |
| `an object property key converts like ToPropertyKey` | property key `{ toString: () => symbolKey }` on define, `symbolKey` on read |
| `an own undefined value shadows the parent value` | `Parent` → `'parent'`, `Child` → `undefined`: get, has, hasOwn, getMetadataKeys on `Child` |
| `class, prototype and instance are separate targets` | define on an instance; read on the class and on the prototype; define on the class, read on an instance |
| `static and instance members with the same name are separate` | define `(C, 'm')` and `(C.prototype, 'm')` with different values; read both |
| `an ES5-style subclass inherits through its prototype constructor` | `Parent`/`Child` plain functions wired as in Task 1; define on `Parent`, get/has/keys on `Child` |
| `Object.setPrototypeOf after a read changes later reads` | read `child` (missing), `Object.setPrototypeOf(child, parentWithMetadata)`, read again |
| `define and delete on a parent after a child read are visible` | read on `Child`, define on `Parent`, read `Child`, delete on `Parent`, read `Child` |
| `getMetadataKeys lists own keys first, then parent keys, without duplicates` | `Parent` keys `a`, `b`; `Child` keys `c`, `a`; result for `Child` and `Child`'s own keys |
| `deleteMetadata returns whether a key was removed` | untouched target; missing key on a target with metadata; existing key; the last key, then `getOwnMetadataKeys` |
| `defineMetadata returns undefined` | return value of `defineMetadata` |
| `objects without Object.prototype work as targets and chain ends` | `Object.create(null)` and `Function.prototype` as targets; a child of `Object.create(null)` reads its parent |

- [ ] **Step 3: Update the target lists and the two tests that assert normalization**

- `INVALID_TARGET_LIST` keeps only non-objects: the enum value, `null`, `undefined`, booleans, numbers (incl. `NaN`, `±Infinity`), strings, `Symbol('sym')`. Move `() => {}`, `async () => {}`, `function* () {}`, `async function () {}` to `VALID_TARGET_LIST` and add `async function* () {}`, `function () {}.bind(null)`, `Object.create(null)`, `Function.prototype`.
- `tests/internal/metadata-class.spec.ts`: rewrite `should retrieve metadata defined on an instance when querying by the class` as `should not retrieve metadata defined on an instance when querying by the class` (`getMetadata` → `undefined`, `hasMetadata` → `false`), and `getOwnMetadata reflects metadata defined via instance on the constructor` as `metadata defined on an instance is not own metadata of the constructor` (`hasOwnMetadata` → `false`, `getOwnMetadata` → `undefined`). Fact: running the three per-location internal specs against `reflect-metadata` on 2026-11-26 failed only these two tests and the three invalid-target tests (exception class); every other test there already matches the oracle.

- [ ] **Step 4: Add the parameter-extension tests**

In `tests/internal/metadata-parameter.spec.ts`, new `describe('Parameter extension')`:
- `parameter metadata does not collide with member metadata of the same name`: define `(key, 'member', C.prototype, 'm')` and `(key, 'param', C.prototype, 'm', 0)`; both reads return their own value.
- `constructor parameter metadata is inherited by a subclass`: define `(key, v, Parent, undefined, 0)`; `getMetadata(key, Child, undefined, 0)` → `v`; `hasOwnMetadata(key, Child, undefined, 0)` → `false`.
- `key enumeration and delete accept a parameter index`: two keys on parameter 1 of `C.prototype.m`; `getOwnMetadataKeys(C.prototype, 'm', 1)` → both in order; `getMetadataKeys(C.prototype, 'm', 0)` → `[]`; `deleteMetadata(k1, C.prototype, 'm', 1)` → `true`, again → `false`.
- `symbol-named methods with equal descriptions keep separate parameters`.

- [ ] **Step 5: Run the new tests to verify they fail**

Run: `npx vitest run tests/parity tests/internal --coverage.enabled=false`
Expected: FAIL — the harness self-test passes; parity tests fail on `getMetadataKeys`/`getOwnMetadataKeys` (missing), the instance/class, stale-read, symbol and pipe collision, own-`undefined` and arrow-function-target scenarios; `deleteMetadata` returns `undefined`.

- [ ] **Step 6: Rewrite the container and the facade**

Delete `normalizeTarget`, `makeCompositeKey`, `lookupCache` and `NOT_FOUND`. Storage: `protected storage = new WeakMap<object, TargetMetadata>()`. Every operation starts with `assertValidTarget(target)`, then `toPropertyKey(propertyKey)` when it is not `undefined` — this order matches `reflect-metadata`.

- Own reads: `storage.get(target)?.getSlot(...)` only. `hasOwnMetadata` is `slot.values.has(key)`.
- Chain reads (`getMetadata`, `hasMetadata`, `getMetadataKeys`): a loop `for (let current: object | null = target; current !== null; current = ordinaryGetPrototypeOf(current))`. `get`/`has` stop at the first level whose slot `has` the key. `getMetadataKeys` walks every level and appends each key not yet seen (a `Set` for membership, an array for order), which equals `reflect-metadata`'s own-then-parent merge.
- `deleteMetadata`: returns `slot.values.delete(key)` (`false` when the target or slot is missing); then `removeSlotIfEmpty` and, if the `TargetMetadata` is empty, `storage.delete(target)`.
- Facade: add `getMetadataKeys`, `getOwnMetadataKeys`; `deleteMetadata` returns the container's `boolean`.

Record in the container, next to the chain loop, the reason there is no cache (one line, pointing to the spec's "Lookup" section): writes on any ancestor and `Object.setPrototypeOf` would need invalidation across every descendant.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS, all files. Then the other two global checks.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src tests
git commit -m "feat: Matching reflect-metadata semantics in the container and adding the differential suite"
```

---

### Task 3: `decorate`

**Files:**
- Create: `src/public/decorate.ts`, `tests/parity/decorate.spec.ts`, `tests/public/decorate.spec.ts`
- Modify: `src/public/reflect-metadata.ts`, `src/public/index.ts`

**Interfaces:**
- Consumes: `toPropertyKey`, `isValidTarget`, `ReflectMetadataException`, `InvalidTargetReflectMetadataException`.
- Produces (function in `decorate.ts`, and a facade method with the same overloads that forwards to it):

```ts
export function decorate(decorators: ClassDecorator[], target: Function): Function
export function decorate(decorators: (PropertyDecorator | MethodDecorator)[], target: Object, propertyKey: PropertyKey, attributes?: PropertyDescriptor | null): PropertyDescriptor | undefined
```

(`ClassDecorator`, `PropertyDecorator`, `MethodDecorator` are the global legacy types; they type-check with the repo's default libs — verified 2026-11-26.)

- [ ] **Step 1: Write the failing tests**

`tests/parity/decorate.spec.ts`, one `expectParity` per row. Decorators are plain functions that push a label to a log array the scenario returns, together with a label for the result (`'original'`, `'replacement'`, `'descriptor'`, `'new descriptor'`, `undefined`):

| Test name | Scenario |
| --- | --- |
| `class form applies decorators from last to first` | three logging decorators, none returns |
| `class form replaces the target with a non-null return` | middle decorator returns a new class; the next one receives it |
| `class form rejects a non-constructor return` | a decorator returns `{}` |
| `class form rejects a non-constructor target` | target `{}` |
| `member form passes target, key and descriptor` | log `typeof target`, key and descriptor identity label |
| `member form replaces the descriptor with a non-null return` | |
| `member form rejects a non-object return` | a decorator returns `1` |
| `member form treats null attributes as undefined` | |
| `member form rejects invalid attributes` | attributes `1` |
| `member form converts the property key` | key `1`, logged key `'1'` |
| `decorators must be an array` | both forms, decorators `{}` |
| `member form rejects an invalid target` | target `1` |

`tests/public/decorate.spec.ts`: one test per library-only fact — each rejection above throws `ReflectMetadataException` with code `DECORATORS_INVALID`, `DECORATOR_ATTRIBUTES_INVALID`, `CLASS_DECORATOR_RESULT_INVALID`, `MEMBER_DECORATOR_RESULT_INVALID`, or `TARGET_METADATA_INVALID` (invalid target in either form).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/parity/decorate.spec.ts tests/public/decorate.spec.ts --coverage.enabled=false`
Expected: FAIL — `decorate` is not a function.

- [ ] **Step 3: Implement `decorate`**

Port `decorate`, `DecorateConstructor` and `DecorateProperty` from `node_modules/reflect-metadata/ReflectNoConflict.js`, keeping its validation order. A class-form target is valid when `typeof target === 'function'` (`reflect-metadata`'s `IsConstructor` approximation); the member form uses `isValidTarget`. Every `TypeError` there becomes the library exception with the matching code.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run`
Expected: PASS. Then the other two global checks.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: Adding decorate with reflect-metadata semantics"
```

---

### Task 4: `Symbol.metadata` polyfill and decorators recorded at class definition

**Files:**
- Create: `src/polyfills/symbol-metadata.ts`, `src/core/decorator-record.ts`
- Modify: `src/core/container.ts`, `src/public/reflect-metadata.ts`, `src/index.ts`
- Rewrite test: `tests/public/decorator.spec.ts`

**Interfaces:**
- Consumes: Task 2 container and `MetadataSlot.stamps`; Task 1 codes.
- Produces:
  - `src/polyfills/symbol-metadata.ts`: runs `(Symbol as { metadata?: symbol }).metadata ??= Symbol.for('Symbol.metadata')`, then `export const SYMBOL_METADATA: symbol`. The comment says why `Symbol.for`: it is esbuild's fallback key (`__knownSymbol`), so classes compiled by esbuild and by `tsc` share it.
  - `import '@polyfills/symbol-metadata'` is the first statement of `src/index.ts` and of `src/public/reflect-metadata.ts`; the container imports `SYMBOL_METADATA` from it.
  - `src/core/decorator-record.ts`: `interface DecoratorRecord { placement: 'static' | 'instance'; propertyKey: string | symbol; key: MetadataKey; value: MetadataValue; parameterIndex: number | undefined; stamp: number }`.
  - `MetadataContainer.enqueueDecoratorRecord(metadataObject: object, record: Omit<DecoratorRecord, 'stamp'>): void`.
  - Facade: `metadata(metadataKey: MetadataKey, metadataValue: MetadataValue): (value: unknown, context: DecoratorContext) => void` and `metadataParam(parameterIndex: number, metadataKey: MetadataKey, metadataValue: MetadataValue): (value: unknown, context: ClassDecoratorContext | ClassMethodDecoratorContext) => void`.

- [ ] **Step 1: Write the failing decorator suite**

Rewrite `tests/public/decorator.spec.ts` (fresh `ReflectMetadata` per test). No test creates an instance unless its name says so.

| Test name | Assertions |
| --- | --- |
| `class decorator define/get/has/delete` | unchanged |
| `field decorator records metadata on the prototype at class definition` | `getMetadata(k, C.prototype, 'field')` → `'value'`; `getOwnMetadata(k, C, 'field')` → `undefined` |
| `accessor, getter and setter decorators record metadata on the prototype at class definition` | same for `propAccessor`, `propGet`, `propSet` |
| `method decorator records metadata on the prototype at class definition` | |
| `static field decorator records metadata on the class at definition` | on `C` → `'value'`; on `C.prototype` → `undefined` |
| `static method decorator records metadata on the class at definition` | same |
| `parameter decorator on a method records on the prototype` | `getMetadata(k, C.prototype, 'method', 0)` |
| `parameter decorator on a static method records on the class` | `getMetadata(k, C, 'test', 0)` |
| `parameter decorator on the class records a constructor parameter` | `getMetadata(k, C, undefined, 0)` |
| `creating instances does not rewrite metadata` | delete one key and overwrite another after definition, `new C()` twice, both changes hold |
| `a subclass reads parent decorator metadata` | `getMetadata(k, Child.prototype, 'm')` → value; `getOwnMetadata` → `undefined` |
| `static and instance members with the same name are separate` | `static m` and `m` with different values |
| `isolated stores do not see each other's decorator metadata` | stores `a` and `b`; class decorated by `a`; `b.getMetadata` → `undefined`, `b.getMetadataKeys` → `[]`; `a` reads the value |
| `the outermost decorator wins for the same key` | two `@reflect.metadata(k, …)` on one method; the top one's value |
| `a class replaced by a subclass keeps class and member metadata` | `@replace @reflect.metadata('k', 'v') class C { @reflect.metadata('m', 'x') method() {} }`, `replace = C => class extends C {}`; `getMetadata('k', C)` → `'v'`, `getMetadata('m', C.prototype, 'method')` → `'x'` |
| `a class replaced by an unrelated class loses class metadata written to the original` | `replace = () => class Unrelated {}`; `getMetadata('k', C)` → `undefined`; member metadata on `C.prototype` → `'x'` |
| `explicit writes inside a class decorator body win over member decorators` | the class decorator calls `defineMetadata('k', 'explicit', value.prototype, 'a')` and `deleteMetadata('k', value.prototype, 'b')`; members `a` and `b` decorated with `('k', 'decorated')`; after definition `a` → `'explicit'`, `hasMetadata('k', C.prototype, 'b')` → `false` |
| `a class decorator body does not see member metadata yet; addInitializer does` | members `a` and `b` decorated with `('k', 'decorated')`. In the body: `getMetadata('k', value.prototype, 'a')` → `undefined`, `deleteMetadata('k', value.prototype, 'b')` → `false`. In `context.addInitializer`: `getMetadata('k', this.prototype, 'a')` → `'decorated'`, and `b` stays deleted (the explicit delete is newer than the record) |
| `a decorator on a private member throws` | defining `class { @reflect.metadata('k', 'v') #m() {} }` inside `expect(() => …)` throws `ReflectMetadataException` with `PRIVATE_MEMBER_UNSUPPORTED` |
| `a member decorator throws when context.metadata is missing` | call `reflect.metadata('k', 'v')` by hand with a method context whose `metadata` is `undefined`: throws code `DECORATOR_METADATA_UNAVAILABLE`, message names `@esliph/metadata` |
| `the first access through an instance sees member metadata` | Review Focus 1: `getMetadata(k, new C(), 'm')` is the first call |
| `key enumeration as the first access lists decorator keys` | Review Focus 2: `getMetadataKeys(C.prototype, 'm')` and, on another class, `getOwnMetadataKeys(C.prototype, 'm')` as the first call |
| `a static field initializer of the decorated class sees member metadata` | Review Focus 3: `static seen = reflect.getMetadata('k', this.prototype, 'm')` → `'v'`, with and without a class decorator |
| `computed member names keep their identity` | Review Focus 4: `[symbolA]` and `[symbolB]` (same description) hold different values; `[1]` is read with `1` and `'1'` |
| `a chain walk through objects without Object.prototype does not throw` | Review Focus 5: decorated `C`; `Object.setPrototypeOf(C.prototype, Object.create(null))`; `getMetadata(k, C.prototype, 'm')` → value, `getMetadata('missing', C.prototype, 'm')` → `undefined` |

- [ ] **Step 2: Run the suite to verify it fails**

Run: `npx vitest run tests/public/decorator.spec.ts --coverage.enabled=false`
Expected: FAIL — no-instance reads return `undefined`, static members are on the prototype, private members do not throw.

- [ ] **Step 3: Implement the polyfill, the records and the decorators**

Decorators (facade):
- `context.kind === 'class'`: write directly — `defineMetadata(key, value, classValue)` for `metadata`, `defineMetadata(key, value, classValue, undefined, parameterIndex)` for `metadataParam`.
- Member: if `context.private` → throw `PRIVATE_MEMBER_UNSUPPORTED`. If `context.metadata === undefined` → throw `DECORATOR_METADATA_UNAVAILABLE` with a message telling to import `@esliph/metadata` before the decorated class is defined. Otherwise `container.enqueueDecoratorRecord(context.metadata, { placement: context.static ? 'static' : 'instance', propertyKey: context.name, key, value, parameterIndex })`.

Container, the non-obvious part:

- `protected readonly recordsKey = Symbol('@esliph/metadata:records')` per container instance, so two stores never see each other's records.
- `protected nextStamp = 0` and `protected pendingRecords = 0`.
- `enqueueDecoratorRecord`: the records array is an own property of `metadataObject` (`Object.prototype.hasOwnProperty.call`, created when absent — `context.metadata` inherits from the parent class's object); push `{ ...record, stamp: ++this.nextStamp }`; `pendingRecords += 1`.
- `ownerOf(object): Function | undefined`: the object if it is a function; else, if it has an own `constructor` data property (`Object.getOwnPropertyDescriptor(object, 'constructor')?.value`, so no getter runs) that is a function whose `prototype === object`, that constructor; else `undefined`. Never call `object.hasOwnProperty` (Review Focus 5).
- `drain(object)`: `owner = ownerOf(object)`; `metadataObject = Object.getOwnPropertyDescriptor(owner, SYMBOL_METADATA)?.value`; if it is an object with an own records array: remove the array first, `pendingRecords -= records.length`, then replay each record in array order to `owner` (`static`) or `owner.prototype` (`instance`).
- Replay writes `slot.values.set(key, value)` unless `slot.stamps.get(key) > record.stamp`, and never touches `stamps`.
- Explicit `defineMetadata`/`deleteMetadata`: when `pendingRecords > 0`, `slot.stamps.set(key, ++this.nextStamp)` (create the slot if needed, also for a delete of a missing key); otherwise `slot.stamps.delete(key)`. Why: a record can only replay over a write made after it while its class is still undrained, and the only window for that is a class decorator body, before `Symbol.metadata` is attached. With no pending record, no later record can target an existing slot, so the stamp is dropped and a slot whose `values` and `stamps` are empty is removed. Write this reason as a comment above the stamp code.
- Call sites: every operation calls `drain(target)` after validation and before touching storage; the chain loop calls `drain(current)` on each level before reading it.

[hypothesis] Draining costs two `getOwnPropertyDescriptor` calls per chain level; with no cache this is still small at typical depths (≤ 5). No benchmark exists; measure before adding any cache back.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS, including Tasks 2–3 parity suites. Then the other two global checks.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: Recording decorator metadata at class definition through Symbol.metadata"
```

---

### Task 5: Emit test against `tsc` output

**Files:**
- Create: `tests/emit/tsconfig.json`, `tests/emit/record-symbol-metadata.cjs`, `tests/emit/index-entry.fixture.ts`, `tests/emit/decorator-module.fixture.ts`, `tests/emit/tsc-emit.spec.ts`

**Interfaces:**
- Consumes: the library source through `@index` and `@public/reflect-metadata`.
- Produces: nothing other tasks use.

The pipeline below was run on a scratch copy of the repo on 2026-11-26 (Windows, Node 24.18): `tsc` with this config, `replaceTscAliasPaths`, then `node -r <preload> <fixture>` printed the fixture's JSON.

- [ ] **Step 1: Write the config, the preload and the fixtures**

`tests/emit/tsconfig.json` — `declarationDir: null` is required: the base sets `declarationDir`, and `declaration: false` with it is error TS5069:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "rootDir": "../..", "declaration": false, "declarationDir": null },
  "include": ["../../src", "./*.fixture.ts"]
}
```

`record-symbol-metadata.cjs`: `globalThis.__symbolMetadataPredefined = typeof Symbol.metadata !== 'undefined'`.

Each fixture imports the library (`{ Reflect }` from `'@index'`; `{ ReflectMetadata }` from `'@public/reflect-metadata'` with `new ReflectMetadata()`), defines with no instance a class `Base` with a decorated instance method, a decorated static field, a `metadataParam` on a method and on the class, a `static seen` field reading the method metadata, and `class Child extends Base {}`. It prints one JSON line: `predefined` (the preload flag), `instanceMethod`, `staticField`, `methodParameter`, `constructorParameter`, `inherited` (read through `Child.prototype`), `staticInitializer` (`Base.seen`).

- [ ] **Step 2: Write the test**

`tests/emit/tsc-emit.spec.ts`:
- `beforeAll` (timeout 60 000 ms): `mkdtempSync(path.join(tmpdir(), 'esliph-metadata-emit-'))`; `execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config, '--outDir', out])`; `await replaceTscAliasPaths({ configFile: config, outDir: out })`.
- `afterAll`: `rmSync(out, { recursive: true, force: true })`.
- `test.each(['index-entry', 'decorator-module'])('%s fixture compiled by tsc records member metadata', …)`: run `execFileSync(process.execPath, ['-r', preload, path.join(out, 'tests/emit', `${name}.fixture.js`)], { encoding: 'utf8' })`, parse, and `expect(result).toEqual({ predefined: false, instanceMethod: 'v', staticField: 'v', methodParameter: 'v', constructorParameter: 'v', inherited: 'v', staticInitializer: 'v' })`.

`predefined: false` keeps the test honest: if a future Node defines `Symbol.metadata` natively, it fails instead of passing without testing the polyfill.

- [ ] **Step 3: Run it to verify it passes**

Run: `npx vitest run tests/emit --coverage.enabled=false`
Expected: PASS, 2 tests.

- [ ] **Step 4: Watch it fail without the polyfill**

Temporarily replace the `??=` line in `src/polyfills/symbol-metadata.ts` with nothing (keep `SYMBOL_METADATA`, falling back to `Symbol.for('Symbol.metadata')`). Run: `npx vitest run tests/emit --coverage.enabled=false`. Expected: FAIL — the fixture process exits with `DECORATOR_METADATA_UNAVAILABLE`. Undo the edit by hand, then `git diff --exit-code src/polyfills/symbol-metadata.ts` (no output, exit 0). Do not use `git checkout` on the file.

- [ ] **Step 5: Run the global checks and commit**

`npx vitest run`, type check, lint. Then:

```bash
git add tests/emit
git commit -m "test: Adding the tsc emit test for the Symbol.metadata polyfill"
```

---

### Task 6: Package and publish pipeline

**Files:**
- Modify: `package.json`, `.github/workflows/publish.yml`
- Create: `scripts/check-package.mjs`

**Interfaces:**
- Consumes: the built `dist/`.
- Produces: `npm run check:package`.

- [ ] **Step 1: Write the package check**

`scripts/check-package.mjs` exits non-zero with a message naming the failed assertion:
1. `dist/index.d.ts` must exist (message: run `npm run build` first).
2. `package.json`: `exports['.']` has `types` as its first key with value `./dist/index.d.ts`; `sideEffects` is absent, or an array that contains `./dist/polyfills/symbol-metadata.js`.
3. `execSync('npm pack --dry-run --json', { encoding: 'utf8' })` → `[0].files[].path` includes `dist/index.d.ts`, `dist/index.js`, `dist/polyfills/symbol-metadata.js`, and nothing under `src/` or `tests/`.
4. Consumer fixture in `mkdtempSync(path.join(tmpdir(), 'esliph-metadata-consumer-'))`: copy every packed path into `node_modules/@esliph/metadata/`; write `tsconfig.json` (`module`/`moduleResolution` `node16`, `strict`, `noEmit`, `types: []`) and `index.ts` importing `Reflect`, `ReflectMetadata`, `ReflectMetadataException` and using each in a typed expression; run `tsc -p` there (exit 0); run `node -e "require('@esliph/metadata'); console.log(typeof Symbol.metadata)"` with `cwd` in the fixture and expect `symbol`. Remove the directory in a `finally`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsc -p tsconfig.build.json`, `npx tsc-alias -p tsconfig.build.json`, then `node scripts/check-package.mjs` (not `npm run build` yet: its `rm -rf` fails in PowerShell and `cmd`).
Expected: FAIL on assertion 2 (`types` is last and points to `./index.d.ts`).

- [ ] **Step 3: Fix `package.json` and the workflow**

- `version`: `3.0.0`.
- `exports["."]`: `{ "types": "./dist/index.d.ts", "require": "./dist/index.js", "import": "./dist/index.js" }`.
- `scripts.build`: `node -e "require('fs').rmSync('dist', { recursive: true, force: true })" && tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json` (the inline `node -e` ran under `npm run` in PowerShell on 2026-11-26 and removed `dist`).
- `scripts.prepublishOnly`: `npm run build`.
- `scripts["check:package"]`: `node scripts/check-package.mjs`.
- No `sideEffects` field.
- `publish.yml`, after `Install`: steps `Lint` (`npx eslint .`), `Type check` (`npx tsc -p tests/tsconfig.json --noEmit`), `Test` (`npx vitest run`), then `Build`, `Check package` (`npm run check:package`), `Publish`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run build` then `npm run check:package`
Expected: exit 0. Then `git status --short` lists no leftover consumer directory (it lives in the OS temp dir) and the global checks pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts .github/workflows/publish.yml
git commit -m "build: Fixing the package types entry, the build script and the publish checks for 3.0.0"
```

---

### Task 7: Reference documentation, README and migration guide

**Files:**
- Modify: `README.md`, `docs/reference/api.md`, `docs/reference/decorators.md`, `docs/reference/exceptions.md`, `docs/reference/metadata-locations.md`, `docs/reference/known-limitations.md`, `docs/how-to/migrate-from-reflect-metadata.md`

Pages follow Diátaxis and the existing English style: facts, no preamble, no comparisons the reader did not ask for.

- [ ] **Step 1: Update the reference pages**
  - `api.md`: every signature from Tasks 2–4 (`getMetadataKeys`, `getOwnMetadataKeys`, `decorate` overloads, `deleteMetadata: boolean`, widened `PropertyKey`/`MetadataKey`, `parameterIndex` as the optional last argument). Remove the `container` section if it documents a protected field as public API.
  - `decorators.md`: member metadata recorded at class definition; static members on the class, instance members on the prototype; private members throw; the class-decorator-body limitation with the `addInitializer` workaround.
  - `exceptions.md`: base is a `TypeError`; one row per `ReflectMetadataErrorCode` with when it is thrown.
  - `metadata-locations.md`: the target is used as given (no class/prototype/instance resolution); valid targets = any object or function.
  - `known-limitations.md`: remove the six current sections; add "Member metadata is not visible inside a class decorator body" (example and `addInitializer` workaround) and "A class decorator that returns an unrelated class drops class metadata written to the original".
- [ ] **Step 2: Update `migrate-from-reflect-metadata.md`**: remove steps 4 (key enumeration) and 5 (instantiation before read); the difference table lists exactly the spec's "Intended differences from reflect-metadata".
- [ ] **Step 3: Update `README.md`**: features, usage (no `new` before reads), known limitations (the two remaining), requirements (TypeScript ≥ 5.2, standard decorators, import the library before decorated classes).
- [ ] **Step 4: Run every changed code example**: copy each new or changed TypeScript block into `tests/docs-examples.tmp.spec.ts`, with an `expect` for each value the prose states, and run `npx vitest run tests/docs-examples.tmp.spec.ts --coverage.enabled=false` → PASS. Fix the page, not the test, when they disagree. Delete the file; `git status --short` must not list it.
- [ ] **Step 5: Commit**

```bash
git add README.md docs/reference docs/how-to/migrate-from-reflect-metadata.md
git commit -m "docs: Documenting the 3.0.0 behavior in the reference, README and migration guide"
```

---

### Task 8: Explanation, how-to, tutorial and CLAUDE.md

**Files:**
- Modify: `docs/explanation/decorators-and-initializers.md`, `docs/explanation/how-lookup-works.md`, `docs/explanation/architecture/overview.md`, `docs/explanation/architecture/storage-model.md`, `docs/explanation/architecture/design-decisions.md`, `docs/how-to/create-custom-decorators.md`, `docs/how-to/isolate-metadata.md`, `docs/how-to/develop-the-library.md`, `docs/tutorials/getting-started.md`, `docs/README.md` (only if a title changes), `CLAUDE.md`

- [ ] **Step 1: Explanation pages**
  - `decorators-and-initializers.md`: records on `context.metadata`, drain on first access, why `addInitializer` was dropped, the class-decorator-body window. Rename the page only if the title stops being true, and update `docs/README.md` with it.
  - `how-lookup-works.md`: `OrdinaryGetPrototypeOf` walk, presence by `has`, no cache and why.
  - `architecture/storage-model.md`: `WeakMap<object, TargetMetadata>`, slots, stamps; remove `normalizeTarget`, `makeCompositeKey`, cache invalidation.
  - `architecture/design-decisions.md`: replace "Write member metadata through initializers", "One map per object with string composite keys", "Static and instance members share a location", "An object without a member name resolves to its class", "Per-object lookup cache" with the 3.0.0 decisions; state that the "no global side effect" decision is reversed for `Symbol.metadata`, and why.
  - `architecture/overview.md`: new modules (`polyfills`, `decorate`, `target-metadata`); the pipeline paragraph now lists lint, type check, tests and the package check.
- [ ] **Step 2: How-to and tutorial**: remove every `new X()` that exists only to make metadata appear and every sentence about instantiation-before-read; `develop-the-library.md` drops the Git Bash note and documents `npm run check:package` and the emit test.
- [ ] **Step 3: `CLAUDE.md`**: commands (`npm run build` works in any shell; `npm run check:package`), architecture, storage model, decorators and the "Known limitations" list (only the two that remain).
- [ ] **Step 4: Run every changed code example** exactly as in Task 7 Step 4, deleting `tests/docs-examples.tmp.spec.ts` afterwards.
- [ ] **Step 5: Check for leftovers**: `git grep -n -E "normalizeTarget|makeCompositeKey|lookupCache|NOT_FOUND|Git Bash|after (the first )?instantiation" -- README.md docs CLAUDE.md ':!docs/superpowers'` → no output.
- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: Updating the explanation, how-to and tutorial pages and CLAUDE.md for 3.0.0"
```
