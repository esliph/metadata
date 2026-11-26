# How to develop the library

This guide shows how to install, test, check, build and release `@esliph/metadata`. It assumes Node.js 20 or later, npm and a clone of the repository.

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
- `tests/public` tests the `ReflectMetadata` facade and the decorators.
- `tests/common/types-target-list.ts` lists the valid and invalid targets that several suites reuse.

## Check types and lint

Vitest does not type-check. Run the compiler over `src` and `tests`:

```bash
npx tsc -p tests/tsconfig.json --noEmit
```

There is no lint script. Run ESLint directly:

```bash
npx eslint .
```

Prettier settings are in `.prettierrc`: no semicolons, single quotes, 2 spaces, 160 columns.

## Build

```bash
npm run build
```

The script runs `rm -rf dist`, `tsc` and `tsc-alias`, which rewrites the `@*` import aliases into relative paths. The output is CommonJS in `dist/`. On Windows, run it from Git Bash, because `cmd` and PowerShell have no `rm -rf`.

To test the package as a consumer would install it:

```bash
npm pack
```

Install the generated `.tgz` in another project.

## Release

1. Update `version` in `package.json` and commit.
2. Run `npx vitest run` and `npx tsc -p tests/tsconfig.json --noEmit`. The release workflow does not run tests.
3. Publish a GitHub release whose tag is the version, for example `2.0.0`.

Publishing the release starts `.github/workflows/publish.yml`, which runs `npm ci`, `npm run build` and `npm publish` on Node 20 with the `NPM_TOKEN` secret.

## Update the documentation

A change of behavior updates the matching pages in `docs/reference`, and the README when the change is visible there. A new limitation goes to [Known limitations](../reference/known-limitations.md).
