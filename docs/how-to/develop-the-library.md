# How to develop the library

This guide shows how to install, test, check, build and release `@esliph/metadata`. It assumes Node.js 22 or later, npm and a clone of the repository.

## Install

```bash
npm ci
```

## Run the tests

```bash
npm test                 # Vitest in watch mode
npx vitest run           # single run, with coverage
```

Coverage is on by default (`vitest.config.ts`) and is written to `reports/tests/coverage`.

Run one file or one test, without coverage:

```bash
npx vitest run tests/public/decorator.spec.ts -t "class decorator" --coverage.enabled=false
```

- `tests/internal` tests `MetadataContainer` directly.
- `tests/public` tests the `ReflectMetadata` facade, `decorate` and the decorators.
- `tests/parity` runs each scenario on the library and on `reflect-metadata/no-conflict` and requires equal results. Create metadata keys once per test, outside the scenario, and targets inside it: the `reflect-metadata` store is process-global.
- `tests/emit` compiles fixtures with `tsc` and runs them in a fresh Node process where `Symbol.metadata` is not predefined. Vitest compiles with esbuild, which hides a missing polyfill, so this is the only test that covers it.
- `tests/common/types-target-list.ts` lists the valid and invalid targets that several suites reuse.

## Check types and lint

Vitest does not type-check. Run the compiler over `src` and `tests`:

```bash
npx tsc -p tests/tsconfig.json --noEmit
```

Run ESLint:

```bash
npm run lint
```

Prettier settings are in `.prettierrc`: no semicolons, single quotes, 2 spaces, 160 columns.

## Build

```bash
npm run build
```

The script removes `dist`, runs `tsc -p tsconfig.build.json` and runs `tsc-alias`, which rewrites the `@*` import aliases into relative paths. The output is CommonJS in `dist/`. It works in any shell.

To check the built package as a consumer would install it:

```bash
npm run check:package
```

The script checks the manifest, the packed file list, and installs the package in a temporary project that compiles a TypeScript file and requires the package. Run `npm run build` first.

## Release

1. Update `version` in `package.json` and commit.
2. Run `npm run lint`, `npx tsc -p tests/tsconfig.json --noEmit`, `npx vitest run`, `npm run build` and `npm run check:package`. The release workflow runs the same checks.
3. Publish a GitHub release whose tag is the version, for example `3.0.0`.

Publishing the release starts `.github/workflows/publish.yml`, which runs `npm ci`, lint, type check, tests, build, `npm run check:package` and `npm publish` on Node 24 with the `NPM_TOKEN` secret.

## Update the documentation

A change of behavior updates the matching pages in `docs/reference`, and the README when the change is visible there. A new limitation goes to [Known limitations](../reference/known-limitations.md).
