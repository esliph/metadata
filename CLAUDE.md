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
npm run build                                   # rm -rf dist && tsc && tsc-alias
npx eslint .                                    # there is no lint script
npx tsc -p tests/tsconfig.json --noEmit         # type-check src + tests (Vitest does not check types)
```

- `npm run build` uses `rm`, so it fails in Windows `cmd`/PowerShell without the Unix tools on the `PATH`. Run it from Git Bash.
- Coverage is enabled in `vitest.config.ts` and written to `reports/tests/coverage`.
- `.github/workflows/publish.yml` publishes to npm when a release is published on GitHub (Node 20). The workflow builds and publishes **without running tests**.

## Architecture

Three layers, each delegating to the one below:

1. `src/globals`: the single instance `Reflect = new ReflectMetadata()`. The name hides the native `Reflect` in the module that imports it.
2. `src/public`: `ReflectMetadata`, the facade. It forwards operations to its own `MetadataContainer` (each instance is an isolated store) and implements the `metadata` and `metadataParam` decorators.
3. `src/core`: `MetadataContainer`, with all the storage, target-resolution and inheritance logic.

`src/contracts` holds the types, `src/exceptions` the exceptions (each with a `code` from `ReflectMetadataErrorCode`) and `src/utils` the target validation (rejects primitives, arrow functions and functions without `prototype`). `src/index.ts` exports every layer, including `MetadataContainer`.

### Storage model (`src/core/container.ts`)

`WeakMap<normalized target, Map<composite key, value>>`. The two transformations below decide where each piece of metadata lives:

- `normalizeTarget`: with a `propertyKey`, a class becomes `Class.prototype` (except for `'constructor'`), which is why static and instance members with the same name share the entry. Without a `propertyKey`, an object (including a prototype or an instance) becomes its `constructor`.
- `makeCompositeKey`: without `propertyKey` and `parameterIndex`, the key is used as is. Otherwise it becomes a string: `prop|key` or `prop|param:N|key`. A parameter without `propertyKey` belongs to the constructor (`prop = 'constructor'`).

`getMetadata`/`hasMetadata` climb the prototype chain and memoize the result in `lookupCache` (the `NOT_FOUND` sentinel represents absence). `getOwnMetadata`/`hasOwnMetadata` query only the target, without cache. The `has*` methods treat an `undefined` value as absent.

### Decorators

They are the standard decorators (TC39, `experimentalDecorators: false`), not TypeScript's legacy ones. The standard has no parameter decorator, so `metadataParam(index, ...)` is applied to the class (constructor parameter) or to the method.

Except for classes, the write happens inside `context.addInitializer`: instance members only have metadata after the first instantiation, and each new instance writes the value again (undoing a `deleteMetadata` or an overwrite) and invalidates the cache. Static members are written when the class is defined. The target of an instance member is the prototype of the instantiated class, so a subclass writes to its own prototype.

## Known limitations

Current behaviors, not covered by tests, that go against what is expected. They are documented, with example and workaround, in `docs/reference/known-limitations.md`. Keep them in mind when changing the container:

- `defineMetadata` and `deleteMetadata` invalidate the cache of their own target only. A subclass that has already read the key keeps getting the old result after a change in the parent class.
- On members and parameters, the composite key is a string joined by `|`. Two symbols with the same description collide, as a key or as a member name. A `|` inside the name or the key can also collide with another combination.
- Without a `propertyKey`, an object becomes its `constructor`: all object literals share `Object`, all arrays share `Array`, and so on.
- `isValidTarget` rejects only functions whose constructor is named `GeneratorFunction`; `async function*` functions pass as valid targets.
- The test name `static field decorator also stores metadata (initializer run on instantiation)` in `tests/public/decorator.spec.ts` is wrong: static initializers run when the class is defined.

## Conventions

- Internal imports use aliases: `@*` points to `src/*` (`@core/container`), and `@tests/*` exists only in `tests/tsconfig.json`. `tsc-alias` rewrites the paths during the build (CommonJS output in `dist/`).
- Style: no semicolons, single quotes, 2 spaces, lines up to 160 columns (`.prettierrc`). The Prettier rule is disabled in ESLint.
- Tests in `tests/internal` exercise `MetadataContainer`; those in `tests/public`, the facade and the decorators. `tests/common/types-target-list.ts` lists the valid and invalid targets.
- Commits: `type: Description` in English, with the verb in the gerund (`feat: Creating ...`, `test: Adding ...`).
