# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@esliph/metadata`: a TypeScript library, with no runtime dependencies, that reads and writes metadata on classes, members and parameters. It replaces `reflect-metadata`.

The documentation is in English: `README.md` and the `docs/` folder, organized with the Diátaxis model (`tutorials/`, `how-to/`, `reference/`, `explanation/`). The architecture lives in `docs/explanation/architecture/`. A behavior change updates the pages in `docs/reference/` (and the README, if the behavior appears there). A new limitation goes to `docs/reference/known-limitations.md`.

## Commands

```bash
npm ci
npm test                                        # vitest in watch mode
npx vitest run                                  # single run, with coverage
npx vitest run tests/public/decorator.spec.ts -t "class decorator" --coverage.enabled=false   # one test
npm run build                                   # removes dist, then tsc and tsc-alias (works in any shell)
npm run check:package                           # checks the built package; run npm run build first
npm run lint                                    # ESLint
npx tsc -p tests/tsconfig.json --noEmit         # type-check src + tests (Vitest does not check types)
```

- Coverage is enabled in `vitest.config.ts` and written to `reports/tests/coverage`.
- `tests/emit` compiles fixtures with `tsc` and runs them in a fresh Node process. It is the only test that covers the `Symbol.metadata` polyfill, because Vitest compiles with esbuild.
- `tests/parity` runs each scenario on the library and on `reflect-metadata/no-conflict` (devDependency, test oracle only). Create metadata keys once per test, outside the scenario, and targets inside it: the oracle store is process-global.
- `.github/workflows/publish.yml` publishes to npm when a release is published on GitHub (Node 24). It runs lint, type check, tests, build and `npm run check:package` before `npm publish`.

## Architecture

Three layers, each delegating to the one below:

1. `src/globals`: the single instance `Reflect = new ReflectMetadata()`. The name hides the native `Reflect` in the module that imports it.
2. `src/public`: `ReflectMetadata`, the facade. It forwards operations to its own `MetadataContainer` (each instance is an isolated store), implements the `metadata` and `metadataParam` decorators and forwards `decorate` (`src/public/decorate.ts`).
3. `src/core`: `MetadataContainer`, with the storage, the prototype-chain walk and the decorator records.

`src/contracts` holds the types, `src/exceptions` the exceptions (each with a `code` from `ReflectMetadataErrorCode`; the base `ReflectMetadataException` extends `TypeError`), `src/utils` the target validation (`IsObject`), `toPropertyKey` and `ordinaryGetPrototypeOf`, and `src/polyfills/symbol-metadata.ts` defines `Symbol.metadata` when the runtime lacks it (the only global side effect; it is imported first by `src/index.ts` and by `src/public/reflect-metadata.ts`). `src/index.ts` exports every layer, including `MetadataContainer`.

The library behaves like `reflect-metadata` 0.2.2 on every shared operation. Do not add `declare global` for `Symbol.metadata`: it conflicts with `lib.esnext.decorators.d.ts`.

### Storage model (`src/core/container.ts`)

`WeakMap<object, TargetMetadata>`. A `TargetMetadata` holds member slots and parameter slots (`src/core/target-metadata.ts`), and a `MetadataSlot` holds `values` and `stamps`. There are no string composite keys, no target normalization and no cache. The target is used exactly as given.

`getMetadata`/`hasMetadata`/`getMetadataKeys` walk the chain with `ordinaryGetPrototypeOf`. Presence is `Map.has`: an own `undefined` is present.

### Decorators

They are the standard decorators (TC39, `experimentalDecorators: false`), not TypeScript's legacy ones. The standard has no parameter decorator, so `metadataParam(index, ...)` is applied to the class (constructor parameter) or to the method.

A class decorator writes directly. A member decorator appends a record to `context.metadata`, under a symbol private to the container. The container replays ("drains") the records the first time any operation touches the class or its prototype. Static members live on the class and instance members on the prototype. Explicit `defineMetadata`/`deleteMetadata` calls stamp the slot while records are pending, so a replay never overwrites a newer write. Private members throw `PRIVATE_MEMBER_UNSUPPORTED`.

## Known limitations

Three behaviors remain. They are documented, with example and workaround, in `docs/reference/known-limitations.md`:

- Member metadata is not visible inside a class decorator body, because `Symbol.metadata` is attached after the class decorators run. Read it inside `context.addInitializer`.
- A class decorator that returns an unrelated class drops the class metadata written to the original.
- A decorated class created inside a class decorator loses its member metadata, because the compiler overwrites its `Symbol.metadata`.

## Conventions

- Internal imports use aliases: `@*` points to `src/*` (`@core/container`), and `@tests/*` exists only in `tests/tsconfig.json`. `tsc-alias` rewrites the paths during the build (CommonJS output in `dist/`).
- Style: no semicolons, single quotes, 2 spaces, lines up to 160 columns (`.prettierrc`). The Prettier rule is disabled in ESLint.
- Tests in `tests/internal` exercise `MetadataContainer`; those in `tests/public`, the facade, `decorate` and the decorators. `tests/common/types-target-list.ts` lists the valid and invalid targets.
- Commits: `type: Description` in English, with the verb in the gerund (`feat: Creating ...`, `test: Adding ...`).
